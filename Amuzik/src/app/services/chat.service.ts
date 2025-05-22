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

/**
 * Interfaz de mensaje
 */
export interface Message {
  id: number;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  read?: boolean;
}

/**
 * Interfaz de estado de conexión
 */
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

  private wsUrl = environment.wsUrl;

  /**
   * Constructor de la clase
   * @param authService 
   */
  constructor(private authService: AuthService) {
    this.checkAndConnect();

    this.authService.currentUser$.subscribe((user) => {
      if (user?.id) {
        this.checkAndConnect();
      } else {
        this.disconnect();
      }
    });
  }

  /**
   * Verifica la conexión y se conecta en caso de ser necesario
   * @returns 
   */
  private checkAndConnect(): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  /**
   * Conecta el socket Websocket
   * @returns 
   */
  connect(): void {
    const userId = this.getCurrentUserId();

    if (!userId) {
      console.error('No se puede conectar: Usuario no autenticado');
      return;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: new Date(),
      isReconnecting: this.reconnectAttempts > 0,
    });

    try {
      this.socket = new WebSocket(`${this.wsUrl}?userId=${userId}`);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;

        this.connectionStatusSubject.next({
          isConnected: true,
          lastAttempt: new Date(),
          isReconnecting: false,
        });

        this.startHeartbeat();

        if (this.currentConversationId) {
          this.requestHistoricalMessages(this.currentConversationId);
        }

        this.processPendingMessages();

        this.registerStoredDeviceToken();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'history_response' && data.messages) {
            const messages = data.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
              status: msg.read ? 'read' : msg.status || 'delivered',
            }));
            this.messagesSubject.next(messages);
          }
          else if (data.type === 'ping') {
            this.socket?.send(
              JSON.stringify({ type: 'pong', timestamp: Date.now() })
            );
          }
          else if (data.senderId && data.receiverId && data.text) {
            const message: Message = {
              ...data,
              timestamp: new Date(data.timestamp),
              status: data.read ? 'read' : data.status || 'delivered',
            };

            const currentMessages = this.messagesSubject.value;
            if (!currentMessages.some((m) => m.id === message.id)) {
              this.messagesSubject.next([...currentMessages, message]);
              this.saveMessageToStorage(message);
            }
          }
          else if (data.type === 'message_status' && data.messageId) {
            this.updateMessageStatus(data.messageId, data.status);
          }
          else if (data.type === 'messages_read_receipt') {
            this.handleReadReceipt(data);
          }
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
        }
      };

      this.socket.onerror = (error) => {
        this.connectionStatusSubject.next({
          isConnected: false,
          lastAttempt: new Date(),
          isReconnecting: false,
        });
      };

      this.socket.onclose = (event) => {
        this.stopHeartbeat();

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

  /**
   * Inicia el latido del socket
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

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

  /**
   * Detiene el latido del socet
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      this.heartbeatInterval.unsubscribe();
      this.heartbeatInterval = null;
    }
  }

  /**
   * Registra el token del dispositivo
   */
  private registerStoredDeviceToken(): void {
    const storedToken = localStorage.getItem('deviceToken');
    if (storedToken) {
      this.registerDeviceToken(storedToken);
    }
  }

  /**
   * Registra el token del dispositivo
   * @param deviceToken 
   */
  registerDeviceToken(deviceToken: string): void {
    if (!deviceToken) {
      return;
    }

    const userId = this.getCurrentUserId();
    if (!userId) {
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
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
      localStorage.setItem('deviceToken', deviceToken);
    }
  }

  /**
   * Intena reconectar el socket al websocket
   * @returns 
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(60000, Math.pow(1.5, this.reconnectAttempts) * 1000);

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

  /**
   * Actualiza el estado del mensaje
   * @param messageId 
   * @param status 
   */
  private updateMessageStatus(messageId: number, status: string): void {
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map((msg) => {
      if (msg.id === messageId) {
        return {
          ...msg,
          status,
          read: status === 'read',
        };
      }
      return msg;
    });

    this.messagesSubject.next(updatedMessages as Message[]);

    const currentUser = this.getCurrentUserId();
    if (currentUser && this.currentConversationId) {
      localStorage.setItem(
        `messages_${this.currentConversationId}`,
        JSON.stringify(updatedMessages)
      );
    }
  }

  /**
   * Maneja la recepción de mensajes leídos
   * @param data 
   * @returns 
   */
  private handleReadReceipt(data: any): void {
    if (!data.readerId) return;

    const currentMessages = this.messagesSubject.value;
    let hasChanges = false;

    const updatedMessages = currentMessages.map((msg) => {
      if (msg.receiverId === data.readerId && msg.status !== 'read') {
        hasChanges = true;
        return {
          ...msg,
          status: 'read' as Message['status'],
          read: true,
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

  /**
   * Tomamos el ide del usuario actual
   * @returns 
   */
  private getCurrentUserId(): string | null {
    let userId: string | null = null;

    this.authService.currentUser$
      .subscribe((user) => {
        userId = user?.id || null;
      })
      .unsubscribe();

    return userId;
  }

  /**
   * Procesa los mensajes pendientes
   * @returns 
   */
  private processPendingMessages(): void {
    const pendingMessages = JSON.parse(
      localStorage.getItem('pending_messages') || '[]'
    );

    if (pendingMessages.length === 0) return;

    localStorage.removeItem('pending_messages');

    pendingMessages.forEach((msg: any) => {
      this.sendMessage(msg.receiverId, msg.text, msg.id);
    });

    this.processPendingReadReceipts();
  }

  /**
   * Proceso lor recibos de lectura pendientes
   * @returns 
   */
  private processPendingReadReceipts(): void {
    const pendingReadReceipts = JSON.parse(
      localStorage.getItem('pending_read_receipts') || '[]'
    );

    if (pendingReadReceipts.length === 0) return;

    localStorage.removeItem('pending_read_receipts');

    pendingReadReceipts.forEach((friendId: string) => {
      this.notifyMessagesRead(friendId);
    });
  }

  /**
   * Envia un mensaje a un usuario
   * @param receiverId 
   * @param text 
   * @param tempId 
   * @returns 
   */
  sendMessage(receiverId: string, text: string, tempId?: number): void {
    if (!text.trim()) {
      return;
    }

    const senderId = this.getCurrentUserId();
    if (!senderId) {
      return;
    }

    const message = {
      id: tempId || Date.now(),
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      status: 'sent' as Message['status'],
      read: false,
    };

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.queueMessageForSending(message);
      this.connect();
      return;
    }

    try {
      const currentMessages = this.messagesSubject.value;
      const exists = currentMessages.some((m) => m.id === message.id);

      if (!exists) {
        this.messagesSubject.next([...currentMessages, message]);
        this.saveMessageToStorage(message);
      }

      this.socket.send(
        JSON.stringify({
          senderId: message.senderId,
          receiverId: message.receiverId,
          text: message.text,
          timestamp: message.timestamp,
        })
      );
    } catch (error) {
      this.queueMessageForSending(message);
    }
  }

  /**
   * Encola un mensaje para su envío
   * @param message 
   */
  private queueMessageForSending(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    const exists = currentMessages.some((m) => m.id === message.id);

    if (!exists) {
      this.messagesSubject.next([...currentMessages, message]);
      this.saveMessageToStorage(message);
    }

    const pendingMessages = JSON.parse(
      localStorage.getItem('pending_messages') || '[]'
    );

    if (!pendingMessages.some((m: any) => m.id === message.id)) {
      pendingMessages.push(message);
      localStorage.setItem('pending_messages', JSON.stringify(pendingMessages));
    }
  }

  /**
   * Carga la conversación entre usuarios
   * @param friendId 
   * @returns 
   */
  loadConversation(friendId: string): Observable<Message[]> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.error('No hay usuario autenticado');
      return this.messages$;
    }

    this.currentConversationId = friendId;

    const storageKey = `messages_${friendId}`;
    const savedMessages = localStorage.getItem(storageKey);

    let messages: Message[] = [];
    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
        messages.forEach((msg) => {
          if (typeof msg.timestamp === 'string') {
            msg.timestamp = new Date(msg.timestamp);
          }
        });
      } catch (error) {
        console.error('Error al cargar mensajes:', error);
      }
    }

    this.messagesSubject.next(messages);

    this.checkAndConnect();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.requestHistoricalMessages(friendId);
    }

    return this.messages$;
  }

  /**
   * Obtenemos el historial de mensajes
   * @param friendId 
   * @returns 
   */
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

  /**
   * Guardamos el mensaje en el almcenamiento local
   * @param message 
   * @returns 
   */
  private saveMessageToStorage(message: Message): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const conversationPartnerId =
      message.senderId === userId ? message.receiverId : message.senderId;
    const storageKey = `messages_${conversationPartnerId}`;

    const savedMessages = localStorage.getItem(storageKey);
    let messages: Message[] = [];

    if (savedMessages) {
      try {
        messages = JSON.parse(savedMessages);
        messages.forEach((msg) => {
          if (typeof msg.timestamp === 'string') {
            msg.timestamp = new Date(msg.timestamp);
          }
        });
      } catch (error) {
        console.error('Error al parsear mensajes:', error);
      }
    }

    const messageExists = messages.some((m) => m.id === message.id);

    if (!messageExists) {
      messages.push(message);
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }

  /**
   * 
   * @param friendId Marcamos el mensaje como leído
   * @returns 
   */
  markMessagesAsRead(friendId: string): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const currentMessages = this.messagesSubject.value;
    let hasChanges = false;

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
          read: true,
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

      this.notifyMessagesRead(friendId);
    }
  }

  /**
   * Notifica que los mensajes han sido leidos para saber su estado
   * @param friendId 
   * @returns 
   */
  private notifyMessagesRead(friendId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
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

  /**
   * Desconectamos el socket
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.socket) {
      try {
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

    this.connectionStatusSubject.next({
      isConnected: false,
      lastAttempt: null,
      isReconnecting: false,
    });
  }

  /**
   * Comprobamos que este conectado
   * @returns 
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Obtenemos el estado de la conexión
   * @returns 
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatusSubject.value;
  }

  /**
   * Forzamos la reconexión
   */
  forceReconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.reconnectAttempts = 0;
      this.connect();
    }, 1000);
  }

  /**
   * Obtenemos el socket de la conexión
   * @returns 
   */
  public getSocket(): WebSocket | null {
    return this.socket;
  }

  /**
   * Mandamos un mensaje personalizado
   * @param message 
   * @returns 
   */
  public sendCustomMessage(message: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}
