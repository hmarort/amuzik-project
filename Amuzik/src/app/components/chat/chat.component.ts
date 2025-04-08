import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonButton, IonToolbar, IonTitle, IonButtons, IonContent, IonItem, IonInput } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [IonInput, IonItem, IonContent, IonButtons, IonTitle, IonToolbar, IonButton, IonHeader,FormsModule, CommonModule ]  // Este componente no necesita ningún módulo extra, ya que el ModalController se provee por Ionic
})
export class ChatComponent {
  @Input()
  friendId!: number;  // Recibimos el ID del amigo

  newMessage: string = '';     // Para el nuevo mensaje
  messages: string[] = [];     // Array para simular los mensajes de la conversación
  
  constructor(private modalController: ModalController) {}

  dismiss() {
    this.modalController.dismiss();  // Cerramos el modal cuando el usuario lo desee
  }

  sendMessage() {
    if (this.newMessage.trim() !== '') {
      this.messages.push(this.newMessage);  // Añadimos el mensaje al array de mensajes
      console.log('Mensaje enviado:', this.newMessage);
      this.newMessage = '';  // Limpiamos el input
    }
  }
}
