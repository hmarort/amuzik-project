import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';  // Import IonicModule for Ionic components
import { ChatComponent } from '../../components/chat/chat.component';  // Asegúrate de importar el componente del chat

@Component({
  selector: 'app-friends',
  templateUrl: './friends.page.html',
  styleUrls: ['./friends.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
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
    const modal = await this.modalController.create({
      component: ChatComponent,
      componentProps: {
        friendId: friendId
      }
    });
    return await modal.present();
  }
}
