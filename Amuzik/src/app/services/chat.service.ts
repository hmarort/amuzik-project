import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Message {
  id: number;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: WebSocket | null = null;
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: any;
  private currentConversationId: string | null = null;
  
  constructor(private authService: AuthService) {}

  // Conectar al WebSocket
  connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    
    let userId: string | null = null;
    this.authService.currentUser$.subscribe(user => {
      userId = user?.id || null;
    });
    
    if (!userId) {
      console.error('No se puede conectar: Usuario no autenticado');
      return;
    }

    try {
      // Usar el protocolo WebSocket correcto (ws:// en lugar de http://)
      this.socket = new WebSocket(`wss://chat-server-uoyz.onrender.com?userId=${userId}`);
      
      this.socket.onopen = () => {
        console.log('WebSocket conectado');
        this.reconnectAttempts = 0;
        
        // Si hay una conversación activa, solicitar el historial
        if (this.currentConversationId) {
          this.requestHistoricalMessages(this.currentConversationId);
        }
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensaje recibido:', data);
          
          // Manejar diferentes tipos de mensajes
          if (data.type === 'history_response' && data.messages) {
            // Reemplazar mensajes con el historial
            const messages = data.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            this.messagesSubject.next(messages);
            console.log('Historial cargado:', messages.length, 'mensajes');
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
        console.error('Error de WebSocket:', error);
      };
      
      this.socket.onclose = (event) => {
        console.log('WebSocket desconectado', event);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error al conectar con WebSocket:', error);
    }
  }

  // Intenta reconectar cuando se pierde la conexión
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Número máximo de intentos de reconexión alcanzado');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    
    console.log(`Intentando reconectar en ${delay / 1000} segundos...`);
    
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

  // Obtiene el ID del usuario actual
  private getCurrentUserId(): string | null {
    let userId: string | null = null;
    this.authService.currentUser$.subscribe(user => {
      userId = user?.id || null;
    });
    return userId;
  }

  // Envía un mensaje a través del WebSocket
  sendMessage(receiverId: string, text: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket no está conectado');
      this.connect(); // Intenta reconectar
      // Almacenar mensaje para enviarlo cuando se reconecte
      this.queueMessageForSending(receiverId, text);
      return;
    }

    const senderId = this.getCurrentUserId();
    if (!senderId) {
      console.error('No hay usuario autenticado');
      return;
    }

    const message = {
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      status: 'sent'
    };

    try {
      this.socket.send(JSON.stringify(message));
      
      // También añadimos el mensaje al subject localmente para mostrar inmediatamente
      const currentMessages = this.messagesSubject.value;
      const newMessage: Message = {
        id: Date.now(), // Generar ID temporal, el servidor debería proporcionar el real
        ...message,
        status: message.status as Message['status'] // Cast status to the correct type
      };
      
      this.messagesSubject.next([...currentMessages, newMessage]);
      
      // Guardar en localStorage
      this.saveMessageToStorage(newMessage);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      // Si falla el envío, guardarlo localmente de todos modos
      this.queueMessageForSending(receiverId, text);
    }
  }

  // Almacena mensajes pendientes para enviar cuando se reconecte
  private queueMessageForSending(receiverId: string, text: string): void {
    const senderId = this.getCurrentUserId();
    if (!senderId) return;
    
    const pendingMessage: Message = {
      id: Date.now(),
      senderId,
      receiverId,
      text,
      timestamp: new Date(),
      status: 'sent'
    };
    
    // Añadir a la lista actual de mensajes
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, pendingMessage]);
    
    // Guardar en localStorage
    this.saveMessageToStorage(pendingMessage);
    
    // Opcional: almacenar en una lista separada de mensajes pendientes
    const pendingMessages = JSON.parse(localStorage.getItem('pending_messages') || '[]');
    pendingMessages.push(pendingMessage);
    localStorage.setItem('pending_messages', JSON.stringify(pendingMessages));
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
        messages.forEach(msg => {
          msg.timestamp = new Date(msg.timestamp);
        });
      } catch (error) {
        console.error('Error al cargar mensajes:', error);
      }
    }
    
    // Actualiza el subject con los mensajes cargados
    this.messagesSubject.next(messages);
    
    // Asegurarnos de que estamos conectados antes de solicitar el historial
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
    } else {
      // Solicitar mensajes históricos desde el servidor
      this.requestHistoricalMessages(friendId);
    }
    
    return this.messages$;
  }

  // Solicita mensajes históricos al servidor
  private requestHistoricalMessages(friendId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket no está conectado');
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
      console.log('Solicitando historial de mensajes para:', friendId);
    } catch (error) {
      console.error('Error al solicitar historial:', error);
    }
  }

  // Guarda un mensaje en el almacenamiento local
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
        return { ...msg, status: 'read' };
      }
      return msg;
    });
    
    if (hasChanges) {
      this.messagesSubject.next(updatedMessages.map(msg => ({
        ...msg,
        status: msg.status as Message['status'] // Ensure status matches the Message type
      })));
      localStorage.setItem(`messages_${friendId}`, JSON.stringify(updatedMessages));
      
      // Notificar al remitente que los mensajes han sido leídos
      // (Requiere implementación en el servidor)
      this.notifyMessagesRead(friendId);
    }
  }

  // Notificar al remitente que los mensajes han sido leídos
  private notifyMessagesRead(friendId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    const userId = this.getCurrentUserId();
    if (!userId) return;
    
    try {
      this.socket.send(JSON.stringify({
        type: 'messages_read',
        readerId: userId,
        senderId: friendId,
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error al notificar mensajes leídos:', error);
    }
  }

  // Desconectar el WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.currentConversationId = null;
    clearTimeout(this.reconnectTimeout);
  }
}