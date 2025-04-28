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
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, arrowBack } from 'ionicons/icons';
import { AuthService, User } from 'src/app/services/auth.service';
import { ChatService, Message } from 'src/app/services/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [
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
    IonAvatar,
    IonSpinner
  ]
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
  
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private chatService: ChatService
  ) {
    addIcons({
      send,
      arrowBack
    });
  }

  ngOnInit() {
    // Get the current logged in user
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

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ionViewDidEnter() {
    this.scrollToBottom();
  }

  ionViewWillLeave() {
    // Opcional: desconectar WebSocket cuando salimos de la página
    // this.chatService.disconnect();
  }

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

  loadMessages() {
    this.isLoading = true;
    
    const messagesSub = this.chatService.loadConversation(this.friendId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        this.isLoading = false;
      }
    });
    
    this.subscriptions.push(messagesSub);
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return;
    
    this.chatService.sendMessage(this.friendId, this.newMessage.trim());
    this.newMessage = '';
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToBottom(300);
      }, 100);
    }
  }

  // Helper method to determine if a message was sent by the current user
  isMyMessage(message: Message): boolean {
    return message.senderId === this.currentUser?.id;
  }

  // Helper function to get user's avatar
  getFriendAvatar(): string {
    if (!this.friend) return '';
    return this.friend.base64 || 'assets/img/default-avatar.png'; // Fallback to default avatar
  }
}