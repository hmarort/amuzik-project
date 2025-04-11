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
  IonInput,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonFab,
  IonFabButton,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { menuOutline, personAdd, peopleOutline, trashOutline, chatbubbleOutline } from 'ionicons/icons';

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
    IonInput,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonFab,
    IonFabButton
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

  constructor(
    private router: Router,
    private alertController: AlertController
  ) {
    addIcons({
      menuOutline,
      personAdd,
      peopleOutline,
      trashOutline,
      chatbubbleOutline
    });
  }

  ngOnInit() {
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
    this.newFriend.avatar = 'https://randomuser.me/api/portraits/lego/1.jpg';
  }

  addFriend() {
    if (!this.newFriend.name.trim()) {
      alert('Por favor, introduce un nombre para el amigo');
      return;
    }
    const maxId = Math.max(...this.friends.map(f => f.id), 0);
    this.newFriend.id = maxId + 1;
    if (!this.newFriend.avatar) {
      const gender = Math.random() > 0.5 ? 'men' : 'women';
      const randomNum = Math.floor(Math.random() * 99) + 1;
      this.newFriend.avatar = `https://randomuser.me/api/portraits/${gender}/${randomNum}.jpg`;
    }
    this.friends.push({...this.newFriend});
    localStorage.setItem('friendsList', JSON.stringify(this.friends));
    alert(`${this.newFriend.name} ha sido añadido a tu lista de amigos`);
    this.showAddFriendForm = false;
    this.resetNewFriend();
  }

  async removeFriend(friend: Friend) {
    const alert = await this.alertController.create({
      header: 'Eliminar amigo',
      message: `¿Estás seguro de que quieres eliminar a ${friend.name} de tu lista de amigos?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: () => {
            this.friends = this.friends.filter(f => f.id !== friend.id);
            localStorage.setItem('friendsList', JSON.stringify(this.friends));
          }
        }
      ]
    });

    await alert.present();
  }
}