import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonMenuToggle,
  IonFooter, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  settingsOutline, 
  brushOutline,
  moonOutline, 
  sunnyOutline, homeOutline, downloadOutline } from 'ionicons/icons';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
@Component({
  selector: 'app-side-menu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss'],
  standalone: true,
  imports: [IonButton, 
    CommonModule,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle
]
})
export class SidemenuComponent implements OnInit {
  darkMode = false;

  isNative: boolean = Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android';
  /**
   * Constructor del componente
   * @param router 
   */
  constructor(private router: Router) {
    addIcons({settingsOutline,brushOutline,homeOutline,downloadOutline,moonOutline,sunnyOutline});

    const savedTheme = localStorage.getItem('darkMode');
    this.darkMode = savedTheme === 'true';
  }

  /**
   * Inicializa el componente
   */
  ngOnInit() {}

  /**
   * Navegar a conf
   */
  goToSettings() {
    this.router.navigate(['/conf']);
  }

  /**
   * Navegar a apariencia
   */
  goToAppearance() {
    this.router.navigate(['/apariencia']);
  }
  
  /**
   * Navegar a home
   */
  goToHome() {
    this.router.navigate(['/home']);
  }
}