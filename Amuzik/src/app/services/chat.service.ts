import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Message {
  id: number;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
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
      // Reemplaza esta URL con la de tu servidor WebSocket
      this.socket = new WebSocket(`http://localhost:8080?userId=${userId}`);
      
      this.socket.onopen = () => {
        console.log('WebSocket conectado');
        this.reconnectAttempts = 0;
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleIncomingMessage(message);
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

  // Maneja mensajes entrantes
  private handleIncomingMessage(message: Message): void {
    const currentMessages = this.messagesSubject.value;
    // Asegúrate de que el mensaje tenga un timestamp como Date
    message.timestamp = new Date(message.timestamp);
    this.messagesSubject.next([...currentMessages, message]);
    
    // Opcional: Guardar en localStorage para persistencia
    this.saveMessageToStorage(message);
  }

  // Envía un mensaje a través del WebSocket
  sendMessage(receiverId: string, text: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket no está conectado');
      this.connect(); // Intenta reconectar
      return;
    }

    let senderId: string | null = null;
    this.authService.currentUser$.subscribe(user => {
      senderId = user?.id || null;
    });
    if (!senderId) {
      console.error('No hay usuario autenticado');
      return;
    }

    const message = {
      senderId,
      receiverId,
      text,
      timestamp: new Date()
    };

    try {
      this.socket.send(JSON.stringify(message));
      
      // También añadimos el mensaje al subject localmente para mostrar inmediatamente
      const currentMessages = this.messagesSubject.value;
      const newMessage: Message = {
        id: Date.now(), // Generar ID temporal, el servidor debería proporcionar el real
        ...message
      };
      
      this.messagesSubject.next([...currentMessages, newMessage]);
      
      // Guardar en localStorage
      this.saveMessageToStorage(newMessage);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    }
  }

  // Carga los mensajes para una conversación específica
  loadConversation(friendId: string): Observable<Message[]> {
    // Intenta cargar mensajes del localStorage
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
    
    // También puedes cargar mensajes históricos desde el servidor
    this.requestHistoricalMessages(friendId);
    
    return this.messages$;
  }

  // Solicita mensajes históricos al servidor
  private requestHistoricalMessages(friendId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket no está conectado');
      return;
    }

    let userId: string | null = null;
    this.authService.currentUser$.subscribe(user => {
      userId = user?.id || null;
    });
    if (!userId) return;

    const request = {
      type: 'history_request',
      userId,
      friendId
    };

    try {
      this.socket.send(JSON.stringify(request));
    } catch (error) {
      console.error('Error al solicitar historial:', error);
    }
  }

  // Guarda un mensaje en el almacenamiento local
  private saveMessageToStorage(message: Message): void {
    let userId: string | null = null;
    this.authService.currentUser$.subscribe(user => {
      userId = user?.id || null;
    });
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
      } catch (error) {
        console.error('Error al parsear mensajes:', error);
      }
    }
    
    // Añadir nuevo mensaje y guardar
    messages.push(message);
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }

  // Desconectar el WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    clearTimeout(this.reconnectTimeout);
  }
}