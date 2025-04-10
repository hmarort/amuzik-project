import { Component, OnInit, ViewChild, AfterViewChecked } from '@angular/core';
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
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, arrowBack } from 'ionicons/icons';

interface Message {
  id: number;
  text: string;
  isMe: boolean;
  time: Date;
}

interface Friend {
  id: number;
  name: string;
  avatar: string;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [
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
    CommonModule, 
    FormsModule
  ]
})
export class ChatPage implements OnInit, AfterViewChecked {
  @ViewChild('content')
  content!: IonContent;
  
  friendId!: number;
  friend: Friend | null = null;
  newMessage: string = '';
  messages: Message[] = [];
  
  // Lista de amigos para buscar según el ID
  friends: Friend[] = [
    {
      id: 1,
      name: 'Juan Pérez',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
    {
      id: 2,
      name: 'Ana López',
      avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
    },
    {
      id: 3,
      name: 'Carlos García',
      avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
    },
    {
      id: 4,
      name: 'Laura Martín',
      avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    },
  ];
  
  // Mensajes de ejemplo pre-cargados (simulación)
  mockMessages: { [key: number]: Message[] } = {
    1: [
      { id: 1, text: 'Hola Juan, ¿cómo estás?', isMe: true, time: new Date(Date.now() - 3600000) },
      { id: 2, text: '¡Hola! Todo bien, ¿y tú?', isMe: false, time: new Date(Date.now() - 3500000) },
      { id: 3, text: 'Muy bien, gracias. ¿Qué tal el proyecto?', isMe: true, time: new Date(Date.now() - 3400000) }
    ],
    2: [
      { id: 1, text: 'Ana, ¿viste el email que envié?', isMe: true, time: new Date(Date.now() - 86400000) },
      { id: 2, text: 'Sí, ya lo revisé. Te responderé más tarde', isMe: false, time: new Date(Date.now() - 82800000) }
    ],
    3: [
      { id: 1, text: 'Hola Carlos, necesito los documentos', isMe: true, time: new Date(Date.now() - 172800000) },
      { id: 2, text: 'Te los envío mañana sin falta', isMe: false, time: new Date(Date.now() - 169200000) }
    ],
    4: [
      { id: 1, text: 'Laura, ¿asistirás a la reunión?', isMe: true, time: new Date(Date.now() - 259200000) },
      { id: 2, text: 'Sí, allí estaré', isMe: false, time: new Date(Date.now() - 255600000) },
      { id: 3, text: 'Perfecto, nos vemos entonces', isMe: true, time: new Date(Date.now() - 252000000) }
    ]
  };

  constructor(private route: ActivatedRoute) {
    // Registrar los iconos necesarios
    addIcons({
      send,
      arrowBack
    });
  }

  ngOnInit() {
    // Obtener el ID del amigo de los parámetros de la ruta
    this.route.params.subscribe(params => {
      this.friendId = +params['id']; // Convertir a número
      this.loadFriendData();
      this.loadMessages();
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  loadFriendData() {
    this.friend = this.friends.find(f => f.id === this.friendId) || null;
  }

  loadMessages() {
    // Cargar mensajes simulados según el ID del amigo
    this.messages = this.mockMessages[this.friendId] || [];
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return;
    
    // Crear nuevo mensaje
    const newMsg: Message = {
      id: this.messages.length + 1,
      text: this.newMessage.trim(),
      isMe: true,
      time: new Date()
    };
    
    // Añadir mensaje a la lista
    this.messages.push(newMsg);
    
    // Limpiar el campo de entrada
    this.newMessage = '';
    
    // Desplazar al fondo para ver el mensaje nuevo
    this.scrollToBottom();
    
    // Simular respuesta del amigo
    this.simulateResponse();
  }

  simulateResponse() {
    // Simular una respuesta después de un pequeño retraso
    setTimeout(() => {
      const responses = [
        'Ok, entendido',
        '¡Claro!',
        'Me parece bien',
        'Estoy de acuerdo',
        '¿En serio?',
        'Interesante, cuéntame más'
      ];
      
      // Elegir una respuesta aleatoria
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      // Crear mensaje de respuesta
      const responseMsg: Message = {
        id: this.messages.length + 1,
        text: randomResponse,
        isMe: false,
        time: new Date()
      };
      
      // Añadir a la lista de mensajes
      this.messages.push(responseMsg);
      
      // Desplazar al fondo
      this.scrollToBottom();
    }, 1000);
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }
}