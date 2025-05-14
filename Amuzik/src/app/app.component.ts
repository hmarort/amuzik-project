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