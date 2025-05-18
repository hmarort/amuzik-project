import { Injectable, OnDestroy } from '@angular/core';
import { AudiusRequest } from './requests/audius.request';
import { BehaviorSubject, Subject, Observable, interval, Subscription } from 'rxjs';
import { filter, distinctUntilChanged, takeUntil, debounceTime } from 'rxjs/operators';
import { environment } from 'src/environments/environment.prod';
import { AuthService } from './auth.service';

export interface ListeningRoom {
  id: string;
  creatorId: string;
  trackId: string;
  state: 'playing' | 'paused';
  progress: number;
  timestamp: number;
  members: string[];
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastAttempt: Date | null;
  isReconnecting: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ListeningRoomService implements OnDestroy {
  // Room state observables
  private currentRoomSubject = new BehaviorSubject<ListeningRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  private isHostSubject = new BehaviorSubject<boolean>(false);
  public isHost$ = this.isHostSubject.asObservable();

  private membersSubject = new BehaviorSubject<string[]>([]);
  public members$ = this.membersSubject.asObservable();

  private syncStatusSubject = new BehaviorSubject<'synced' | 'syncing' | 'out-of-sync'>('synced');
  public syncStatus$ = this.syncStatusSubject.asObservable();

  // WebSocket related
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<any>();
  public message$ = this.messageSubject.asObservable();
  
  // Mejorado: Estado de conexión más detallado, similar a ChatService
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>({
    isConnected: false,
    lastAttempt: null,
    isReconnecting: false
  });
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  // Control variables
  private userId: string | null = null;
  private syncThreshold = 0.3; // 300ms threshold for sync
  private syncCheckInterval: Subscription | null = null;
  private heartbeatInterval: Subscription | null = null;
  private destroy$ = new Subject<void>();
  private isLocalUpdate = false;
  private isSyncing = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any = null;

  constructor(
    private audiusService: AudiusRequest,
    private authService: AuthService
  ) {
    // Subscribir a cambios de autenticación primero
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      const previousUserId = this.userId;
      this.userId = user?.id || null;
      
      if (this.userId && this.userId !== previousUserId) {
        // Usuario inició sesión o cambió, intentar conectar
        this.checkAndConnect();
      } else if (!this.userId && previousUserId) {
        // Usuario cerró sesión, desconectar
        this.disconnect();
      }
    });

    // Escuchar cambios en el estado de la conexión WebSocket
    this.connectionStatus$.pipe(
      takeUntil(this.destroy$),
      filter(status => status.isConnected)
    ).subscribe(() => {
      this.initialize();
    });

