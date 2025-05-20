import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ChatService } from './chat.service';
import {
  AudiusFacade,
  MusicEvent,
  TrackMetadata,
} from '../services/facades/audius.facade';

// Interfaces para room
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
  type:
    | 'created'
    | 'joined'
    | 'left'
    | 'updated'
    | 'member_joined'
    | 'member_left'
    | 'invitation';
  room?: ListeningRoom;
  userId?: string;
  inviterId?: string;
  trackId?: string;
  message?: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ListeningRoomService {
  // BehaviorSubject para salas activas
  private activeRoomsSubject = new BehaviorSubject<ListeningRoom[]>([]);
  public activeRooms$ = this.activeRoomsSubject.asObservable();

  // BehaviorSubject para sala actual
  private currentRoomSubject = new BehaviorSubject<ListeningRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  // Subject para eventos de sala
  private roomEventSubject = new Subject<RoomEvent>();
  public roomEvent$ = this.roomEventSubject.asObservable();

  // BehaviorSubject para invitaciones pendientes
  private pendingInvitationsSubject = new BehaviorSubject<RoomEvent[]>([]);
  public pendingInvitations$ = this.pendingInvitationsSubject.asObservable();

  // Flag para sincronización
  private isSyncing = false;
  private lastSyncTimestamp = 0;
  private syncThreshold = 5; // segundos

  constructor(
    private chatService: ChatService,
    private audiusFacade: AudiusFacade
  ) {
    // Escuchar mensajes del WebSocket relacionados con rooms
    this.setupWebSocketListeners();

    // Suscribirse a eventos de música para sincronizar
    this.setupMusicEventListeners();

    // Obtener salas al iniciar el servicio
    this.getUserRooms();
  }

  /**
   * Configura los listeners para websocket
   */
  private setupWebSocketListeners(): void {
    // Asegurarnos de que tenemos acceso al socket
    const socket = this.chatService.getSocket();

    if (!socket) {
      console.error('No hay conexión WebSocket disponible');
      // Intentar reconectar y configurar después
      this.chatService.connectionStatus$.subscribe((status) => {
        if (status.isConnected) {
          // Cuando se conecte, intentar configurar de nuevo
          this.setupWebSocketListeners();
        }
      });
      return;
    }

    // Escuchar mensajes del websocket
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        // Solo procesar mensajes relacionados con salas de escucha
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
            this.handleMemberJoined(data.roomId, data.userId);
            break;

          case 'member_left':
            this.handleMemberLeft(data.roomId, data.userId, data.newCreatorId);
            break;

          case 'room_invitation':
            this.handleRoomInvitation(data);
            break;

          case 'room_sync':
            this.handleRoomSync(data);
            break;

          case 'user_rooms':
            this.handleUserRoomsResponse(data.rooms);
            break;
        }
      } catch (error) {
        console.error('Error al procesar mensaje de WebSocket:', error);
      }
    });
  }

  /**
   * Configura los listeners para eventos de música
   */
  private setupMusicEventListeners(): void {
    // Escuchar eventos de reproducción para sincronizar con la sala
    this.audiusFacade.musicEvent$.subscribe((event: MusicEvent) => {
      // Solo sincronizar si estamos en una sala
      const currentRoom = this.currentRoomSubject.getValue();
      if (!currentRoom || this.isSyncing) return;

      // Procesar según tipo de evento
      switch (event.eventType) {
        case 'play':
          this.updateRoomState(currentRoom.id, 'playing', event.position);
          break;

        case 'pause':
          this.updateRoomState(currentRoom.id, 'paused', event.position);
          break;

        case 'seek':
          this.updateRoomState(
            currentRoom.id,
            currentRoom.state,
            event.position
          );
          break;
      }
    });

    // Escuchar cambios de pista para actualizar la sala
    this.audiusFacade.getCurrentTrackId().subscribe((trackId) => {
      const currentRoom = this.currentRoomSubject.getValue();
      if (!currentRoom || this.isSyncing || !trackId) return;

      // Actualizar la pista de la sala si ha cambiado
      if (currentRoom.trackId !== trackId) {
        this.updateRoomTrack(currentRoom.id, trackId);
      }
    });
  }

  /**
   * Obtiene las salas a las que pertenece el usuario
   */
  getUserRooms(): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'get_user_rooms',
    });
  }

  /**
   * Crea una nueva sala de escucha
   */
  createRoom(trackId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'create',
      trackId,
    });
  }

  /**
   * Invita a un usuario a una sala
   */
  inviteToRoom(roomId: string, inviteeId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'invite',
      roomId,
      inviteeId,
    });
  }

  /**
   * Se une a una sala de escucha
   */
  joinRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'join',
      roomId,
    });
  }

  /**
   * Sale de una sala de escucha
   */
  leaveRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    const currentRoom = this.currentRoomSubject.getValue();

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'leave',
      roomId,
      creatorId: currentRoom?.creatorId,
    });

    // Si la sala actual es la que estamos dejando, limpiar estado
    if (currentRoom && currentRoom.id === roomId) {
      this.currentRoomSubject.next(null);
    }
  }

  /**
   * Actualiza el estado de reproducción de una sala
   */
  updateRoomState(
    roomId: string,
    state: 'playing' | 'paused',
    progress: number
  ): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'update',
      roomId,
      state,
      progress,
    });
  }

  /**
   * Actualiza la pista de una sala
   */
  updateRoomTrack(roomId: string, trackId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'update',
      roomId,
      trackId,
    });
  }

  /**
   * Solicita sincronización con el estado actual de la sala
   */
  syncWithRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      console.error('No hay conexión WebSocket');
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'sync',
      roomId,
    });
  }

  /**
   * Acepta una invitación a una sala
   */
  acceptInvitation(invitation: RoomEvent): void {
    // Primero, unirse a la sala
    this.joinRoom(invitation.room!.id);

    // Eliminar la invitación de las pendientes
    this.removePendingInvitation(invitation);
  }

  /**
   * Rechaza una invitación a una sala
   */
  declineInvitation(invitation: RoomEvent): void {
    // Solo eliminar la invitación de las pendientes
    this.removePendingInvitation(invitation);
  }

  /**
   * Elimina una invitación pendiente
   */
  private removePendingInvitation(invitation: RoomEvent): void {
    const currentInvitations = this.pendingInvitationsSubject.getValue();
    const updatedInvitations = currentInvitations.filter(
      (inv) =>
        !(
          inv.room?.id === invitation.room?.id &&
          inv.inviterId === invitation.inviterId
        )
    );
    this.pendingInvitationsSubject.next(updatedInvitations);
  }

  /**
   * Obtiene la sala actual
   */
  getCurrentRoom(): ListeningRoom | null {
    return this.currentRoomSubject.getValue();
  }

  /**
   * Obtiene todas las salas activas del usuario
   */
  getActiveRooms(): ListeningRoom[] {
    return this.activeRoomsSubject.getValue();
  }

  /**
   * Verifica si es necesario sincronizar con la sala
   */
  private shouldSync(): boolean {
    const now = Date.now();
    // Evitar sincronizaciones muy frecuentes
    if (now - this.lastSyncTimestamp < this.syncThreshold * 1000) {
      return false;
    }
    return true;
  }

  /**
   * Maneja la creación de una sala
   */
  private handleRoomCreated(room: ListeningRoom): void {
    // Actualizar lista de salas
    const currentRooms = this.activeRoomsSubject.getValue();
    this.activeRoomsSubject.next([...currentRooms, room]);

    // Establecer como sala actual
    this.currentRoomSubject.next(room);

    // Emitir evento
    this.roomEventSubject.next({
      type: 'created',
      room,
      timestamp: Date.now(),
    });
  }

  /**
   * Maneja la unión a una sala
   */
  private handleRoomJoined(room: ListeningRoom): void {
    // Actualizar lista de salas
    const currentRooms = this.activeRoomsSubject.getValue();
    const roomIndex = currentRooms.findIndex((r) => r.id === room.id);

    if (roomIndex >= 0) {
      // Actualizar sala existente
      const updatedRooms = [...currentRooms];
      updatedRooms[roomIndex] = room;
      this.activeRoomsSubject.next(updatedRooms);
    } else {
      // Añadir nueva sala
      this.activeRoomsSubject.next([...currentRooms, room]);
    }

    // Establecer como sala actual
    this.currentRoomSubject.next(room);

    // Emitir evento
    this.roomEventSubject.next({
      type: 'joined',
      room,
      timestamp: Date.now(),
    });

    // Sincronizar reproducción con la sala
    this.handleSyncWithRoom(room);
  }

  /**
   * Maneja la salida de una sala
   */
  private handleRoomLeft(roomId: string): void {
    // Actualizar lista de salas
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.filter((r) => r.id !== roomId);
    this.activeRoomsSubject.next(updatedRooms);

    // Si era la sala actual, limpiar estado
    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === roomId) {
      this.currentRoomSubject.next(null);
    }

    // Emitir evento
    this.roomEventSubject.next({
      type: 'left',
      timestamp: Date.now(),
      message: `Has salido de la sala ${roomId}`,
    });
  }

  /**
   * Maneja la actualización de una sala
   */
  private handleRoomUpdated(room: ListeningRoom): void {
    // Actualizar lista de salas
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.map((r) => (r.id === room.id ? room : r));
    this.activeRoomsSubject.next(updatedRooms);

    // Si es la sala actual, actualizar
    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === room.id) {
      this.currentRoomSubject.next(room);

      // Sincronizar reproducción con la sala actualizada
      this.handleSyncWithRoom(room);
    }

    // Emitir evento
    this.roomEventSubject.next({
      type: 'updated',
      room,
      timestamp: Date.now(),
    });
  }

  /**
   * Maneja cuando un miembro se une a la sala
   */
  private handleMemberJoined(roomId: string, userId: string): void {
    // Actualizar lista de salas
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.map((room) => {
      if (room.id === roomId && !room.members.includes(userId)) {
        return {
          ...room,
          members: [...room.members, userId],
        };
      }
      return room;
    });

    this.activeRoomsSubject.next(updatedRooms);

    // Actualizar sala actual si corresponde
    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === roomId) {
      const updatedRoom = updatedRooms.find((r) => r.id === roomId);
      if (updatedRoom) {
        this.currentRoomSubject.next(updatedRoom);
      }
    }

    // Emitir evento
    this.roomEventSubject.next({
      type: 'member_joined',
      userId,
      timestamp: Date.now(),
      message: `${userId} se unió a la sala`,
    });
  }

  /**
   * Maneja cuando un miembro deja la sala
   */
  private handleMemberLeft(
    roomId: string,
    userId: string,
    newCreatorId?: string
  ): void {
    // Actualizar lista de salas
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.map((room) => {
      if (room.id === roomId) {
        const updatedRoom = {
          ...room,
          members: room.members.filter((id) => id !== userId),
        };

        // Actualizar creador si cambió
        if (newCreatorId && room.creatorId === userId) {
          updatedRoom.creatorId = newCreatorId;
        }

        return updatedRoom;
      }
      return room;
    });

    // Filtrar salas vacías
    const filteredRooms = updatedRooms.filter(
      (room) => room.members.length > 0
    );
    this.activeRoomsSubject.next(filteredRooms);

    // Actualizar sala actual si corresponde
    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === roomId) {
      const updatedRoom = filteredRooms.find((r) => r.id === roomId);
      if (updatedRoom) {
        this.currentRoomSubject.next(updatedRoom);
      } else {
        // La sala fue eliminada
        this.currentRoomSubject.next(null);
      }
    }

    // Emitir evento
    this.roomEventSubject.next({
      type: 'member_left',
      userId,
      timestamp: Date.now(),
      message: `${userId} abandonó la sala`,
    });
  }

  /**
   * Maneja invitaciones a salas
   */
  private handleRoomInvitation(data: any): void {
    const invitation: RoomEvent = {
      type: 'invitation',
      inviterId: data.inviterId,
      trackId: data.trackId,
      room: {
        id: data.roomId,
        creatorId: data.inviterId,
        trackId: data.trackId,
        state: 'paused',
        progress: 0,
        timestamp: data.timestamp,
        members: [], // Se rellenará cuando se una
      },
      timestamp: data.timestamp,
      message: `Has recibido una invitación para unirte a una sala de escucha`,
    };

    // Añadir a invitaciones pendientes
    const currentInvitations = this.pendingInvitationsSubject.getValue();
    this.pendingInvitationsSubject.next([...currentInvitations, invitation]);

    // Emitir evento
    this.roomEventSubject.next(invitation);
  }

  /**
   * Maneja la sincronización con una sala
   */
  private handleRoomSync(data: any): void {
    const { roomId, state, progress, trackId } = data;

    // Buscar la sala en las salas activas
    const currentRooms = this.activeRoomsSubject.getValue();
    const room = currentRooms.find((r) => r.id === roomId);

    if (room) {
      const updatedRoom: ListeningRoom = {
        ...room,
        state,
        progress,
        trackId,
        timestamp: data.timestamp,
      };

      // Actualizar sala en la lista
      this.handleRoomUpdated(updatedRoom);
    }
  }

  /**
   * Maneja la respuesta de salas de usuario
   */
  private handleUserRoomsResponse(rooms: ListeningRoom[]): void {
    if (!rooms || !Array.isArray(rooms)) {
      console.error('Formato incorrecto de respuesta de salas');
      return;
    }

    // Actualizar lista de salas
    this.activeRoomsSubject.next(rooms);
  }

  /**
   * Sincroniza el reproductor con el estado de la sala
   */
  private handleSyncWithRoom(room: ListeningRoom): void {
    if (!this.shouldSync()) {
      return;
    }

    this.isSyncing = true;
    this.lastSyncTimestamp = Date.now();

    try {
      // Verificar si la pista actual es diferente
      const currentTrackId = this.audiusFacade.getPlaybackState().trackId;

      // Si la pista es diferente, reproducir la nueva
      if (currentTrackId !== room.trackId) {
        // Cargar y reproducir la pista
        this.audiusFacade.play(room.trackId);
      }

      // Calcular el progreso actual considerando el tiempo transcurrido
      let adjustedProgress = room.progress;
      if (room.state === 'playing') {
        const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
        adjustedProgress = room.progress + elapsedSeconds;
      }

      // Sincronizar posición
      this.audiusFacade.seekTo(adjustedProgress);

      // Sincronizar estado (play/pause)
      if (
        room.state === 'playing' &&
        !this.audiusFacade.getPlaybackState().isPlaying
      ) {
        setTimeout(() => this.audiusFacade.play(room.trackId), 100);
      } else if (
        room.state === 'paused' &&
        this.audiusFacade.getPlaybackState().isPlaying
      ) {
        setTimeout(() => this.audiusFacade.pause(), 100);
      }
    } catch (error) {
      console.error('Error al sincronizar con la sala:', error);
    } finally {
      // Restaurar bandera de sincronización después de un breve período
      setTimeout(() => {
        this.isSyncing = false;
      }, 1000);
    }
  }
}
