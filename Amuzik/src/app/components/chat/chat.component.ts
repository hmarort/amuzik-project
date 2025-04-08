import { Component, Input, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, IonContent, AnimationController } from '@ionic/angular';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ChatComponent implements AfterViewInit {
  @Input() friendId!: number;
  @ViewChild(IonContent) content!: IonContent;
  
  newMessage: string = '';
  messages: string[] = [];
  friend: string = '';

  constructor(
    private modalController: ModalController,
    private animationCtrl: AnimationController
  ) {}

  ngAfterViewInit() {
    // Simulamos obtener el nombre del amigo basado en el ID
    setTimeout(() => {
      this.friend = `Amigo ${this.friendId}`;
      // Añadimos algunos mensajes de ejemplo
      this.messages = [
        `Hola, soy el ${this.friend}!`,
        `¿Cómo estás hoy?`
      ];
      this.scrollToBottom();
    }, 300);
  }

  dismiss() {
    this.modalController.dismiss({
      'dismissed': true
    });
  }

  sendMessage() {
    if (this.newMessage.trim() !== '') {
      this.messages.push(this.newMessage);
      console.log('Mensaje enviado:', this.newMessage);
      this.newMessage = '';
      
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }
}