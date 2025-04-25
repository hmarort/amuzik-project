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
import { AuthService, User } from 'src/app/services/auth.service';

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
  friends: User[] = [];
  currentUser: User | null = null;

  newFriend: User = {
    id: '',
    username: '',
    base64: ''
  };

  constructor(
    private router: Router,
    private alertController: AlertController,
    private authService: AuthService
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
    // Suscribirse al usuario actual para obtener la lista de amigos
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      if (user && user.friends) {
        this.friends = user.friends;
      } else {
        this.friends = [];
      }
    });
  }

  openChat(friendId: string) {
    this.router.navigate(['/chat', friendId]);
  }

  cancelAddFriend() {
    this.showAddFriendForm = false;
    this.resetNewFriend();
  }

  resetNewFriend() {
    this.newFriend = {
      id: '',
      username: '',
      base64: ''
    };
  }

  handleImageError() {
    this.newFriend.base64 = 'https://randomuser.me/api/portraits/lego/1.jpg';
  }

  addFriend() {
    if (!this.newFriend.username.trim()) {
      this.presentAlert('Error', 'Por favor, introduce un nombre para el amigo');
      return;
    }

    // Generar un ID temporal para el nuevo amigo
    this.newFriend.id = Date.now().toString();
    
    // Si no se proporciona una imagen, generar una aleatoria
    if (!this.newFriend.base64) {
      const gender = Math.random() > 0.5 ? 'men' : 'women';
      const randomNum = Math.floor(Math.random() * 99) + 1;
      this.newFriend.base64 = `https://randomuser.me/api/portraits/${gender}/${randomNum}.jpg`;
    }

    // Agregar el amigo a la lista actual del usuario
    if (this.currentUser) {
      if (!this.currentUser.friends) {
        this.currentUser.friends = [];
      }
      
      this.currentUser.friends.push({...this.newFriend});
      
      // Actualizar el usuario en el servicio
      this.updateUserData();
      
      this.presentAlert('Éxito', `${this.newFriend.username} ha sido añadido a tu lista de amigos`);
      this.showAddFriendForm = false;
      this.resetNewFriend();
    } else {
      this.presentAlert('Error', 'No se pudo agregar el amigo. No se ha iniciado sesión.');
    }
  }

  async removeFriend(friend: User) {
    const alert = await this.alertController.create({
      header: 'Eliminar amigo',
      message: `¿Estás seguro de que quieres eliminar a ${friend.username} de tu lista de amigos?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: () => {
            if (this.currentUser && this.currentUser.friends) {
              this.currentUser.friends = this.currentUser.friends.filter((f: { id: any; }) => f.id !== friend.id);
              this.updateUserData();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private updateUserData() {
    // Crear FormData para actualizar el usuario
    const formData = new FormData();
    if (this.currentUser) {
      formData.append('id', this.currentUser.id);
      formData.append('friends', JSON.stringify(this.currentUser.friends));
      
      // Actualizar el usuario en el servicio
      this.authService.updateUserData(formData).subscribe({
        next: (response: any) => {
          console.log('Amigos actualizados correctamente');
        },
        error: (error: any) => {
          console.error('Error al actualizar amigos:', error);
          this.presentAlert('Error', 'No se pudieron actualizar los amigos. Por favor, inténtalo de nuevo.');
        }
      });
    }
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });

    await alert.present();
  }
}