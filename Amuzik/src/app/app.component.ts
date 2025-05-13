import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonApp, 
  IonRouterOutlet} from '@ionic/angular/standalone';
import { SidemenuComponent } from './components/sidemenu/sidemenu.component';
import { TemaService } from './services/tema.service';
import { Keyboard } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';

PushNotifications.requestPermissions().then(result => {
  if (result.receive === 'granted') {
    PushNotifications.register();
  }
});

PushNotifications.addListener('registration', token => {
  console.log('Push registration success, token: ' + token.value);
  // Envíalo a tu backend para almacenarlo
});

PushNotifications.addListener('pushNotificationReceived', notification => {
  console.log('Push received', notification);
});

PushNotifications.addListener('pushNotificationActionPerformed', result => {
  console.log('Action performed', result);
});
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonApp,
    IonRouterOutlet,
    SidemenuComponent
],
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  
  constructor(private temaService: TemaService) {}
}