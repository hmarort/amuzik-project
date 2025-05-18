import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, interval } from 'rxjs';
import { debounceTime, filter, take, takeUntil } from 'rxjs/operators';
import { ChatService } from './chat.service';
import { AudiusFacade, PlaybackState, MusicEvent } from './facades/audius.facade';
import { AuthService } from './auth.service';

export interface ListeningRoom {
  id: string;
  creatorId: string;
  trackId: string | null;
  state: 'playing' | 'paused';
  progress: number;
  timestamp: number;
  members: string[];
}

export interface RoomMember {
  id: string;
  name?: string;
  isOnline: boolean;
  isHost: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ListeningService implements OnDestroy {
  // Subjects for managing observables
  private destroy$ = new Subject<void>();
  private currentRoomSubject = new BehaviorSubject<ListeningRoom | null>(null);
  private roomMembersSubject = new BehaviorSubject<RoomMember[]>([]);
  private syncStatusSubject = new BehaviorSubject<{inSync: boolean, offset: number}>({inSync: true, offset: 0});
  private roomsSubject = new BehaviorSubject<ListeningRoom[]>([]);
  private isJoiningSubject = new BehaviorSubject<boolean>(false);
  private isLocalUpdateSubject = new BehaviorSubject<boolean>(false);
  
  // Observables for components
  public currentRoom$ = this.currentRoomSubject.asObservable();
  public roomMembers$ = this.roomMembersSubject.asObservable();
  public syncStatus$ = this.syncStatusSubject.asObservable();
  public rooms$ = this.roomsSubject.asObservable();
  public isJoining$ = this.isJoiningSubject.asObservable();
  
  // Subscriptions
  private musicEventSub: Subscription | null = null;
  private playbackStateSub: Subscription | null = null;
  private syncCheckInterval: Subscription | null = null;
  
  // Settings
  private syncThresholdMs = 3000; // Consider out of sync if more than 3 seconds difference
  private syncCheckIntervalMs = 10000; // Check sync every 10 seconds
  
  constructor(
    private chatService: ChatService,
    private audiusService: AudiusFacade,
    private authService: AuthService
  ) {
    // Listen for WebSocket messages
    this.setupWebSocketListeners();
    
    // Request current user rooms when service initializes
    this.getUserRooms();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopSyncChecking();
    if (this.musicEventSub) {
      this.musicEventSub.unsubscribe();
    }
    if (this.playbackStateSub) {
      this.playbackStateSub.unsubscribe();
    }
  }
  
  /**
   * Initialize WebSocket message listeners
   */
  private setupWebSocketListeners(): void {
    // Make sure we're connected to WebSocket
    if (!this.chatService.isConnected()) {
      this.chatService.connect();
    }
    
    // Listen for WebSocket connection status changes
    this.chatService.connectionStatus$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(status => {
      if (status.isConnected) {
        // When connected, request user rooms
        this.getUserRooms();
        
        // If we're in a room, request sync
        const currentRoom = this.currentRoomSubject.getValue();
        if (currentRoom) {
          this.requestRoomSync(currentRoom.id);
        }
      }
    });
    
    // Setup listener for all websocket messages
    this.setupMessageListener();
  }
  
  /**
   * Listen for WebSocket messages
   */
  private setupMessageListener(): void {
    // We need to re-implement this with your actual WebSocket listening approach
    // Since your ChatService doesn't expose a generic message observable,
    // we need to listen for specific events using your system
    
    // Create a listener for WebSocket messages
    // This is based on your existing websocket infrastructure
    const onMessageCallback = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    // Since we don't have direct access to the raw socket events through your ChatService,
    // we'll need to handle specific room events individually
    
    // Override the ChatService's socket.onmessage handler to include our handler
    // (NOTE: In a real implementation, you should modify ChatService to provide a message$ observable)
    // This is just a placeholder for the implementation
    
    console.log('WebSocket listeners set up');
  }
  
  /**
   * Handle WebSocket messages related to listening rooms
   */
  private handleWebSocketMessage(data: any): void {
    if (!data || !data.type) return;
    
    switch (data.type) {
      case 'room_created':
        this.handleRoomCreated(data.room);
        break;
        
      case 'room_joined':
        this.handleRoomJoined(data.room);
        break;
        
      case 'member_joined':
        this.handleMemberJoined(data.roomId, data.userId);
        break;
        
      case 'member_left':
        this.handleMemberLeft(data.roomId, data.userId, data.newCreatorId);
        break;
        
      case 'room_updated':
        this.handleRoomUpdated(data.room);
        break;
        
      case 'room_sync':
        this.handleRoomSync(data);
        break;
        
      case 'user_rooms':
        this.handleUserRooms(data.rooms);
        break;
        
      case 'room_invitation':
        this.handleRoomInvitation(data);
        break;
        
      case 'room_left':
        this.handleRoomLeft(data.roomId);
        break;
    }
  }
  
  /**
   * Create a new listening room
   */
  createRoom(trackId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('Cannot create room: WebSocket not connected');
      return;
    }
    
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.error('Cannot create room: User not authenticated');
      return;
    }
    
