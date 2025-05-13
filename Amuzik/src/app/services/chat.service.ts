import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval, Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { TrackMetadata, MusicEvent } from '../services/facades/audius.facade';
import { environment } from '../../environments/environment'; // Asegúrate de importar correctamente tu environment

export interface Message {
  id: number;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

export interface MusicEventMessage extends MusicEvent {
  senderId: string;
  roomId: string;
}

export interface SyncRequest {
  type: 'sync_request';
  roomId: string;
  senderId: string;
  timestamp: number;
}

export interface SyncState {
  type: 'sync_state';
  roomId: string;
  trackId: string | null;
  isPlaying: boolean;
  position: number;
  senderId: string;
  timestamp: number;
  metadata?: TrackMetadata;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastAttempt: Date | null;
  isReconnecting: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: WebSocket | null = null;
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  // Subjects para eventos musicales
  private musicEventsSubject = new Subject<MusicEventMessage>();
  public musicEvents$ = this.musicEventsSubject.asObservable();
  
  // Subject para respuestas a sync_request
  private syncStateSubject = new Subject<SyncState>();
  public syncState$ = this.syncStateSubject.asObservable();
  
  // Subject para el estado de la conexión
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>({
    isConnected: false,
    lastAttempt: null,
    isReconnecting: false
  });
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Aumentado para mayor tolerancia
  private reconnectTimeout: any;
  private heartbeatInterval: Subscription | null = null;
  private currentConversationId: string | null = null;
  private currentRoomId: string | null = null;
  
  // URL del WebSocket - idealmente en environment.ts
  private wsUrl = 'wss://chat-server-uoyz.onrender.com';
  
  constructor(private authService: AuthService) {
    // Intentar conectar cuando el servicio es creado
    this.checkAndConnect();
    
    // Monitorear cambios en el usuario
    this.authService.currentUser$.subscribe(user => {
      if (user?.id) {
        this.checkAndConnect();
      } else {
        this.disconnect();
      }
    });
  }

  // Verificar estado y conectar si no está ya conectado
  private checkAndConnect(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  // Conectar al WebSocket con manejo mejorado de errores
  connect(): void {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      console.error('No se puede conectar: Usuario no autenticado');
      return;
    }
    
    // Evitar conexiones duplicadas
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket ya está conectado o conectándose');
      return;
    }
    
