import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonInput
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { menuOutline, personAdd, peopleOutline } from 'ionicons/icons';

interface Friend {
  id: number;
  name: string;
  avatar: string;
}

@Component({
  selector: 'app-friends',
  templateUrl: './friends.page.html',
  styleUrls: ['./friends.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonInput
  ],
})
export class FriendsPage implements OnInit {
  showAddFriendForm = false;
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
  
  newFriend: Friend = {
    id: 0,
    name: '',
    avatar: ''
  };

  constructor(private router: Router) {
    // Registrar los iconos necesarios
    addIcons({
      menuOutline,
      personAdd,
      peopleOutline
    });
  }

  ngOnInit() {
    // Cargar amigos desde localStorage si existen
    const savedFriends = localStorage.getItem('friendsList');
    if (savedFriends) {
      try {
        this.friends = JSON.parse(savedFriends);
      } catch (error) {
        console.error('Error al cargar amigos:', error);
      }
    }
  }

  openChat(friendId: number) {
    // Navegar a la página de chat con el ID del amigo
    this.router.navigate(['/chat', friendId]);
  }
  
  cancelAddFriend() {
    this.showAddFriendForm = false;
    this.resetNewFriend();
  }
  
  resetNewFriend() {
    this.newFriend = {
      id: 0,
      name: '',
      avatar: ''
    };
  }
  
  handleImageError() {
    // Si la imagen no carga, establecer una imagen por defecto
    this.newFriend.avatar = 'https://randomuser.me/api/portraits/lego/1.jpg';
  }
  
  addFriend() {
    if (!this.newFriend.name.trim()) {
      alert('Por favor, introduce un nombre para el amigo');
      return;
    }
    
    // Generar un ID único para el nuevo amigo
    const maxId = Math.max(...this.friends.map(f => f.id), 0);
    this.newFriend.id = maxId + 1;
    
    // Si no se proporciona un avatar, asignar uno aleatorio
    if (!this.newFriend.avatar) {
      const gender = Math.random() > 0.5 ? 'men' : 'women';
      const randomNum = Math.floor(Math.random() * 99) + 1;
      this.newFriend.avatar = `https://randomuser.me/api/portraits/${gender}/${randomNum}.jpg`;
    }
    
    // Añadir el nuevo amigo a la lista
    this.friends.push({...this.newFriend});
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('friendsList', JSON.stringify(this.friends));
    
    // Mostrar mensaje de confirmación
    alert(`${this.newFriend.name} ha sido añadido a tu lista de amigos`);
    
    // Cerrar el formulario y reiniciar
    this.showAddFriendForm = false;
    this.resetNewFriend();
  }
}