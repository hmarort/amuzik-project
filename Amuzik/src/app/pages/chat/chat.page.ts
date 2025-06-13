import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonBackButton,
  IonFooter,
  IonInput,
  IonButton,
  IonIcon,
  IonAvatar,
  IonSpinner,
  IonBadge, IonItem, IonText, IonList, IonRow, IonCol, IonGrid } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, arrowBack, checkmarkDone, checkmark, checkmarkDoneSharp, alertCircleOutline, arrowBackOutline, chatbubbleOutline } from 'ionicons/icons';
import { AuthService, User } from 'src/app/services/auth.service';
import { ChatService, Message } from 'src/app/services/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [IonItem,
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonFooter,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner]
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild('content')
  content!: IonContent;
  
  friendId!: string;
  friend: User | null = null;
  currentUser: User | null = null;
  newMessage: string = '';
  messages: Message[] = [];
  isLoading: boolean = false;
  
  private subscriptions: Subscription[] = [];
  private mutationObserver: MutationObserver | null = null;
  
  /**
   * Constructor de la clase
   * @param route 
   * @param authService 
   * @param chatService 
   */
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private chatService: ChatService
  ) {
    addIcons({alertCircleOutline,arrowBackOutline,chatbubbleOutline,send,arrowBack,checkmarkDone,checkmarkDoneSharp,checkmark});
  }

  /**
   * Inicializa el componente.
   */
  ngOnInit() {
    const userSub = this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      if (user && this.friendId) {
        // Conectar al WebSocket cuando tengamos usuario y amigo
        this.chatService.connect();
      }
    });
    this.subscriptions.push(userSub);

    const routeSub = this.route.params.subscribe(params => {
      this.friendId = params['id'];
      this.loadFriendData();
      this.loadMessages();
    });
    this.subscriptions.push(routeSub);
  }

  /**
   * Limpia las suscripciones y el observer al destruir el componente.
   */
  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Limpiar observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  /**
   * Cuando entramos en la vista nos desplaza para abajo y organiza los mensajes
   */
  ionViewDidEnter() {
    this.scrollToBottom();
    this.setupMessageObserver();
    
    if (this.friendId) {
      this.chatService.markMessagesAsRead(this.friendId);
    }
  }

  /**
   * Limpia todo, y deja de obersevar cambios
   */
  ionViewWillLeave() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  /**
   * Configura un observer para detectar cambios en el contenedor de mensajes
   */
  private setupMessageObserver(): void {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer && !this.mutationObserver) {
      this.mutationObserver = new MutationObserver(() => {
        this.scrollToBottom();
      });
      
      this.mutationObserver.observe(chatContainer, { 
        childList: true, 
        subtree: true 
      });
    }
  }
  
  /**
   * Carga los datos del amigo actual.
   */
  loadFriendData() {
    this.isLoading = true;
    if (this.currentUser && this.currentUser.friends) {
      this.friend = this.currentUser.friends.find(f => f.id === this.friendId) || null;
      this.isLoading = false;
    } else {
      // Otherwise refresh user data from server
      this.authService.refreshUserData().subscribe({
        next: () => {
          if (this.currentUser && this.currentUser.friends) {
            this.friend = this.currentUser.friends.find(f => f.id === this.friendId) || null;
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading user data:', error);
          this.isLoading = false;
        }
      });
    }
  }
  
  /**
   * Carga los mensajes de la conversación con el amigo actual.
   */
  loadMessages() {
    this.isLoading = true;
    
    const messagesSub = this.chatService.loadConversation(this.friendId).subscribe({
      next: (messages) => {
        this.messages = this.sortMessagesByDate(messages);
        this.isLoading = false;
        this.scrollToBottom();
        
        // Marcar mensajes como leídos
        if (this.friendId) {
          this.chatService.markMessagesAsRead(this.friendId);
        }
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.isLoading = false;
      }
    });
    
    this.subscriptions.push(messagesSub);
  }

  /**
   * Ordena los mensajes por fecha
   * @param messages 
   * @returns 
   */
  private sortMessagesByDate(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Envía un nuevo mensaje.
   * @returns 
   */
  sendMessage() {
    if (this.newMessage.trim() === '') return;
    
    this.chatService.sendMessage(this.friendId, this.newMessage.trim());
    this.newMessage = '';
    this.scrollToBottom();
  }

  /**
   * Desplaza el contenido hacia abajo para mostrar el último mensaje.
   */
  scrollToBottom() {
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToBottom(300);
      }, 100);
    }
  }

  /**
   * Determina si un mensaje fue enviado por el usuario actual.
   * @param message 
   * @returns 
   */
  isMyMessage(message: Message): boolean {
    return message.senderId === this.currentUser?.id;
  }

  /**
   * Obtiene el avatar del amigo.
   * @returns 
   */
  getFriendAvatar(): string {
    if (!this.friend) return '';
    return this.friend.base64 || 'assets/img/default-avatar.png';
  }
  
  /**
   * Obtiene el icono de estado del mensaje.
   * @param message 
   * @returns 
   */
  getMessageStatusIcon(message: Message): string {
    if (!message.status || !this.isMyMessage(message)) return '';
    
    switch (message.status) {
      case 'sent': return 'checkmark';
      case 'delivered': return 'checkmark-done';
      case 'read': return 'checkmark-done-sharp';
      default: return '';
    }
  }
  
  /**
   * Formatea la fecha del mensaje para mostrarla de manera legible.
   * @param date 
   * @returns 
   */
  formatMessageTime(date: Date): string {
    if (!date) return '';
    
    const today = new Date();
    const messageDate = new Date(date);
    
    // Si es hoy, solo mostrar hora
    if (today.toDateString() === messageDate.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
    }
    
    // Si es ayer
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === messageDate.toDateString()) {
      return 'Ayer ' + messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Si es de la semana actual, mostrar día de la semana
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayDiff = (today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff < 7) {
      return daysOfWeek[messageDate.getDay()] + ' ' + 
             messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return messageDate.toLocaleDateString() + ' ' + 
           messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}