    // Actualizar estado de conexión
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: this.reconnectAttempts > 0
    });

    try {
      console.log(`Intentando conectar a: ${this.wsUrl}?userId=${userId}`);
      this.socket = new WebSocket(`${this.wsUrl}?userId=${userId}`);
      
      this.socket.onopen = () => {
        console.log('✅ WebSocket conectado exitosamente');
        this.reconnectAttempts = 0;
        
        // Actualizar estado
        this.connectionStatusSubject.next({
          isConnected: true,
          lastAttempt: new Date(),
          isReconnecting: false
        });
        
        // Iniciar heartbeat para mantener la conexión
        this.startHeartbeat();
        
        // Si hay una conversación activa, solicitar el historial
        if (this.currentConversationId) {
          this.requestHistoricalMessages(this.currentConversationId);
        }
        
        // Si estamos en una sala, enviar un sync_request
        if (this.currentRoomId) {
          this.sendSyncRequest(this.currentRoomId);
        }
        
        // Procesar mensajes pendientes
        this.processPendingMessages();
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 Mensaje recibido:', data.type || 'chat');
          
          // Manejar diferentes tipos de mensajes
          if (data.type === 'history_response' && data.messages) {
            // Reemplazar mensajes con el historial
            const messages = data.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            this.messagesSubject.next(messages);
            console.log('📚 Historial cargado:', messages.length, 'mensajes');
          } 
          // Manejo de eventos musicales
          else if (data.type === 'music_event') {
            console.log('🎵 Evento musical recibido:', data.eventType);
            this.musicEventsSubject.next(data);
          }
          // Manejo de respuesta a sync_request
          else if (data.type === 'sync_state') {
            console.log('🔄 Estado de sincronización recibido');
            this.syncStateSubject.next(data);
          }
          // Confirmación de registro de token
          else if (data.type === 'device_token_registered') {
            console.log('📱 Token de dispositivo registrado exitosamente');
          }
          // Mensaje tipo ping para mantener la conexión
          else if (data.type === 'ping') {
            this.socket?.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
          // Mensaje normal recibido - añadir al historial actual
          else if (data.senderId && data.receiverId && data.text) {
            const message: Message = {
              ...data,
              timestamp: new Date(data.timestamp)
            };
            
            const currentMessages = this.messagesSubject.value;
            // Evitar duplicados comprobando el ID
            if (!currentMessages.some(m => m.id === message.id)) {
              this.messagesSubject.next([...currentMessages, message]);
              this.saveMessageToStorage(message);
            }
          }
          // Actualización de estado de mensaje
          else if (data.type === 'message_status' && data.messageId) {
            this.updateMessageStatus(data.messageId, data.status);
          }
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('❌ Error de WebSocket:', error);
        // Actualizar estado
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false
        });
      };
      
      this.socket.onclose = (event) => {
        console.log(`WebSocket desconectado - Código: ${event.code}, Razón: ${event.reason}`);
        
        // Detener heartbeat
        this.stopHeartbeat();
        
        // Actualizar estado
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false
        });
        
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error al conectar con WebSocket:', error);
      this.connectionStatusSubject.next({
        isConnected: false,
        lastAttempt: new Date(),
        isReconnecting: false
      });
      
      this.attemptReconnect();
    }
  }

  // Iniciar heartbeat para mantener la conexión viva
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
          console.error('Error al enviar ping:', error);
        }
      } else {
        this.stopHeartbeat();
      }
    });
  }

  // Detener el heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      this.heartbeatInterval.unsubscribe();
      this.heartbeatInterval = null;
    }
  }

  // Registrar token de dispositivo para notificaciones push
  registerDeviceToken(deviceToken: string): void {
    if (!deviceToken) {
      console.error('Token de dispositivo inválido');
      return;
    }
    
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.error('No hay usuario autenticado');
      return;
    }
    
    // Si no estamos conectados, conectar primero
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Guardar token para registrarlo después de conectar
      localStorage.setItem('deviceToken', deviceToken);
      this.connect();
      return;
    }

    try {
      this.socket.send(JSON.stringify({
        type: 'register_device_token',
        deviceToken,
        userId
      }));
      console.log('📱 Token de dispositivo enviado para registro');
    } catch (error) {
      console.error('Error al registrar token de dispositivo:', error);
      // Guardar para intentar después
      localStorage.setItem('deviceToken', deviceToken);
    }
  }

  // Intenta reconectar cuando se pierde la conexión con una estrategia exponencial
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Número máximo de intentos de reconexión alcanzado');
      return;
    }
    
    this.reconnectAttempts++;
    // Estrategia exponencial con un máximo de 60 segundos
    const delay = Math.min(60000, Math.pow(1.5, this.reconnectAttempts) * 1000);
    
    console.log(`🔄 Intentando reconectar en ${delay / 1000} segundos... (Intento ${this.reconnectAttempts})`);
    
    // Actualizar estado
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: true
    });
    
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Actualiza el estado de un mensaje (enviado, entregado, leído)
  private updateMessageStatus(messageId: number, status: string): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, status };
      }
      return msg;
    });
    
    this.messagesSubject.next(updatedMessages as Message[]);
    
    // Actualizar en localStorage
    const currentUser = this.getCurrentUserId();
    if (currentUser && this.currentConversationId) {
      localStorage.setItem(`messages_${this.currentConversationId}`, JSON.stringify(updatedMessages));
    }
  }

  // Obtiene el ID del usuario actual de manera síncrona
  private getCurrentUserId(): string | null {
    let userId: string | null = null;
    
    // Esta suscripción se ejecuta de forma síncrona porque BehaviorSubject emite inmediatamente el valor actual
    this.authService.currentUser$.subscribe(user => {
      userId = user?.id || null;
    }).unsubscribe(); // Importante desuscribirse inmediatamente
    
    return userId;
  }

  // Procesar mensajes pendientes después de la reconexión
  private processPendingMessages(): void {
    const pendingMessages = JSON.parse(localStorage.getItem('pending_messages') || '[]');
    
    if (pendingMessages.length === 0) return;
    
    console.log(`📤 Procesando ${pendingMessages.length} mensajes pendientes`);
    
    // Limpiar la lista pendiente
    localStorage.removeItem('pending_messages');
    
    // Intentar enviar cada mensaje
    pendingMessages.forEach((msg: any) => {
      this.sendMessage(msg.receiverId, msg.text, msg.id);
    });
  }

  // Envía un mensaje a través del WebSocket
  sendMessage(receiverId: string, text: string, tempId?: number): void {
    if (!text.trim()) {
      console.log('Mensaje vacío, no se envía');
      return;
    }
    
    const senderId = this.getCurrentUserId();
    if (!senderId) {
      console.error('No hay usuario autenticado');
      return;
    }

    // Crear objeto de mensaje
    const message = {
      id: tempId || Date.now(),
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      status: 'sent' as Message['status']
    };

    // Si no estamos conectados, guardar para enviar después
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('WebSocket no conectado, guardando mensaje para enviar después');
      this.queueMessageForSending(message);
      this.connect(); // Intentar conectar
      return;
    }

    try {
      // Añadir el mensaje al historial local antes de enviar
      const currentMessages = this.messagesSubject.value;
      const exists = currentMessages.some(m => m.id === message.id);
      
      if (!exists) {
        this.messagesSubject.next([...currentMessages, message]);
        this.saveMessageToStorage(message);
      }
      
      // Enviar mensaje al servidor
      this.socket.send(JSON.stringify({
        senderId: message.senderId,
        receiverId: message.receiverId,
        text: message.text,
        timestamp: message.timestamp
      }));
      
      console.log('📤 Mensaje enviado al servidor');
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      // Si falla el envío, guardarlo para reintento
      this.queueMessageForSending(message);
    }
  }

  // Almacena mensajes pendientes para enviar cuando se reconecte
  private queueMessageForSending(message: Message): void {
    // Añadir a la lista actual de mensajes si no existe
    const currentMessages = this.messagesSubject.value;
    const exists = currentMessages.some(m => m.id === message.id);
    
    if (!exists) {
      this.messagesSubject.next([...currentMessages, message]);
      this.saveMessageToStorage(message);
    }
    
    // Almacenar en una lista separada de mensajes pendientes
    const pendingMessages = JSON.parse(localStorage.getItem('pending_messages') || '[]');
    
    // Verificar si ya existe en pendientes
    if (!pendingMessages.some((m: any) => m.id === message.id)) {
      pendingMessages.push(message);
      localStorage.setItem('pending_messages', JSON.stringify(pendingMessages));
      console.log(`📝 Mensaje añadido a la cola de pendientes (${pendingMessages.length} total)`);
    }
  }

  // Carga los mensajes para una conversación específica
  loadConversation(friendId: string): Observable<Message[]> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.error('No hay usuario autenticado');
      return this.messages$;
    }
    
    this.currentConversationId = friendId;
    this.currentRoomId = null; // Limpia la sala actual
    
    // Intentar cargar mensajes del localStorage
    const storageKey = `messages_${friendId}`;
    const savedMessages = localStorage.getItem(storageKey);
    
    let messages: Message[] = [];
    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
        // Asegurarse de que los timestamps son objetos Date
        messages.forEach(msg => {
          if (typeof msg.timestamp === 'string') {
            msg.timestamp = new Date(msg.timestamp);
          }
        });
      } catch (error) {
        console.error('Error al cargar mensajes:', error);
      }
    }
    
    // Actualiza el subject con los mensajes cargados
    this.messagesSubject.next(messages);
    
    // Asegurarnos de que estamos conectados antes de solicitar el historial
    this.checkAndConnect();
    
    // Si estamos conectados, solicitar historial
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.requestHistoricalMessages(friendId);
    }
    
    return this.messages$;
  }

  // Solicita mensajes históricos al servidor
  private requestHistoricalMessages(friendId: string): void {
    if (!friendId) {
      console.error('ID de amigo inválido');
      return;
    }
    
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('WebSocket no conectado, se solicitará historial después de conectar');
      return;
    }

    const userId = this.getCurrentUserId();
    if (!userId) return;

    const request = {
      type: 'history_request',
      userId,
      friendId
    };

    try {
      this.socket.send(JSON.stringify(request));
      console.log(`📜 Solicitando historial de mensajes para: ${friendId}`);
    } catch (error) {
      console.error('Error al solicitar historial:', error);
    }
  }

  // Guardar un mensaje en el almacenamiento local
  private saveMessageToStorage(message: Message): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    // Determinar con quién es la conversación
    const conversationPartnerId = message.senderId === userId ? message.receiverId : message.senderId;
    const storageKey = `messages_${conversationPartnerId}`;
    
    // Obtener mensajes existentes
    const savedMessages = localStorage.getItem(storageKey);
    let messages: Message[] = [];
    
    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
        // Convertir timestamps a Date si es necesario
        messages.forEach(msg => {
          if (typeof msg.timestamp === 'string') {
            msg.timestamp = new Date(msg.timestamp);
          }
        });
      } catch (error) {
        console.error('Error al parsear mensajes:', error);
      }
    }
    
    // Comprobar si el mensaje ya existe para evitar duplicados
    const messageExists = messages.some(m => m.id === message.id);
    
    if (!messageExists) {
      // Añadir nuevo mensaje
      messages.push(message);
      // Guardar en localStorage
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }

  // Marcar mensajes como leídos
  markMessagesAsRead(friendId: string): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    const currentMessages = this.messagesSubject.value;
    let hasChanges = false;
    
    // Marcar como leídos solo los mensajes recibidos que no estén ya marcados
    const updatedMessages = currentMessages.map(msg => {
      if (msg.senderId === friendId && msg.receiverId === userId && msg.status !== 'read') {
        hasChanges = true;
        return { ...msg, status: 'read' as Message['status'] };
      }
      return msg;
    });
    
    if (hasChanges) {
      this.messagesSubject.next(updatedMessages);
      localStorage.setItem(`messages_${friendId}`, JSON.stringify(updatedMessages));
      
      // Notificar al remitente que los mensajes han sido leídos
      this.notifyMessagesRead(friendId);
    }
  }

  // Notificar al remitente que los mensajes han sido leídos
  private notifyMessagesRead(friendId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Si no estamos conectados, guardar esta acción para hacerla después
      const pendingReadReceipts = JSON.parse(localStorage.getItem('pending_read_receipts') || '[]');
      if (!pendingReadReceipts.includes(friendId)) {
        pendingReadReceipts.push(friendId);
        localStorage.setItem('pending_read_receipts', JSON.stringify(pendingReadReceipts));
      }
      return;
    }
    
    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    try {
      this.socket.send(JSON.stringify({
        type: 'messages_read',
        readerId: userId,
        senderId: friendId,
        timestamp: new Date()
      }));
      console.log(`📖 Notificación de lectura enviada para: ${friendId}`);
    } catch (error) {
      console.error('Error al notificar mensajes leídos:', error);
    }
  }

  // MÉTODOS PARA LA FUNCIONALIDAD MUSICAL

  // Unirse a una sala musical
  joinMusicRoom(roomId: string): void {
    if (!roomId) {
      console.error('ID de sala inválido');
      return;
    }
    
    this.checkAndConnect();

    const userId = this.getCurrentUserId();
    if (!userId) return;

    this.currentRoomId = roomId;
    this.currentConversationId = null; // Limpia la conversación actual

    // Si no estamos conectados, intentar más tarde
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log(`WebSocket no conectado, se unirá a la sala ${roomId} después de conectar`);
      return;
    }

    try {
      // Notificar que nos unimos a la sala
      this.socket.send(JSON.stringify({
        type: 'join_room',
        roomId,
        userId,
        timestamp: Date.now()
      }));
      console.log(`🎵 Unido a sala musical: ${roomId}`);

      // Solicitar sincronización después de un pequeño retraso
      setTimeout(() => {
        this.sendSyncRequest(roomId);
      }, 500);
    } catch (error) {
      console.error('Error al unirse a la sala:', error);
    }
  }

  // Enviar un evento musical
  sendMusicEvent(event: MusicEvent): void {
    if (!this.currentRoomId) {
      console.error('No hay sala musical activa');
      return;
    }
    
    this.checkAndConnect();

    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    // Si no estamos conectados, no enviar el evento
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('WebSocket no conectado, evento musical no enviado');
      return;
    }

    const musicEventMessage = {
      type: 'music_event',
      senderId: userId,
      roomId: this.currentRoomId,
      ...event
    };

    try {
      this.socket.send(JSON.stringify(musicEventMessage));
      console.log(`🎵 Evento musical enviado: ${event.eventType}`);
    } catch (error) {
      console.error('Error al enviar evento musical:', error);
    }
  }

  // Enviar solicitud de sincronización
  sendSyncRequest(roomId: string): void {
    if (!roomId) {
      console.error('ID de sala inválido');
      return;
    }
    
    this.checkAndConnect();

    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    // Si no estamos conectados, no enviar la solicitud
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('WebSocket no conectado, solicitud de sincronización no enviada');
      return;
    }

    const syncRequest: SyncRequest = {
      type: 'sync_request',
      roomId,
      senderId: userId,
      timestamp: Date.now()
    };

    try {
      this.socket.send(JSON.stringify(syncRequest));
      console.log(`🔄 Solicitud de sincronización enviada para sala: ${roomId}`);
    } catch (error) {
      console.error('Error al enviar solicitud de sincronización:', error);
    }
  }

  // Enviar estado de sincronización (respuesta a sync_request)
  sendSyncState(trackId: string | null, isPlaying: boolean, position: number, metadata?: TrackMetadata): void {
    if (!this.currentRoomId) {
      console.error('No hay sala musical activa');
      return;
    }
    
    this.checkAndConnect();

    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    // Si no estamos conectados, no enviar el estado
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('WebSocket no conectado, estado de sincronización no enviado');
      return;
    }

    const syncState: SyncState = {
      type: 'sync_state',
      roomId: this.currentRoomId,
      trackId,
      isPlaying,
      position,
      senderId: userId,
      timestamp: Date.now(),
      metadata
    };

    try {
      this.socket.send(JSON.stringify(syncState));
      console.log(`🔄 Estado de sincronización enviado: ${trackId ? 'Track ID: ' + trackId : 'Sin track'}`);
    } catch (error) {
      console.error('Error al enviar estado de sincronización:', error);
    }
  }

  // Desconectar el WebSocket de manera segura
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.socket) {
      try {
        // Solo cerrar si está abierto o conectando
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close(1000, 'Desconexión normal');
        }
      } catch (error) {
        console.error('Error al cerrar socket:', error);
      } finally {
        this.socket = null;
      }
    }
    
    this.currentConversationId = null;
    this.currentRoomId = null;
    clearTimeout(this.reconnectTimeout);
    
    // Actualizar estado
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: null,
      isReconnecting: false
    });
    
    console.log('🔌 Desconectado del servicio de chat');
  }
  
  // Ver si el websocket está conectado
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  // Obtener el estado actual de la conexión
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatusSubject.value;
  }
  
  // Forzar reconexión
  forceReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.reconnectAttempts = 0;
      this.connect();
    }, 1000);
  }
}