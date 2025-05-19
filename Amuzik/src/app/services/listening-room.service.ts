import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';

// Interfaces para las salas de escucha
export interface ListeningRoom {
  id: string;
  creatorId: string;
  trackId: string;
  state: 'playing' | 'paused';
  progress: number;
  timestamp: number;
  members: string[];
}

export interface RoomEvent {
  type: string;
  roomId: string;
  userId?: string;
  newCreatorId?: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ListeningRoomService {
  // BehaviorSubject para la sala actual
  private currentRoomSubject = new BehaviorSubject<ListeningRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  // BehaviorSubject para todas las salas del usuario
  private userRoomsSubject = new BehaviorSubject<ListeningRoom[]>([]);
  public userRooms$ = this.userRoomsSubject.asObservable();

  // Subject para eventos de sala (unirse, salir, etc.)
  private roomEventsSubject = new Subject<RoomEvent>();
  public roomEvents$ = this.roomEventsSubject.asObservable();

  // Subject para errores específicos de las salas
  private roomErrorsSubject = new Subject<string>();
  public roomErrors$ = this.roomErrorsSubject.asObservable();

  // Controlador de audio para sincronización de reproducción
  private audioElement: HTMLAudioElement | null = null;
  private syncInterval: any = null;
  private lastSyncTime: number = 0;
  private syncThreshold: number = 5000; // 5 segundos entre sincronizaciones

  // Flag para evitar bucles de eventos
  private isUpdatingAudio: boolean = false;

  constructor(
    private authService: AuthService,
    private chatService: ChatService
  ) {
    // Suscribirse a mensajes del WebSocket para manejar eventos de sala
    this.setupWebSocketListeners();

    // Recuperar sala actual del localStorage si existe
    this.loadCurrentRoomFromStorage();
  }

  /**
   * Configurar los listeners para mensajes WebSocket relacionados con salas
   */
  private setupWebSocketListeners(): void {
    // Obtener el socket del ChatService para escuchar eventos
    const socket = this.chatService.getSocket();
    
    if (socket) {
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Manejar diferentes tipos de mensajes relacionados con salas
          switch (data.type) {
            case 'room_created':
              this.handleRoomCreated(data.room);
              break;
            case 'room_joined':
              this.handleRoomJoined(data.room);
              break;
            case 'room_left':
              this.handleRoomLeft(data.roomId);
              break;
            case 'room_updated':
              this.handleRoomUpdated(data.room);
              break;
            case 'member_joined':
              this.handleMemberJoined(data);
              break;
            case 'member_left':
              this.handleMemberLeft(data);
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
          }
        } catch (error) {
          console.error('Error al procesar mensaje de sala:', error);
        }
      });
    }

    // Suscribirse a cambios en el estado de conexión
    this.chatService.connectionStatus$.subscribe((status) => {
      if (status.isConnected) {
        // Si se conecta, solicitar salas del usuario
        this.getUserRooms();
        
        // Si hay una sala actual, intentar sincronizarla
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom) {
          this.requestRoomSync(currentRoom.id);
        }
      }
    });
  }

  /**
   * Carga la sala actual desde el almacenamiento local si existe
   */
  private loadCurrentRoomFromStorage(): void {
    try {
      const storedRoom = localStorage.getItem('current_listening_room');
      if (storedRoom) {
        const room = JSON.parse(storedRoom);
        this.currentRoomSubject.next(room);
        
        // Si la sala existe y estamos conectados, solicitar sincronización
        if (this.chatService.isConnected()) {
          this.requestRoomSync(room.id);
        }
      }
    } catch (error) {
      console.error('Error al cargar sala desde localStorage:', error);
    }
  }

  /**
   * Guarda la sala actual en el almacenamiento local
   */
  private saveCurrentRoomToStorage(room: ListeningRoom | null): void {
    if (room) {
      localStorage.setItem('current_listening_room', JSON.stringify(room));
    } else {
      localStorage.removeItem('current_listening_room');
    }
  }

  /**
   * Solicita todas las salas del usuario al servidor
   */
  getUserRooms(): void {
    if (!this.chatService.isConnected()) {
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'get_user_rooms'
    });
  }

  /**
   * Crea una nueva sala de escucha
   */
  createRoom(trackId: string): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'create_room',
      trackId
    });
  }

  /**
   * Envía una invitación a un usuario para unirse a la sala
   */
  inviteToRoom(roomId: string, inviteeId: string): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'room_invitation',
      roomId,
      inviteeId
    });
  }

  /**
   * Se une a una sala existente
   */
  joinRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'join_room',
      roomId
    });
  }

  /**
   * Sale de la sala actual
   */
  leaveRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'leave_room',
      roomId
    });

    // Si es la sala actual, limpiarla
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && currentRoom.id === roomId) {
      this.clearCurrentRoom();
    }
  }

  /**
   * Actualiza el estado de la sala (play/pause)
   */
  updateRoomState(roomId: string, state: 'playing' | 'paused', progress: number): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'room_update',
      roomId,
      state,
      progress
    });
  }

  /**
   * Cambia la canción que se está reproduciendo
   */
  changeTrack(roomId: string, trackId: string): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'room_update',
      roomId,
      trackId,
      state: 'paused',
      progress: 0
    });
  }

  /**
   * Solicita sincronización con el estado actual de la sala
   */
  requestRoomSync(roomId: string): void {
    if (!this.chatService.isConnected()) {
      this.roomErrorsSubject.next('No conectado al servidor. Reconectando...');
      this.chatService.connect();
      return;
    }

    this.chatService.sendCustomMessage({
      type: 'sync_request',
      roomId
    });
  }

  /**
   * Maneja la creación de una nueva sala
   */
  private handleRoomCreated(room: ListeningRoom): void {
    // Actualizar la sala actual
    this.currentRoomSubject.next(room);
    this.saveCurrentRoomToStorage(room);
    
    // Añadir a las salas del usuario
    const currentRooms = this.userRoomsSubject.value;
    this.userRoomsSubject.next([...currentRooms, room]);
    
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'created',
      roomId: room.id,
      timestamp: new Date()
    });
  }

  /**
   * Maneja la unión a una sala
   */
  private handleRoomJoined(room: ListeningRoom): void {
    // Actualizar la sala actual
    this.currentRoomSubject.next(room);
    this.saveCurrentRoomToStorage(room);
    
    // Actualizar las salas del usuario
    const currentRooms = this.userRoomsSubject.value;
    const roomIndex = currentRooms.findIndex(r => r.id === room.id);
    
    if (roomIndex >= 0) {
      const updatedRooms = [...currentRooms];
      updatedRooms[roomIndex] = room;
      this.userRoomsSubject.next(updatedRooms);
    } else {
      this.userRoomsSubject.next([...currentRooms, room]);
    }
    
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'joined',
      roomId: room.id,
      timestamp: new Date()
    });
    
    // Iniciar sincronización de audio
    this.setupAudioSync(room);
  }

  /**
   * Maneja la salida de una sala
   */
  private handleRoomLeft(roomId: string): void {
    // Si es la sala actual, limpiarla
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && currentRoom.id === roomId) {
      this.clearCurrentRoom();
    }
    
    // Actualizar las salas del usuario
    const currentRooms = this.userRoomsSubject.value;
    this.userRoomsSubject.next(currentRooms.filter(r => r.id !== roomId));
    
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'left',
      roomId,
      timestamp: new Date()
    });
  }

  /**
   * Maneja la actualización de una sala
   */
  private handleRoomUpdated(room: ListeningRoom): void {
    // Verificar si es la sala actual
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && currentRoom.id === room.id) {
      this.currentRoomSubject.next(room);
      this.saveCurrentRoomToStorage(room);
      
      // Sincronizar el reproductor de audio
      this.synchronizeAudioPlayer(room);
    }
    
    // Actualizar en la lista de salas del usuario
    const currentRooms = this.userRoomsSubject.value;
    const updatedRooms = currentRooms.map(r => r.id === room.id ? room : r);
    this.userRoomsSubject.next(updatedRooms);
    
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'updated',
      roomId: room.id,
      timestamp: new Date()
    });
  }

  /**
   * Maneja la respuesta de sincronización de sala
   */
  private handleRoomSync(data: any): void {
    const currentRoom = this.currentRoomSubject.value;
    
    if (currentRoom && currentRoom.id === data.roomId) {
      // Actualizar la sala con los datos sincronizados
      const syncedRoom: ListeningRoom = {
        ...currentRoom,
        state: data.state,
        progress: data.progress,
        trackId: data.trackId,
        timestamp: Date.now()
      };
      
      this.currentRoomSubject.next(syncedRoom);
      this.saveCurrentRoomToStorage(syncedRoom);
      
      // Sincronizar el reproductor de audio
      this.synchronizeAudioPlayer(syncedRoom);
    }
  }

  /**
   * Maneja la unión de un miembro a la sala
   */
  private handleMemberJoined(data: any): void {
    // Actualizar la sala actual si es la misma
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && currentRoom.id === data.roomId) {
      // Solicitar sincronización para obtener datos actualizados
      this.requestRoomSync(data.roomId);
    }
    
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'member_joined',
      roomId: data.roomId,
      userId: data.userId,
      timestamp: new Date(data.timestamp)
    });
  }

  /**
   * Maneja la salida de un miembro de la sala
   */
  private handleMemberLeft(data: any): void {
    // Actualizar la sala actual si es la misma
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && currentRoom.id === data.roomId) {
      // Si cambió el creador, actualizar
      if (data.newCreatorId) {
        const updatedRoom = {
          ...currentRoom,
          creatorId: data.newCreatorId,
          members: currentRoom.members.filter(id => id !== data.userId)
        };
        
        this.currentRoomSubject.next(updatedRoom);
        this.saveCurrentRoomToStorage(updatedRoom);
      } else {
        // Solo actualizar la lista de miembros
        const updatedRoom = {
          ...currentRoom,
          members: currentRoom.members.filter(id => id !== data.userId)
        };
        
        this.currentRoomSubject.next(updatedRoom);
        this.saveCurrentRoomToStorage(updatedRoom);
      }
    }
    
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'member_left',
      roomId: data.roomId,
      userId: data.userId,
      newCreatorId: data.newCreatorId,
      timestamp: new Date(data.timestamp)
    });
  }

  /**
   * Maneja la lista de salas de usuario
   */
  private handleUserRooms(rooms: ListeningRoom[]): void {
    this.userRoomsSubject.next(rooms);
  }

  /**
   * Maneja una invitación recibida para unirse a una sala
   */
  private handleRoomInvitation(data: any): void {
    // Emitir evento
    this.roomEventsSubject.next({
      type: 'invitation',
      roomId: data.roomId,
      userId: data.inviterId,
      timestamp: new Date(data.timestamp)
    });
  }

  /**
   * Configura la sincronización de audio para una sala
   */
  private setupAudioSync(room: ListeningRoom): void {
    // Detener cualquier sincronización existente
    this.stopAudioSync();
    
    // Iniciar sincronización periódica
    this.syncInterval = setInterval(() => {
      // Solo sincronizar si han pasado más del umbral desde la última vez
      const now = Date.now();
      if (now - this.lastSyncTime >= this.syncThreshold) {
        this.requestRoomSync(room.id);
        this.lastSyncTime = now;
      }
    }, 15000); // Verificar cada 15 segundos
  }

  /**
   * Detiene la sincronización de audio
   */
  private stopAudioSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Establece el elemento de audio a sincronizar
   */
  setAudioElement(audioElement: HTMLAudioElement): void {
    this.audioElement = audioElement;
    
    if (this.audioElement) {
      // Configurar eventos para detectar cambios en el reproductor
      this.audioElement.addEventListener('play', () => this.handleAudioPlay());
      this.audioElement.addEventListener('pause', () => this.handleAudioPause());
      this.audioElement.addEventListener('seeked', () => this.handleAudioSeeked());
      
      // Sincronizar con el estado actual si hay una sala
      const currentRoom = this.currentRoomSubject.value;
      if (currentRoom) {
        this.synchronizeAudioPlayer(currentRoom);
      }
    }
  }

  /**
   * Sincroniza el reproductor de audio con el estado de la sala
   */
  private synchronizeAudioPlayer(room: ListeningRoom): void {
    if (!this.audioElement || this.isUpdatingAudio) return;
    
    this.isUpdatingAudio = true;
    
    try {
      // Calcular progreso actual considerando el tiempo transcurrido
      let currentProgress = room.progress;
      if (room.state === 'playing') {
        const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
        currentProgress = room.progress + elapsedSeconds;
      }
      
      // Actualizar posición si la diferencia es significativa (más de 1 segundo)
      const currentTime = this.audioElement.currentTime;
      if (Math.abs(currentTime - currentProgress) > 1) {
        this.audioElement.currentTime = currentProgress;
      }
      
      // Actualizar estado (play/pause)
      if (room.state === 'playing' && this.audioElement.paused) {
        this.audioElement.play().catch(err => {
          console.error('Error al reproducir audio:', err);
        });
      } else if (room.state === 'paused' && !this.audioElement.paused) {
        this.audioElement.pause();
      }
    } finally {
      setTimeout(() => {
        this.isUpdatingAudio = false;
      }, 200);
    }
  }

  /**
   * Maneja el evento de reproducción de audio
   */
  private handleAudioPlay(): void {
    if (this.isUpdatingAudio) return;
    
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && this.audioElement) {
      this.updateRoomState(currentRoom.id, 'playing', this.audioElement.currentTime);
    }
  }

  /**
   * Maneja el evento de pausa de audio
   */
  private handleAudioPause(): void {
    if (this.isUpdatingAudio) return;
    
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && this.audioElement) {
      this.updateRoomState(currentRoom.id, 'paused', this.audioElement.currentTime);
    }
  }

  /**
   * Maneja el evento de búsqueda en el audio
   */
  private handleAudioSeeked(): void {
    if (this.isUpdatingAudio) return;
    
    const currentRoom = this.currentRoomSubject.value;
    if (currentRoom && this.audioElement) {
      this.updateRoomState(
        currentRoom.id, 
        this.audioElement.paused ? 'paused' : 'playing',
        this.audioElement.currentTime
      );
    }
  }

  /**
   * Limpia la sala actual y detiene la sincronización
   */
  private clearCurrentRoom(): void {
    this.currentRoomSubject.next(null);
    this.saveCurrentRoomToStorage(null);
    this.stopAudioSync();
    
    // Detener audio si está reproduciéndose
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
    }
  }

  /**
   * Verifica si el usuario actual es el creador de la sala
   */
  isRoomCreator(room: ListeningRoom): boolean {
    let isCreator = false;
    
    // Esta suscripción se ejecuta de forma síncrona porque BehaviorSubject emite inmediatamente
    this.authService.currentUser$
      .subscribe(user => {
        isCreator = user?.id === room.creatorId;
      })
      .unsubscribe();
    
    return isCreator;
  }

  /**
   * Obtener el número de miembros en una sala
   */
  getRoomMemberCount(roomId: string): number {
    const room = this.userRoomsSubject.value.find(r => r.id === roomId);
    return room ? room.members.length : 0;
  }

  /**
   * Maneja la limpieza al destruir el servicio
   */
  ngOnDestroy() {
    this.stopAudioSync();
    if (this.audioElement) {
      this.audioElement.removeEventListener('play', () => this.handleAudioPlay());
      this.audioElement.removeEventListener('pause', () => this.handleAudioPause());
      this.audioElement.removeEventListener('seeked', () => this.handleAudioSeeked());
      this.audioElement = null;
    }
  }
}