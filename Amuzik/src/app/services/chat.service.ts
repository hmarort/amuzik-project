import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  interval,
  Subscription,
} from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment.prod';

export interface Message {
  id: number;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  read?: boolean; // Campo adicional para compatibilidad con el servidor
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastAttempt: Date | null;
  isReconnecting: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private socket: WebSocket | null = null;
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  // Subject para el estado de la conexión
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>({
    isConnected: false,
    lastAttempt: null,
    isReconnecting: false,
  });
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: any;
  private heartbeatInterval: Subscription | null = null;
  private currentConversationId: string | null = null;

  // URL del WebSocket - asegúrate de que sea la correcta en tu environment.ts
  private wsUrl = environment.wsUrl;

  constructor(private authService: AuthService) {
    // Intentar conectar cuando el servicio es creado
    this.checkAndConnect();

    // Monitorear cambios en el usuario
    this.authService.currentUser$.subscribe((user) => {
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
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Actualizar estado de conexión
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: this.reconnectAttempts > 0,
    });

    try {
      this.socket = new WebSocket(`${this.wsUrl}?userId=${userId}`);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;

        // Actualizar estado
        this.connectionStatusSubject.next({
          isConnected: true,
          lastAttempt: new Date(),
          isReconnecting: false,
        });

        // Iniciar heartbeat para mantener la conexión
        this.startHeartbeat();

        // Si hay una conversación activa, solicitar el historial
        if (this.currentConversationId) {
          this.requestHistoricalMessages(this.currentConversationId);
        }

        // Procesar mensajes pendientes
        this.processPendingMessages();

        // Registrar el token del dispositivo si está disponible
        this.registerStoredDeviceToken();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Manejar diferentes tipos de mensajes
          if (data.type === 'history_response' && data.messages) {
            // Reemplazar mensajes con el historial
            const messages = data.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
              // Compatibilidad con la nueva estructura del servidor
              status: msg.read ? 'read' : msg.status || 'delivered',
            }));
            this.messagesSubject.next(messages);
          }
          // Mensaje tipo ping para mantener la conexión
          else if (data.type === 'ping') {
            this.socket?.send(
              JSON.stringify({ type: 'pong', timestamp: Date.now() })
            );
          }
          // Mensaje normal recibido - añadir al historial actual
          else if (data.senderId && data.receiverId && data.text) {
            const message: Message = {
              ...data,
              timestamp: new Date(data.timestamp),
              // Compatibilidad con la nueva estructura del servidor
              status: data.read ? 'read' : data.status || 'delivered',
            };

            const currentMessages = this.messagesSubject.value;
            // Evitar duplicados comprobando el ID
            if (!currentMessages.some((m) => m.id === message.id)) {
              this.messagesSubject.next([...currentMessages, message]);
              this.saveMessageToStorage(message);
            }
          }
          // Actualización de estado de mensaje
          else if (data.type === 'message_status' && data.messageId) {
            this.updateMessageStatus(data.messageId, data.status);
          }
          // Notificación de mensajes leídos
          else if (data.type === 'messages_read_receipt') {
            this.handleReadReceipt(data);
          }
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
        }
      };

      this.socket.onerror = (error) => {
        // Actualizar estado
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false,
        });
      };

      this.socket.onclose = (event) => {
        // Detener heartbeat
        this.stopHeartbeat();

        // Actualizar estado
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false,
        });

        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error al conectar con WebSocket:', error);
      this.connectionStatusSubject.next({
        isConnected: false,
        lastAttempt: new Date(),
        isReconnecting: false,
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
          this.socket.send(
            JSON.stringify({
              type: 'ping',
              timestamp: Date.now(),
            })
          );
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

  // Registrar token almacenado tras la conexión
  private registerStoredDeviceToken(): void {
    const storedToken = localStorage.getItem('deviceToken');
    if (storedToken) {
      this.registerDeviceToken(storedToken);
    }
  }

  // Registrar token de dispositivo para notificaciones push
  registerDeviceToken(deviceToken: string): void {
    if (!deviceToken) {
      return;
    }

    const userId = this.getCurrentUserId();
    if (!userId) {
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
      this.socket.send(
        JSON.stringify({
          type: 'register_device_token',
          deviceToken,
          userId,
        })
      );
    } catch (error) {
      // Guardar para intentar después
      localStorage.setItem('deviceToken', deviceToken);
    }
  }

  // Intenta reconectar cuando se pierde la conexión con una estrategia exponencial
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    // Estrategia exponencial con un máximo de 60 segundos
    const delay = Math.min(60000, Math.pow(1.5, this.reconnectAttempts) * 1000);

    // Actualizar estado
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: true,
    });

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Actualiza el estado de un mensaje (enviado, entregado, leído)
  private updateMessageStatus(messageId: number, status: string): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map((msg) => {
      if (msg.id === messageId) {
        return {
          ...msg,
          status,
          read: status === 'read', // Actualizar también la propiedad read para compatibilidad
        };
      }
      return msg;
    });

    this.messagesSubject.next(updatedMessages as Message[]);

    // Actualizar en localStorage
    const currentUser = this.getCurrentUserId();
    if (currentUser && this.currentConversationId) {
      localStorage.setItem(
        `messages_${this.currentConversationId}`,
        JSON.stringify(updatedMessages)
      );
    }
  }

  // Manejar notificación de mensajes leídos
  private handleReadReceipt(data: any): void {
    if (!data.readerId) return;

    const currentMessages = this.messagesSubject.value;
    let hasChanges = false;

    // Actualizar el estado de los mensajes enviados a este lector
    const updatedMessages = currentMessages.map((msg) => {
      if (msg.receiverId === data.readerId && msg.status !== 'read') {
        hasChanges = true;
        return {
          ...msg,
          status: 'read' as Message['status'],
          read: true, // Actualizar también la propiedad read para compatibilidad
        };
      }
      return msg;
    });

    if (hasChanges) {
      this.messagesSubject.next(updatedMessages);
      if (this.currentConversationId) {
        localStorage.setItem(
          `messages_${this.currentConversationId}`,
          JSON.stringify(updatedMessages)
        );
      }
    }
  }

  // Obtiene el ID del usuario actual de manera síncrona
  private getCurrentUserId(): string | null {
    let userId: string | null = null;

    // Esta suscripción se ejecuta de forma síncrona porque BehaviorSubject emite inmediatamente el valor actual
    this.authService.currentUser$
      .subscribe((user) => {
        userId = user?.id || null;
      })
      .unsubscribe(); // Importante desuscribirse inmediatamente

    return userId;
  }

  // Procesar mensajes pendientes después de la reconexión
  private processPendingMessages(): void {
    const pendingMessages = JSON.parse(
      localStorage.getItem('pending_messages') || '[]'
    );

    if (pendingMessages.length === 0) return;

    // Limpiar la lista pendiente
    localStorage.removeItem('pending_messages');

    // Intentar enviar cada mensaje
    pendingMessages.forEach((msg: any) => {
      this.sendMessage(msg.receiverId, msg.text, msg.id);
    });

    // Procesar recibos de lectura pendientes
    this.processPendingReadReceipts();
  }

  // Procesar recibos de lectura pendientes
  private processPendingReadReceipts(): void {
    const pendingReadReceipts = JSON.parse(
      localStorage.getItem('pending_read_receipts') || '[]'
    );

    if (pendingReadReceipts.length === 0) return;

    // Limpiar la lista pendiente
    localStorage.removeItem('pending_read_receipts');

    // Notificar cada recibo pendiente
    pendingReadReceipts.forEach((friendId: string) => {
      this.notifyMessagesRead(friendId);
    });
  }

  // Envía un mensaje a través del WebSocket
  sendMessage(receiverId: string, text: string, tempId?: number): void {
    if (!text.trim()) {
      return;
    }

    const senderId = this.getCurrentUserId();
    if (!senderId) {
      return;
    }

    // Crear objeto de mensaje
    const message = {
      id: tempId || Date.now(),
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      status: 'sent' as Message['status'],
      read: false, // Añadir propiedad read para compatibilidad con el servidor
    };

    // Si no estamos conectados, guardar para enviar después
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.queueMessageForSending(message);
      this.connect(); // Intentar conectar
      return;
    }

    try {
      // Añadir el mensaje al historial local antes de enviar
      const currentMessages = this.messagesSubject.value;
      const exists = currentMessages.some((m) => m.id === message.id);

      if (!exists) {
        this.messagesSubject.next([...currentMessages, message]);
        this.saveMessageToStorage(message);
      }

      // Enviar mensaje al servidor
      this.socket.send(
        JSON.stringify({
          senderId: message.senderId,
          receiverId: message.receiverId,
          text: message.text,
          timestamp: message.timestamp,
        })
      );
    } catch (error) {
      // Si falla el envío, guardarlo para reintento
      this.queueMessageForSending(message);
    }
  }

  // Almacena mensajes pendientes para enviar cuando se reconecte
  private queueMessageForSending(message: Message): void {
    // Añadir a la lista actual de mensajes si no existe
    const currentMessages = this.messagesSubject.value;
    const exists = currentMessages.some((m) => m.id === message.id);

    if (!exists) {
      this.messagesSubject.next([...currentMessages, message]);
      this.saveMessageToStorage(message);
    }

    // Almacenar en una lista separada de mensajes pendientes
    const pendingMessages = JSON.parse(
      localStorage.getItem('pending_messages') || '[]'
    );

    // Verificar si ya existe en pendientes
    if (!pendingMessages.some((m: any) => m.id === message.id)) {
      pendingMessages.push(message);
      localStorage.setItem('pending_messages', JSON.stringify(pendingMessages));
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

    // Intentar cargar mensajes del localStorage
    const storageKey = `messages_${friendId}`;
    const savedMessages = localStorage.getItem(storageKey);

    let messages: Message[] = [];
    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
        // Asegurarse de que los timestamps son objetos Date
        messages.forEach((msg) => {
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
      return;
    }

    const userId = this.getCurrentUserId();
    if (!userId) return;

    const request = {
      type: 'history_request',
      userId,
      friendId,
    };

    try {
      this.socket.send(JSON.stringify(request));
    } catch (error) {
      console.error('Error al solicitar historial:', error);
    }
  }

  // Guardar un mensaje en el almacenamiento local
  private saveMessageToStorage(message: Message): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    // Determinar con quién es la conversación
    const conversationPartnerId =
      message.senderId === userId ? message.receiverId : message.senderId;
    const storageKey = `messages_${conversationPartnerId}`;

    // Obtener mensajes existentes
    const savedMessages = localStorage.getItem(storageKey);
    let messages: Message[] = [];

    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
        // Convertir timestamps a Date si es necesario
        messages.forEach((msg) => {
          if (typeof msg.timestamp === 'string') {
            msg.timestamp = new Date(msg.timestamp);
          }
        });
      } catch (error) {
        console.error('Error al parsear mensajes:', error);
      }
    }

    // Comprobar si el mensaje ya existe para evitar duplicados
    const messageExists = messages.some((m) => m.id === message.id);

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
    const updatedMessages = currentMessages.map((msg) => {
      if (
        msg.senderId === friendId &&
        msg.receiverId === userId &&
        msg.status !== 'read'
      ) {
        hasChanges = true;
        return {
          ...msg,
          status: 'read' as Message['status'],
          read: true, // Actualizar también la propiedad read para compatibilidad
        };
      }
      return msg;
    });

    if (hasChanges) {
      this.messagesSubject.next(updatedMessages);
      localStorage.setItem(
        `messages_${friendId}`,
        JSON.stringify(updatedMessages)
      );

      // Notificar al remitente que los mensajes han sido leídos
      this.notifyMessagesRead(friendId);
    }
  }

  // Notificar al remitente que los mensajes han sido leídos
  private notifyMessagesRead(friendId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Si no estamos conectados, guardar esta acción para hacerla después
      const pendingReadReceipts = JSON.parse(
        localStorage.getItem('pending_read_receipts') || '[]'
      );
      if (!pendingReadReceipts.includes(friendId)) {
        pendingReadReceipts.push(friendId);
        localStorage.setItem(
          'pending_read_receipts',
          JSON.stringify(pendingReadReceipts)
        );
      }
      return;
    }

    const userId = this.getCurrentUserId();
    if (!userId) return;

    try {
      this.socket.send(
        JSON.stringify({
          type: 'messages_read',
          readerId: userId,
          senderId: friendId,
          timestamp: new Date(),
        })
      );
    } catch (error) {
      console.error('Error al notificar mensajes leídos:', error);
    }
  }

  // Desconectar el WebSocket de manera segura
  disconnect(): void {
    this.stopHeartbeat();

    if (this.socket) {
      try {
        // Solo cerrar si está abierto o conectando
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          this.socket.close(1000, 'Desconexión normal');
        }
      } catch (error) {
        console.error('Error al cerrar socket:', error);
      } finally {
        this.socket = null;
      }
    }

    this.currentConversationId = null;
    clearTimeout(this.reconnectTimeout);

    // Actualizar estado
    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: null,
      isReconnecting: false,
    });
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

  public getSocket(): WebSocket | null {
    return this.socket;
  }

  public sendCustomMessage(message: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}
