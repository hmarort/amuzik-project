import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular/standalone';
import { ChatComponent } from '../../components/chat/chat.component';
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
  IonMenuButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-friends',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Friends</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Friends</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-list>
        <ion-item *ngFor="let friend of friends" (click)="openChat(friend.id)">
          <ion-avatar slot="start">
            <img [src]="friend.avatar" />
          </ion-avatar>
          <ion-label>
            <h2>{{ friend.name }}</h2>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
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
    IonMenuButton
  ]
})
export class FriendsPage implements OnInit {
  friends: { id: number, name: string, avatar: string }[] = [
    { id: 1, name: 'Juan Pérez', avatar: 'https://randomuser.me/api/portraits/men/1.jpg' },
    { id: 2, name: 'Ana López', avatar: 'https://randomuser.me/api/portraits/women/1.jpg' },
    { id: 3, name: 'Carlos García', avatar: 'https://randomuser.me/api/portraits/men/2.jpg' },
    { id: 4, name: 'Laura Martín', avatar: 'https://randomuser.me/api/portraits/women/2.jpg' }
  ];
  
  constructor(private modalController: ModalController) { }
  
  ngOnInit() {}
  
  async openChat(friendId: number) {
    try {
      const modal = await this.modalController.create({
        component: ChatComponent,
        componentProps: {
          friendId: friendId
        },
        backdropDismiss: false,
        initialBreakpoint: 1.0,
        breakpoints: [0, 0.5, 1.0]
      });
      await modal.present();
      // Manejar el resultado del modal cuando se cierre
      const { data } = await modal.onWillDismiss();
      console.log('Chat cerrado', data);
    } catch (error) {
      console.error('Error al abrir el chat:', error);
    }
  }
}