    // Configurar monitoreo del estado de audio
    this.setupAudioMonitoring();
  }

  /**
   * Verificar si debemos conectarnos al WebSocket
   */
  private checkAndConnect(): void {
    const userId = this.getUserId();
    if (!userId) return;
    
    if (!this.socket || 
        (this.socket.readyState !== WebSocket.OPEN && 
         this.socket.readyState !== WebSocket.CONNECTING)) {
      this.connectWebSocket();
    }
  }

  /**
   * Connect to the WebSocket server with improved error handling
   */
  private connectWebSocket(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const userId = this.getUserId();
    if (!userId) {
      console.error('Cannot connect: No authenticated user');
      return;
    }

    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: this.reconnectAttempts > 0
    });
    
    // Get WebSocket URL from environment
    const wsUrl = environment.wsUrl;
    
    try {
      // Añadir userId como parámetro de consulta para autenticación inmediata
      this.socket = new WebSocket(`${wsUrl}?userId=${userId}`);
      
      this.socket.onopen = () => {
        console.log('ListeningRoom WebSocket connection established');
        this.reconnectAttempts = 0;
        
        this.connectionStatusSubject.next({
          isConnected: true,
          lastAttempt: new Date(),
          isReconnecting: false
        });
        
        // Iniciar heartbeat para mantener conexión activa
        this.startHeartbeat();
        
        // Recuperar salas del usuario al conectar
        this.getUserRooms();
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('ListeningRoom WebSocket message received:', data);
          this.messageSubject.next(data);
          
          // Responder a pings del servidor
          if (data.type === 'ping') {
            this.socket?.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('ListeningRoom WebSocket error:', error);
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false
        });
      };
      
      this.socket.onclose = (event) => {
        console.log('ListeningRoom WebSocket connection closed:', event.code, event.reason);
        
        // Detener heartbeat
        this.stopHeartbeat();
        
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false
        });
        
        // Intentar reconectar
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.connectionStatusSubject.next({
        isConnected: false,
        lastAttempt: new Date(),
        isReconnecting: false
      });
      this.attemptReconnect();
    }
  }

  /**
   * Iniciar heartbeat para mantener la conexión viva
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Detener cualquier heartbeat existente primero
    
    this.heartbeatInterval = interval(25000).subscribe(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ 
            type: 'ping', 
            timestamp: Date.now() 
          }));
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      } else {
        this.stopHeartbeat();
      }
    });
  }

  /**
   * Detener el heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      this.heartbeatInterval.unsubscribe();
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect to WebSocket server with exponential backoff
   */
  private attemptReconnect(): void {
    // Don't attempt to reconnect if no user is logged in
    if (!this.authService.isAuthenticated()) {
      console.log('Not attempting reconnect - no authenticated user');
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum reconnection attempts reached');
      return;
    }
    
    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Exponential backoff with a maximum of 30 seconds
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    this.reconnectAttempts++;
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: true
    });
    
    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Send a message to the WebSocket server with improved error handling
   */
  send(message: WebSocketMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, unable to send message');
      // Intentar conectar y luego enviar el mensaje cuando esté conectado
      this.checkAndConnect();
      // En un caso real, implementaríamos una cola de mensajes para enviar cuando reconectemos
      return;
    }
    
    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  /**
   * Get the current user ID from AuthService
   */
  getUserId(): string | null {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id || null;
  }

  /**
   * Initialize the service with user ID and set up event listeners
   */
  initialize(): void {
    // Get user ID from AuthService
    this.userId = this.getUserId();
    
    if (!this.userId) {
      console.error('No user ID available for listening service');
      return;
    }

    console.log('Initializing listening room service for user:', this.userId);

    // Listen for room-related WebSocket events
    this.message$.pipe(
      takeUntil(this.destroy$),
      filter(msg => msg && typeof msg === 'object')
    ).subscribe(message => {
      this.handleWebSocketMessage(message);
    });

    // Get user's rooms on initialization
    this.getUserRooms();
  }

  /**
   * Handle incoming WebSocket messages related to listening rooms
   */
  private handleWebSocketMessage(message: any): void {
    if (!message || !message.type) return;

    console.log(`Received WebSocket message: ${message.type}`, message);

    switch (message.type) {
      case 'room_created':
        this.handleRoomCreated(message.room);
        break;
      
      case 'room_joined':
        this.handleRoomJoined(message.room);
        break;
      
      case 'room_updated':
        this.handleRoomUpdated(message.room, message.initiatorId);
        break;
      
      case 'room_sync':
        this.handleRoomSync(message);
        break;
      
      case 'member_joined':
        this.handleMemberJoined(message.roomId, message.userId);
        break;
      
      case 'member_left':
        this.handleMemberLeft(message.roomId, message.userId, message.newCreatorId);
        break;
      
      case 'user_rooms':
        this.handleUserRooms(message.rooms);
        break;
      
      case 'room_invitation':
        // Just log for now - would typically show a notification in UI
        console.log(`Room invitation received for room ${message.roomId} from ${message.inviterId}`);
        break;
      
      case 'room_left':
        this.handleRoomLeft(message.roomId);
        break;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatusSubject.value;
  }
  
  /**
   * Force reconnection
   */
  forceReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.reconnectAttempts = 0;
      this.connectWebSocket();
    }, 1000);
  }

  /**
   * Create a new listening room
   */
  createRoom(trackId: string): void {
    if (!this.authService.isAuthenticated()) {
      console.error('Cannot create room: not authenticated');
      return;
    }
    
    // Asegurar conexión antes de enviar
    if (!this.isConnected()) {
      this.checkAndConnect();
      // Idealmente, implementaríamos una cola de comandos para cuando conectemos
      setTimeout(() => {
        if (this.isConnected()) {
          this.send({
            type: 'create_room',
            trackId
          });
        }
      }, 1000);
      return;
    }
    
    this.send({
      type: 'create_room',
      trackId
    });
  }

  /**
   * Join an existing room
   */
  joinRoom(roomId: string): void {
    if (!this.authService.isAuthenticated()) {
      console.error('Cannot join room: not authenticated');
      return;
    }
    
    // Asegurar conexión antes de enviar
    if (!this.isConnected()) {
      this.checkAndConnect();
      setTimeout(() => {
        if (this.isConnected()) {
          this.send({
            type: 'join_room',
            roomId
          });
        }
      }, 1000);
      return;
    }
    
    this.send({
      type: 'join_room',
      roomId
    });
  }

  /**
   * Leave the current room
   */
  leaveRoom(): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom) return;

    this.send({
      type: 'leave_room',
      roomId: currentRoom.id
    });
  }

  /**
   * Invite a user to the current room
   */
  inviteUser(userId: string): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom) return;

    this.send({
      type: 'room_invitation',
      roomId: currentRoom.id,
      inviteeId: userId
    });
  }

  /**
   * Start playback of the current room's track
   * If user is host, will broadcast to all members
   */
  play(): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom) return;

    // Set flag to prevent feedback loops
    this.isLocalUpdate = true;

    // Play the track locally
    this.audiusService.playTrack(currentRoom.trackId);

    // If user is host, broadcast to room
    if (this.isHostSubject.value) {
      this.send({
        type: 'room_update',
        roomId: currentRoom.id,
        state: 'playing',
        progress: this.audiusService.getCurrentTime()
      });
    }

    setTimeout(() => {
      this.isLocalUpdate = false;
    }, 100);
  }

  /**
   * Pause playback of the current room's track
   * If user is host, will broadcast to all members
   */
  pause(): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom) return;

    // Set flag to prevent feedback loops
    this.isLocalUpdate = true;

    // Pause the track locally
    this.audiusService.pauseTrack();

    // If user is host, broadcast to room
    if (this.isHostSubject.value) {
      this.send({
        type: 'room_update',
        roomId: currentRoom.id,
        state: 'paused',
        progress: this.audiusService.getCurrentTime()
      });
    }

    setTimeout(() => {
      this.isLocalUpdate = false;
    }, 100);
  }

  /**
   * Seek to a specific position in the track
   * If user is host, will broadcast to all members
   */
  seekTo(position: number): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom) return;

    // Set flag to prevent feedback loops
    this.isLocalUpdate = true;

    // Seek locally
    this.audiusService.seekTo(position);

    // If user is host, broadcast to room
    if (this.isHostSubject.value) {
      this.send({
        type: 'room_update',
        roomId: currentRoom.id,
        progress: position,
        state: this.audiusService.isPlaying() ? 'playing' : 'paused'
      });
    }

    setTimeout(() => {
      this.isLocalUpdate = false;
    }, 100);
  }

  /**
   * Change the track in the room
   * Only the host can do this
   */
  changeTrack(trackId: string): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom || !this.isHostSubject.value) return;

    // Update locally
    this.audiusService.stopCurrentTrack();
    this.audiusService.playTrack(trackId);

    // Broadcast to room
    this.send({
      type: 'room_update',
      roomId: currentRoom.id,
      trackId: trackId,
      state: 'playing',
      progress: 0
    });
  }

  /**
   * Get the rooms the user is part of
   */
  getUserRooms(): void {
    if (!this.authService.isAuthenticated()) {
      console.error('Cannot get user rooms: not authenticated');
      return;
    }
    
    // Asegurar conexión antes de enviar
    if (!this.isConnected()) {
      this.checkAndConnect();
      return; // Intentaremos de nuevo cuando estemos conectados
    }
    
    this.send({
      type: 'get_user_rooms'
    });
  }

  /**
   * Request sync from the server for the current room
   */
  requestSync(): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom) return;

    this.syncStatusSubject.next('syncing');
    this.isSyncing = true;

    this.send({
      type: 'sync_request',
      roomId: currentRoom.id
    });
  }

  /**
   * Setup monitoring of local audio playback to maintain sync with room
   */
  private setupAudioMonitoring(): void {
    // Track when local audio play state changes
    this.audiusService.isPlaying$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(),
      filter(() => !this.isLocalUpdate)  // Ignore if update was triggered locally
    ).subscribe(isPlaying => {
      // Only react to playback changes if we're in a room and not the host
      const currentRoom = this.currentRoomSubject.value;
      if (!currentRoom || this.isHostSubject.value) return;

      // Check if we need to sync with room state
      if (isPlaying && currentRoom.state === 'paused') {
        // Room is paused but we're playing - pause locally
        this.audiusService.pauseTrack();
      } else if (!isPlaying && currentRoom.state === 'playing') {
        // Room is playing but we're paused - resume locally
        this.audiusService.playTrack(currentRoom.trackId);
      }
    });

    // Track when current playing track changes
    this.audiusService.currentTrackId$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(),
      filter(id => !!id && !this.isLocalUpdate)  // Ignore if update was triggered locally
    ).subscribe(trackId => {
      // Only react if we're in a room and are the host
      const currentRoom = this.currentRoomSubject.value;
      if (!currentRoom || !this.isHostSubject.value || !trackId) return;

      // If host changed track, update room
      if (trackId !== currentRoom.trackId) {
        this.send({
          type: 'room_update',
          roomId: currentRoom.id,
          trackId: trackId,
          state: 'playing',
          progress: 0
        });
      }
    });

    // Set up sync check interval when in a room
    this.currentRoom$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(room => {
      // Clean up existing interval if any
      if (this.syncCheckInterval) {
        this.syncCheckInterval.unsubscribe();
        this.syncCheckInterval = null;
      }

      // If we're in a room and not the host, start sync checks
      if (room && !this.isHostSubject.value) {
        this.syncCheckInterval = interval(5000).pipe(
          takeUntil(this.destroy$)
        ).subscribe(() => this.checkSync());
      }
    });
  }

  /**
   * Check if local playback is in sync with room
   */
  private checkSync(): void {
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom || this.isHostSubject.value || this.isSyncing) return;

    const isPlaying = this.audiusService.isPlaying();
    const currentTime = this.audiusService.getCurrentTime();
    
    // Calculate expected progress based on room state
    let expectedProgress = currentRoom.progress;
    if (currentRoom.state === 'playing') {
      const elapsedSeconds = (Date.now() - currentRoom.timestamp) / 1000;
      expectedProgress = currentRoom.progress + elapsedSeconds;
    }

    // Check if we're out of sync
    const syncDiff = Math.abs(currentTime - expectedProgress);
    
    if (syncDiff > this.syncThreshold) {
      console.log(`Out of sync: local=${currentTime}, expected=${expectedProgress}, diff=${syncDiff}`);
      this.syncStatusSubject.next('out-of-sync');

      // Request sync if difference is significant
      if (syncDiff > 1.0) {
        this.requestSync();
      }
    } else {
      this.syncStatusSubject.next('synced');
    }
  }

  /**
   * Handle a newly created room
   */
  private handleRoomCreated(room: ListeningRoom): void {
    console.log('Room created:', room);
    
    // Store room state
    this.currentRoomSubject.next(room);
    
    // Set user as host
    this.isHostSubject.next(room.creatorId === this.userId);
    
    // Update members list
    this.membersSubject.next(room.members);
    
    // Load and play the track if we're in the room
    this.audiusService.playTrack(room.trackId);
  }

  /**
   * Handle joining a room
   */
  private handleRoomJoined(room: ListeningRoom): void {
    console.log('Room joined:', room);
    
    // Store room state
    this.currentRoomSubject.next(room);
    
    // Set user as host or not
    this.isHostSubject.next(room.creatorId === this.userId);
    
    // Update members list
    this.membersSubject.next(room.members);
    
    // Request immediate sync
    this.requestSync();
  }

  /**
   * Handle room state updates
   */
  private handleRoomUpdated(room: ListeningRoom, initiatorId: string): void {
    console.log('Room updated:', room, 'by', initiatorId);
    
    // If we initiated the update, don't react to it
    if (initiatorId === this.userId && this.isLocalUpdate) {
      return;
    }
    
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom || currentRoom.id !== room.id) return;
    
    // Update local room state
    this.currentRoomSubject.next(room);
    
    // Update local playback to match room state
    
    // Track changed
    if (room.trackId !== currentRoom.trackId) {
      this.isLocalUpdate = true;
      this.audiusService.playTrack(room.trackId);
      setTimeout(() => {
        this.isLocalUpdate = false;
      }, 100);
    }
    
    // Playing state changed
    if (room.state !== currentRoom.state) {
      this.isLocalUpdate = true;
      if (room.state === 'playing') {
        this.audiusService.playTrack(room.trackId);
        // Seek to expected position
        const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
        this.audiusService.seekTo(room.progress + elapsedSeconds);
      } else {
        this.audiusService.pauseTrack();
      }
      setTimeout(() => {
        this.isLocalUpdate = false;
      }, 100);
    }
    
    // Progress changed significantly
    if (Math.abs(room.progress - currentRoom.progress) > this.syncThreshold) {
      this.isLocalUpdate = true;
      // Calculate current expected position
      let targetPosition = room.progress;
      if (room.state === 'playing') {
        const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
        targetPosition += elapsedSeconds;
      }
      this.audiusService.seekTo(targetPosition);
      setTimeout(() => {
        this.isLocalUpdate = false;
      }, 100);
    }
  }

  /**
   * Handle room sync response
   */
  private handleRoomSync(message: any): void {
    console.log('Room sync received:', message);
    
    this.isSyncing = false;
    this.syncStatusSubject.next('synced');
    
    const { roomId, state, progress, trackId } = message;
    const currentRoom = this.currentRoomSubject.value;
    
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    this.isLocalUpdate = true;
    
    // Calculate current expected position
    let targetPosition = progress;
    if (state === 'playing') {
      const elapsedSeconds = (Date.now() - message.timestamp) / 1000;
      targetPosition += elapsedSeconds;
    }
    
    // Apply sync
    if (trackId !== this.audiusService.getCurrentTrackId()) {
      this.audiusService.playTrack(trackId);
    }
    
    this.audiusService.seekTo(targetPosition);
    
    if (state === 'playing' && !this.audiusService.isPlaying()) {
      this.audiusService.playTrack(trackId);
    } else if (state === 'paused' && this.audiusService.isPlaying()) {
      this.audiusService.pauseTrack();
    }
    
    // Update room state
    this.currentRoomSubject.next({
      ...currentRoom, 
      state, 
      progress, 
      trackId,
      timestamp: message.timestamp
    });
    
    setTimeout(() => {
      this.isLocalUpdate = false;
    }, 100);
  }

  /**
   * Handle a member joining the room
   */
  private handleMemberJoined(roomId: string, userId: string): void {
    console.log(`Member ${userId} joined room ${roomId}`);
    
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    // Update members list
    const updatedMembers = [...currentRoom.members, userId];
    this.membersSubject.next(updatedMembers);
    
    // Update room state
    this.currentRoomSubject.next({
      ...currentRoom,
      members: updatedMembers
    });
  }

  /**
   * Handle a member leaving the room
   */
  private handleMemberLeft(roomId: string, userId: string, newCreatorId?: string): void {
    console.log(`Member ${userId} left room ${roomId}`, newCreatorId ? `New creator: ${newCreatorId}` : '');
    
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    // Update members list
    const updatedMembers = currentRoom.members.filter(id => id !== userId);
    this.membersSubject.next(updatedMembers);
    
    // Update room state
    const updatedRoom = {
      ...currentRoom,
      members: updatedMembers
    };
    
    // If creator changed and it's us, update host status
    if (newCreatorId) {
      updatedRoom.creatorId = newCreatorId;
      if (newCreatorId === this.userId) {
        this.isHostSubject.next(true);
        console.log('You are now the host of this room');
      }
    }
    
    this.currentRoomSubject.next(updatedRoom);
  }

  /**
   * Handle user rooms response
   */
  private handleUserRooms(rooms: ListeningRoom[]): void {
    console.log('User rooms:', rooms);
    
    // If user is already in a room, set it as the current room
    if (rooms.length > 0) {
      const currentRoom = rooms[0]; // Pick the first room
      this.currentRoomSubject.next(currentRoom);
      this.isHostSubject.next(currentRoom.creatorId === this.userId);
      this.membersSubject.next(currentRoom.members);
      
      // Request sync to get current state
      this.requestSync();
    }
  }

  /**
   * Handle leaving a room
   */
  private handleRoomLeft(roomId: string): void {
    console.log(`Left room ${roomId}`);
    
    const currentRoom = this.currentRoomSubject.value;
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    // Reset room state
    this.currentRoomSubject.next(null);
    this.isHostSubject.next(false);
    this.membersSubject.next([]);
    
    // Stop the audio
    this.audiusService.pauseTrack();
  }

  /**
   * Clean up resources on service destruction
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.syncCheckInterval) {
      this.syncCheckInterval.unsubscribe();
    }
    
    // Close WebSocket connection
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // Clear any reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Disconnect WebSocket manually
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}