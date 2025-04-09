import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular/standalone';
import { ChatComponent } from '../../components/chat/chat.component';
import { SidemenuComponent } from '../../components/sidemenu/sidemenu.component';
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { menuOutline } from 'ionicons/icons';

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
    SidemenuComponent,
  ],
})
export class FriendsPage implements OnInit {
  friends: { id: number; name: string; avatar: string }[] = [
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

  constructor(private modalController: ModalController) {
    // Registrar el icono del menú
    addIcons({
      menuOutline
    });
  }

  ngOnInit() {}

  async openChat(friendId: number) {
    try {
      const modal = await this.modalController.create({
        component: ChatComponent,
        componentProps: {
          friendId: friendId,
        },
        backdropDismiss: false,
        initialBreakpoint: 1.0,
        breakpoints: [0, 0.5, 1.0],
      });
      await modal.present();
      const { data } = await modal.onWillDismiss();
      console.log('Chat cerrado', data);
    } catch (error) {
      console.error('Error al abrir el chat:', error);
    }
  }
}