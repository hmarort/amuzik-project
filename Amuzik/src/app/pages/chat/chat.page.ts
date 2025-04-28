import { Component, OnInit, ViewChild } from '@angular/core';
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

interface Message {
  id: number;
  text: string;
  isMe: boolean;
  time: Date;
}

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
    IonSpinner
]
})
export class ChatPage implements OnInit {
  @ViewChild('content')
  content!: IonContent;
  
  friendId!: string;
  friend: User | null = null;
  currentUser: User | null = null;
  newMessage: string = '';
  messages: Message[] = [];
  isLoading: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    addIcons({
      send,
      arrowBack
    });
  }

  ngOnInit() {
    // Get the current logged in user
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
    });

    this.route.params.subscribe(params => {
      this.friendId = params['id'];
      this.loadFriendData();
      this.loadMessages();
    });
  }

  ionViewDidEnter() {
    this.scrollToBottom();
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
    const storageKey = `messages_${this.friendId}`;
    const savedMessages = localStorage.getItem(storageKey);
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        
        parsedMessages.forEach((msg: any) => {
          msg.time = new Date(msg.time);
        });
        
        this.messages = parsedMessages;
      } catch (error) {
        console.error('Error al cargar mensajes:', error);
        this.messages = [];
      }
    } else {
      // No saved messages yet, initialize with empty array
      this.messages = [];
    }
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return;
    
    const newMsg: Message = {
      id: this.messages.length + 1,
      text: this.newMessage.trim(),
      isMe: true,
      time: new Date()
    };
    
    this.messages.push(newMsg);
    
    this.saveMessages();
    
    this.newMessage = '';
    
    this.scrollToBottom();
    
    this.simulateResponse();
  }

  simulateResponse() {
    setTimeout(() => {
      const responses = [
        'Ok, entendido',
        '¡Claro!',
        'Me parece bien',
        'Estoy de acuerdo',
        '¿En serio?',
        'Interesante, cuéntame más'
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const responseMsg: Message = {
        id: this.messages.length + 1,
        text: randomResponse,
        isMe: false,
        time: new Date()
      };
      
      this.messages.push(responseMsg);
      
      this.saveMessages();
      
      this.scrollToBottom();
    }, 1000);
  }

  saveMessages() {
    const storageKey = `messages_${this.friendId}`;
    localStorage.setItem(storageKey, JSON.stringify(this.messages));
  }

  scrollToBottom() {
    if (this.content) {
      setTimeout(() => {
        this.content.scrollToBottom(300);
      }, 100);
    }
  }

  // Helper function to get user's avatar
  getFriendAvatar(): string {
    if (!this.friend) return '';
    return this.friend.base64 || 'assets/img/default-avatar.png'; // Fallback to default avatar
  }
}