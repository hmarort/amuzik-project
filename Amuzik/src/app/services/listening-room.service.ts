import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ChatService } from './chat.service';
import {
  AudiusFacade,
  MusicEvent,
  TrackMetadata,
} from '../services/facades/audius.facade';

/**
 * Interfaz para la sala de escucha
 */
export interface ListeningRoom {
  id: string;
  creatorId: string;
  trackId: string;
  state: 'playing' | 'paused';
  progress: number;
  timestamp: number;
  members: string[];
}

/**
 * interfaz para la invitación a sala
 */
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
  username?: string;
  inviterId?: string;
  invitername?: string;
  trackId?: string;
  message?: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ListeningRoomService {
  private activeRoomsSubject = new BehaviorSubject<ListeningRoom[]>([]);
  public activeRooms$ = this.activeRoomsSubject.asObservable();

  private currentRoomSubject = new BehaviorSubject<ListeningRoom | null>(null);
  public currentRoom$ = this.currentRoomSubject.asObservable();

  private roomEventSubject = new Subject<RoomEvent>();
  public roomEvent$ = this.roomEventSubject.asObservable();

  private pendingInvitationsSubject = new BehaviorSubject<RoomEvent[]>([]);
  public pendingInvitations$ = this.pendingInvitationsSubject.asObservable();

  private isSyncing = false;
  private lastSyncTimestamp = 0;
  private syncThreshold = 5;

  /**
   * Constructor de la clase
   * @param chatService 
   * @param audiusFacade 
   */
  constructor(
    private chatService: ChatService,
    private audiusFacade: AudiusFacade
  ) {
    this.setupWebSocketListeners();

    this.setupMusicEventListeners();

    this.getUserRooms();
  }

  /**
   * Configura los listeners del websocket
   * @returns 
   */
  private setupWebSocketListeners(): void {
    const socket = this.chatService.getSocket();

    if (!socket) {
      this.chatService.connectionStatus$.subscribe((status) => {
        if (status.isConnected) {
          this.setupWebSocketListeners();
        }
      });
      return;
    }

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

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
   * Configura los listeners de eventos de música
   */
  private setupMusicEventListeners(): void {
    this.audiusFacade.musicEvent$.subscribe((event: MusicEvent) => {
      const currentRoom = this.currentRoomSubject.getValue();
      if (!currentRoom || this.isSyncing) return;
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

    this.audiusFacade.getCurrentTrackId().subscribe((trackId) => {
      const currentRoom = this.currentRoomSubject.getValue();
      if (!currentRoom || this.isSyncing || !trackId) return;

      if (currentRoom.trackId !== trackId) {
        this.updateRoomTrack(currentRoom.id, trackId);
      }
    });
  }

  /**
   * Obtiene las salas en las que está el usuario
   * @returns 
   */
  getUserRooms(): void {
    if (!this.chatService.isConnected()) {
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'get_user_rooms',
    });
  }
  
  /**
   * Crea una nueva sala de escucha
   * @param trackId 
   * @returns 
   */
  createRoom(trackId: string): void {
    if (!this.chatService.isConnected()) {
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'create',
      trackId,
    });
  }

  /**
   * Invita a un usuario a una sala de escucha
   * @param roomId 
   * @param inviteeId 
   * @returns 
   */
  inviteToRoom(roomId: string, inviteeId: string): void {
    if (!this.chatService.isConnected()) {
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
   * Se une el usuario a una sala de escucha
   * @param roomId 
   * @returns 
   */
  joinRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'join',
      roomId,
    });
  }

  /**
   * Se va el usuario de una sala de escucha
   * @param roomId 
   * @returns 
   */
  leaveRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      return;
    }

    const currentRoom = this.currentRoomSubject.getValue();

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'leave',
      roomId,
      creatorId: currentRoom?.creatorId,
    });

    if (currentRoom && currentRoom.id === roomId) {
      this.currentRoomSubject.next(null);
    }
  }

  /**
   * Actualiza el estado de la sala de escucha
   * @param roomId 
   * @param state 
   * @param progress 
   * @returns 
   */
  updateRoomState(
    roomId: string,
    state: 'playing' | 'paused',
    progress: number
  ): void {
    if (!this.chatService.isConnected()) {
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
   * Actualiza la pista de la sala de escucha
   * @param roomId 
   * @param trackId 
   * @returns 
   */
  updateRoomTrack(roomId: string, trackId: string): void {
    if (!this.chatService.isConnected()) {
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
   * Sincroniza el estado de la sala de escucha con el servidor
   * @param roomId 
   * @returns 
   */
  syncWithRoom(roomId: string): void {
    if (!this.chatService.isConnected()) {
      return;
    }

    this.chatService.sendCustomMessage({
      channel: 'room',
      type: 'sync',
      roomId,
    });
  }

  /**
   * Acepta una invitación a una sala de escucha
   * @param invitation 
   */
  acceptInvitation(invitation: RoomEvent): void {
    this.joinRoom(invitation.room!.id);

    this.removePendingInvitation(invitation);
  }

  /**
   * Rechaza la invitación a una sala de escucha
   * @param invitation 
   */
  declineInvitation(invitation: RoomEvent): void {
    this.removePendingInvitation(invitation);
  }

  /**
   * Elimina las invitaciones pendientes.
   * @param invitation 
   */
  private removePendingInvitation(invitation: RoomEvent): void {
    const currentInvitations = this.pendingInvitationsSubject.getValue();
    const updatedInvitations = currentInvitations.filter(
      (inv) =>
        !(
          inv.room?.id === invitation.room?.id &&
          inv.invitername === invitation.invitername
        )
    );
    this.pendingInvitationsSubject.next(updatedInvitations);
  }

  /**
   * Obtiene la sala de escucha actual
   * @returns 
   */
  getCurrentRoom(): ListeningRoom | null {
    return this.currentRoomSubject.getValue();
  }

  /**
   * Obtiene las salas de escucha activas
   * @returns 
   */
  getActiveRooms(): ListeningRoom[] {
    return this.activeRoomsSubject.getValue();
  }

  /**
   * Determina si se debe sincronizar el estado de la sala con el servidor
   * @returns 
   */
  private shouldSync(): boolean {
    const now = Date.now();
    if (now - this.lastSyncTimestamp < this.syncThreshold * 1000) {
      return false;
    }
    return true;
  }

  /**
   * Maneja la creación de una  sala de escucha
   * @param room 
   */
  private handleRoomCreated(room: ListeningRoom): void {
    const currentRooms = this.activeRoomsSubject.getValue();
    this.activeRoomsSubject.next([...currentRooms, room]);

    this.currentRoomSubject.next(room);

    this.roomEventSubject.next({
      type: 'created',
      room,
      timestamp: Date.now(),
    });
  }

  /**
   * Manejamos la unión de usuarios a una sala de escucha
   * @param room 
   */
  private handleRoomJoined(room: ListeningRoom): void {
    const currentRooms = this.activeRoomsSubject.getValue();
    const roomIndex = currentRooms.findIndex((r) => r.id === room.id);

    if (roomIndex >= 0) {
      const updatedRooms = [...currentRooms];
      updatedRooms[roomIndex] = room;
      this.activeRoomsSubject.next(updatedRooms);
    } else {
      this.activeRoomsSubject.next([...currentRooms, room]);
    }

    this.currentRoomSubject.next(room);

    this.roomEventSubject.next({
      type: 'joined',
      room,
      timestamp: Date.now(),
    });

    this.handleSyncWithRoom(room);
  }

  /**
   * Maneja la ida de un usuario de una sala de escucha
   * @param roomId 
   */
  private handleRoomLeft(roomId: string): void {
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.filter((r) => r.id !== roomId);
    this.activeRoomsSubject.next(updatedRooms);

    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === roomId) {
      this.currentRoomSubject.next(null);
    }

    this.roomEventSubject.next({
      type: 'left',
      timestamp: Date.now(),
      message: `Has salido de la sala ${roomId}`,
    });
  }

  /**
   * Manejamos la actulaización de una sala de escucha
   * @param room 
   */
  private handleRoomUpdated(room: ListeningRoom): void {
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.map((r) => (r.id === room.id ? room : r));
    this.activeRoomsSubject.next(updatedRooms);

    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === room.id) {
      this.currentRoomSubject.next(room);

      this.handleSyncWithRoom(room);
    }

    this.roomEventSubject.next({
      type: 'updated',
      room,
      timestamp: Date.now(),
    });
  }

  /**
   * Se encarga del manejo de la union de usuarios a la sala
   * @param roomId 
   * @param userId 
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

    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === roomId) {
      const updatedRoom = updatedRooms.find((r) => r.id === roomId);
      if (updatedRoom) {
        this.currentRoomSubject.next(updatedRoom);
      }
    }

    this.roomEventSubject.next({
      type: 'member_joined',
      userId,
      timestamp: Date.now(),
      message: `${userId} se unió a la sala`,
    });
  }

  /**
   * Se encarga del manejo de la salida de un usuario de la sala
   * @param roomId 
   * @param userId 
   * @param newCreatorId 
   */
  private handleMemberLeft(
    roomId: string,
    userId: string,
    newCreatorId?: string
  ): void {
    const currentRooms = this.activeRoomsSubject.getValue();
    const updatedRooms = currentRooms.map((room) => {
      if (room.id === roomId) {
        const updatedRoom = {
          ...room,
          members: room.members.filter((id) => id !== userId),
        };

        if (newCreatorId && room.creatorId === userId) {
          updatedRoom.creatorId = newCreatorId;
        }

        return updatedRoom;
      }
      return room;
    });

    const filteredRooms = updatedRooms.filter(
      (room) => room.members.length > 0
    );
    this.activeRoomsSubject.next(filteredRooms);

    const currentRoom = this.currentRoomSubject.getValue();
    if (currentRoom && currentRoom.id === roomId) {
      const updatedRoom = filteredRooms.find((r) => r.id === roomId);
      if (updatedRoom) {
        this.currentRoomSubject.next(updatedRoom);
      } else {
        this.currentRoomSubject.next(null);
      }
    }

    this.roomEventSubject.next({
      type: 'member_left',
      userId,
      timestamp: Date.now(),
      message: `${userId} abandonó la sala`,
    });
  }

  /**
   * maneja la invitación a la sala de escucha
   * @param data 
   */
  private handleRoomInvitation(data: any): void {
    const invitation: RoomEvent = {
      type: 'invitation',
      inviterId: data.inviterId,
      invitername: data.invitername,
      trackId: data.trackId,
      room: {
        id: data.roomId,
        creatorId: data.invitername,
        trackId: data.trackId,
        state: 'paused',
        progress: 0,
        timestamp: data.timestamp,
        members: [],
      },
      timestamp: data.timestamp,
      message: `Has recibido una invitación para unirte a una sala de escucha`,
    };

    const currentInvitations = this.pendingInvitationsSubject.getValue();
    this.pendingInvitationsSubject.next([...currentInvitations, invitation]);

    this.roomEventSubject.next(invitation);
  }

  /**
   * Maneja la sincronización de la sala de escucha
   * @param data 
   */
  private handleRoomSync(data: any): void {
    const { roomId, state, progress, trackId } = data;

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

      this.handleRoomUpdated(updatedRoom);
    }
  }

  /**
   * Maneja la respuesta de las salas de usuario
   * @param rooms 
   * @returns 
   */
  private handleUserRoomsResponse(rooms: ListeningRoom[]): void {
    if (!rooms || !Array.isArray(rooms)) {
      return;
    }

    this.activeRoomsSubject.next(rooms);
  }

  /**
   * Sincroniza el estado de la sala de escucha con el servidor
   * @param room 
   * @returns 
   */
  private handleSyncWithRoom(room: ListeningRoom): void {
    if (!this.shouldSync()) {
      return;
    }

    this.isSyncing = true;
    this.lastSyncTimestamp = Date.now();

    try {
      const currentTrackId = this.audiusFacade.getPlaybackState().trackId;

      if (currentTrackId !== room.trackId) {
        this.audiusFacade.play(room.trackId);
      }

      let adjustedProgress = room.progress;
      if (room.state === 'playing') {
        const elapsedSeconds = (Date.now() - room.timestamp) / 1000;
        adjustedProgress = room.progress + elapsedSeconds;
      }

      this.audiusFacade.seekTo(adjustedProgress);

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
    } finally {
      setTimeout(() => {
        this.isSyncing = false;
      }, 1000);
    }
  }
}