    // Send create room message
    const message = {
      type: 'create_room',
      trackId
    };
    
    this.sendWebSocketMessage(message);
  }
  
  /**
   * Join an existing listening room
   */
  joinRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('Cannot join room: WebSocket not connected');
      return;
    }
    
    this.isJoiningSubject.next(true);
    
    const message = {
      type: 'join_room',
      roomId
    };
    
    this.sendWebSocketMessage(message);
  }
  
  /**
   * Leave the current listening room
   */
  leaveRoom(): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    const message = {
      type: 'leave_room',
      roomId: currentRoom.id,
      creatorId: currentRoom.creatorId // Include creator ID to handle ownership transfer
    };
    
    this.sendWebSocketMessage(message);
    
    // Clean up locally
    this.cleanupRoom();
  }
  
  /**
   * Clean up when leaving a room
   */
  private cleanupRoom(): void {
    // Stop playback
    this.audiusService.pause();
    
    // Clear room data
    this.currentRoomSubject.next(null);
    this.roomMembersSubject.next([]);
    
    // Stop sync checking
    this.stopSyncChecking();
    
    // Unsubscribe from music events
    if (this.musicEventSub) {
      this.musicEventSub.unsubscribe();
      this.musicEventSub = null;
    }
    
    // Unsubscribe from playback state
    if (this.playbackStateSub) {
      this.playbackStateSub.unsubscribe();
      this.playbackStateSub = null;
    }
  }
  
  /**
   * Update the room state (play/pause/seek)
   */
  updateRoomState(state?: 'playing' | 'paused', progress?: number, trackId?: string): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    const currentUserId = this.getCurrentUserId();
    
    // Only the host can update the room state
    // Or if it's a new track, any member can update it
    if (currentRoom.creatorId !== currentUserId && !trackId) {
      console.warn('Only the host can update the room state');
      return;
    }
    
    // Mark this as a local update to prevent loop
    this.isLocalUpdateSubject.next(true);
    
    const update: any = {
      type: 'room_update',
      roomId: currentRoom.id
    };
    
    if (state !== undefined) update.state = state;
    if (progress !== undefined) update.progress = progress;
    if (trackId !== undefined) update.trackId = trackId;
    
    this.sendWebSocketMessage(update);
  }
  
  /**
   * Play the current track
   */
  play(): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom || !currentRoom.trackId) return;
    
    // If the user is the host, update the room state
    const isHost = currentRoom.creatorId === this.getCurrentUserId();
    
    if (isHost) {
      const currentPosition = this.audiusService.getPlaybackState().position;
      this.updateRoomState('playing', currentPosition);
    }
    
    // Directly play the track
    if (this.audiusService.getPlaybackState().trackId !== currentRoom.trackId) {
      this.audiusService.play(currentRoom.trackId);
    } else {
      this.audiusService.play(currentRoom.trackId);
    }
  }
  
  /**
   * Pause the current track
   */
  pause(): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    // If the user is the host, update the room state
    const isHost = currentRoom.creatorId === this.getCurrentUserId();
    
    if (isHost) {
      const currentPosition = this.audiusService.getPlaybackState().position;
      this.updateRoomState('paused', currentPosition);
    }
    
    // Directly pause the track
    this.audiusService.pause();
  }
  
  /**
   * Seek to a specific position
   */
  seekTo(position: number): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    // If the user is the host, update the room state
    const isHost = currentRoom.creatorId === this.getCurrentUserId();
    
    if (isHost) {
      this.updateRoomState(currentRoom.state, position);
    }
    
    // Directly seek to the position
    this.audiusService.seekTo(position);
  }
  
  /**
   * Change the track in the current room
   */
  changeTrack(trackId: string): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    // Update the room state with the new track
    this.updateRoomState(undefined, 0, trackId);
    
    // Set this flag to prevent loop of updates
    this.isLocalUpdateSubject.next(true);
    
    // Start playing the new track
    this.audiusService.play(trackId);
  }
  
  /**
   * Invite a user to the current room
   */
  inviteToRoom(userId: string): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    const message = {
      type: 'room_invitation',
      roomId: currentRoom.id,
      inviteeId: userId
    };
    
    this.sendWebSocketMessage(message);
  }
  
  /**
   * Get all rooms the current user is in
   */
  getUserRooms(): void {
    if (!this.chatService.isConnected()) {
      console.warn('Cannot get user rooms: WebSocket not connected');
      return;
    }
    
    const message = {
      type: 'get_user_rooms'
    };
    
    this.sendWebSocketMessage(message);
  }
  
  /**
   * Request sync information for a room
   */
  requestRoomSync(roomId: string): void {
    if (!this.chatService.isConnected()) {
      console.warn('Cannot request sync: WebSocket not connected');
      return;
    }
    
    const message = {
      type: 'sync_request',
      roomId
    };
    
    this.sendWebSocketMessage(message);
  }
  
  /**
   * Handle room created event
   */
  private handleRoomCreated(room: ListeningRoom): void {
    console.log('Room created:', room);
    
    // Update the current room
    this.currentRoomSubject.next(room);
    
    // Add room to rooms list
    const currentRooms = this.roomsSubject.getValue();
    this.roomsSubject.next([...currentRooms, room]);
    
    // Setup room members
    this.updateRoomMembers(room);
    
    // Start sync checking
    this.startSyncChecking();
    
    // Start listening for music events
    this.listenForMusicEvents();
    
    // Start listening for playback state changes
    this.listenForPlaybackChanges();
    
    // Start playing the track
    if (room.trackId) {
      this.audiusService.play(room.trackId);
      
      // If the room is paused, we should also pause
      if (room.state === 'paused') {
        this.audiusService.pause();
      }
    }
    
    // Reset joining state
    this.isJoiningSubject.next(false);
  }
  
  /**
   * Handle room joined event
   */
  private handleRoomJoined(room: ListeningRoom): void {
    console.log('Room joined:', room);
    
    // Update the current room
    this.currentRoomSubject.next(room);
    
    // Update room members
    this.updateRoomMembers(room);
    
    // Start sync checking
    this.startSyncChecking();
    
    // Start listening for music events
    this.listenForMusicEvents();
    
    // Start listening for playback state changes
    this.listenForPlaybackChanges();
    
    // Sync with the room state
    this.syncWithRoomState(room);
    
    // Reset joining state
    this.isJoiningSubject.next(false);
  }
  
  /**
   * Handle member joined event
   */
  private handleMemberJoined(roomId: string, userId: string): void {
    console.log('Member joined:', userId, 'to room:', roomId);
    
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    // Update the room with the new member
    const updatedRoom = {
      ...currentRoom,
      members: [...currentRoom.members, userId]
    };
    
    // Update current room
    this.currentRoomSubject.next(updatedRoom);
    
    // Update room members
    this.updateRoomMembers(updatedRoom);
  }
  
  /**
   * Handle member left event
   */
  private handleMemberLeft(roomId: string, userId: string, newCreatorId?: string): void {
    console.log('Member left:', userId, 'from room:', roomId);
    
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    // Update the room by removing the member
    const updatedRoom = {
      ...currentRoom,
      members: currentRoom.members.filter(id => id !== userId),
      // If there was a creator change, update that too
      creatorId: newCreatorId || currentRoom.creatorId
    };
    
    // Update current room
    this.currentRoomSubject.next(updatedRoom);
    
    // Update room members
    this.updateRoomMembers(updatedRoom);
  }
  
  /**
   * Handle room updated event
   */
  private handleRoomUpdated(room: ListeningRoom): void {
    console.log('Room updated:', room);
    
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom || currentRoom.id !== room.id) return;
    
    // Check if this is a local update (we initiated the change)
    const isLocalUpdate = this.isLocalUpdateSubject.getValue();
    if (isLocalUpdate) {
      // Reset the flag
      this.isLocalUpdateSubject.next(false);
      return;
    }
    
    // Update room state
    this.currentRoomSubject.next(room);
    
    // Sync with the new room state
    this.syncWithRoomState(room);
  }
  
  /**
   * Handle room sync event
   */
  private handleRoomSync(data: any): void {
    console.log('Room sync:', data);
    
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom || currentRoom.id !== data.roomId) return;
    
    // Create a room object from sync data
    const roomFromSync: ListeningRoom = {
      id: data.roomId,
      creatorId: currentRoom.creatorId, // Keep existing creator ID
      trackId: data.trackId || currentRoom.trackId,
      state: data.state || currentRoom.state,
      progress: data.progress || 0,
      timestamp: new Date().getTime(),
      members: currentRoom.members // Keep existing members
    };
    
    // Update room state
    this.currentRoomSubject.next(roomFromSync);
    
    // Sync with the room state
    this.syncWithRoomState(roomFromSync);
  }
  
  /**
   * Handle user rooms event
   */
  private handleUserRooms(rooms: ListeningRoom[]): void {
    console.log('User rooms:', rooms);
    
    // Update rooms list
    this.roomsSubject.next(rooms);
  }
  
  /**
   * Handle room invitation event
   */
  private handleRoomInvitation(data: any): void {
    console.log('Room invitation:', data);
    
    // Here you could show a notification to the user
    // For now we'll just log it
  }
  
  /**
   * Handle room left event
   */
  private handleRoomLeft(roomId: string): void {
    console.log('Left room:', roomId);
    
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom || currentRoom.id !== roomId) return;
    
    // Clean up when leaving a room
    this.cleanupRoom();
  }
  
  /**
   * Sync the local player with the room state
   */
  private syncWithRoomState(room: ListeningRoom): void {
    if (!room.trackId) return;
    
    const currentPlaybackState = this.audiusService.getPlaybackState();
    
    // Check if we need to change tracks
    if (currentPlaybackState.trackId !== room.trackId) {
      console.log('Changing track to:', room.trackId);
      this.audiusService.play(room.trackId);
    }
    
    // Calculate current progress based on timestamp
    let adjustedProgress = room.progress;
    if (room.state === 'playing') {
      const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
      adjustedProgress = room.progress + elapsedSeconds;
    }
    
    // Check if we need to seek
    const progressDiff = Math.abs(currentPlaybackState.position - adjustedProgress);
    if (progressDiff > 3) { // More than 3 seconds difference
      console.log('Seeking to:', adjustedProgress);
      this.audiusService.seekTo(adjustedProgress);
    }
    
    // Check if we need to change playback state
    if (room.state === 'playing' && !currentPlaybackState.isPlaying) {
      console.log('Playing');
      this.audiusService.play(room.trackId);
    } else if (room.state === 'paused' && currentPlaybackState.isPlaying) {
      console.log('Pausing');
      this.audiusService.pause();
    }
  }
  
  /**
   * Check synchronization status
   */
  private checkSyncStatus(): void {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return;
    
    const currentPlaybackState = this.audiusService.getPlaybackState();
    
    // Calculate expected progress
    let expectedProgress = currentRoom.progress;
    if (currentRoom.state === 'playing') {
      const elapsedSeconds = (Date.now() - currentRoom.timestamp) / 1000;
      expectedProgress = currentRoom.progress + elapsedSeconds;
    }
    
    // Calculate difference
    const progressDiff = Math.abs(currentPlaybackState.position - expectedProgress);
    
    // Update sync status
    const inSync = progressDiff < (this.syncThresholdMs / 1000); // Convert ms to seconds
    this.syncStatusSubject.next({
      inSync,
      offset: progressDiff
    });
    
    // Auto-sync if needed
    if (!inSync) {
      console.log('Out of sync, difference:', progressDiff, 'seconds. Re-syncing...');
      this.syncWithRoomState(currentRoom);
    }
  }
  
  /**
   * Start checking sync status periodically
   */
  private startSyncChecking(): void {
    this.stopSyncChecking(); // Clean up existing interval if any
    
    this.syncCheckInterval = interval(this.syncCheckIntervalMs).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.checkSyncStatus();
    });
  }
  
  /**
   * Stop checking sync status
   */
  private stopSyncChecking(): void {
    if (this.syncCheckInterval) {
      this.syncCheckInterval.unsubscribe();
      this.syncCheckInterval = null;
    }
  }
  
  /**
   * Update room members
   */
  private updateRoomMembers(room: ListeningRoom): void {
    if (!room) return;
    
    // Convert member IDs to member objects
    const members: RoomMember[] = room.members.map(memberId => ({
      id: memberId,
      isOnline: true, // Assume all members are online
      isHost: memberId === room.creatorId
    }));
    
    this.roomMembersSubject.next(members);
  }
  
  /**
   * Listen for music events (play, pause, seek) from the local player
   */
  private listenForMusicEvents(): void {
    if (this.musicEventSub) {
      this.musicEventSub.unsubscribe();
    }
    
    this.musicEventSub = this.audiusService.musicEvent$.pipe(
      takeUntil(this.destroy$),
      debounceTime(200) // Debounce to prevent rapid firing
    ).subscribe(event => {
      const currentRoom = this.currentRoomSubject.getValue();
      if (!currentRoom) return;
      
      // Only the room creator can update the room state
      const isCreator = currentRoom.creatorId === this.getCurrentUserId();
      if (!isCreator) return;
      
      // Skip if this was triggered by a remote update
      const isLocalUpdate = this.isLocalUpdateSubject.getValue();
      if (isLocalUpdate) {
        this.isLocalUpdateSubject.next(false);
        return;
      }
      
      // Update room state based on event
      switch (event.eventType) {
        case 'play':
          this.updateRoomState('playing', event.position);
          break;
          
        case 'pause':
          this.updateRoomState('paused', event.position);
          break;
          
        case 'seek':
          this.updateRoomState(currentRoom.state, event.position);
          break;
      }
    });
  }
  
  /**
   * Listen for playback state changes
   */
  private listenForPlaybackChanges(): void {
    if (this.playbackStateSub) {
      this.playbackStateSub.unsubscribe();
    }
    
    this.playbackStateSub = this.audiusService.playbackState$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300) // Debounce to prevent rapid firing
    ).subscribe(state => {
      const currentRoom = this.currentRoomSubject.getValue();
      if (!currentRoom) return;
      
      // Only the room creator can update the room state
      const isCreator = currentRoom.creatorId === this.getCurrentUserId();
      if (!isCreator) return;
      
      // Skip if this was triggered by a remote update
      const isLocalUpdate = this.isLocalUpdateSubject.getValue();
      if (isLocalUpdate) {
        this.isLocalUpdateSubject.next(false);
        return;
      }
      
      // Update room state if track changed
      if (state.trackId && state.trackId !== currentRoom.trackId) {
        this.updateRoomState(state.isPlaying ? 'playing' : 'paused', state.position, state.trackId);
      }
    });
  }
  
  /**
   * Send a message through the WebSocket
   */
  private sendWebSocketMessage(message: any): void {
    // We don't have direct access to your websocket.send() method,
    // so we need to use your ChatService's approach
    
    // THIS NEEDS TO BE REPLACED WITH YOUR ACTUAL WEBSOCKET SEND METHOD
    // For example, if your ChatService has a method to send custom messages:
    
    const socket = this.getWebSocketInstance();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message: WebSocket not connected');
    }
  }
  
  /**
   * Get the WebSocket instance
   * This is a placeholder and needs to be replaced with your actual implementation
   */
  private getWebSocketInstance(): WebSocket | null {
    // This function should return the WebSocket instance from your ChatService
    // Since we don't have direct access to it based on your provided code,
    // we need a way to access the underlying WebSocket
    
    // PLACEHOLDER: Replace with your actual method to get the WebSocket
    return null;
  }
  
  /**
   * Get the current user ID
   */
  private getCurrentUserId(): string | null {
    let userId: string | null = null;
    
    // Get user ID from AuthService
    this.authService.currentUser$.pipe(
      take(1)
    ).subscribe(user => {
      userId = user?.id || null;
    });
    
    return userId;
  }
  
  /**
   * Check if the current user is the host
   */
  isHost(): boolean {
    const currentRoom = this.currentRoomSubject.getValue();
    if (!currentRoom) return false;
    
    const userId = this.getCurrentUserId();
    return currentRoom.creatorId === userId;
  }
  
  /**
   * Get a more accurate room state that takes into account elapsed time
   */
  getCurrentRoomState(): ListeningRoom | null {
    const room = this.currentRoomSubject.getValue();
    if (!room) return null;
    
    // If the room is playing, calculate the current progress
    if (room.state === 'playing') {
      const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
      return {
        ...room,
        progress: room.progress + elapsedSeconds
      };
    }
    
    return room;
  }
}