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
  IonFooter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  settingsOutline, 
  brushOutline,
  moonOutline, 
  sunnyOutline, homeOutline } from 'ionicons/icons';
import { Router } from '@angular/router';

@Component({
  selector: 'app-side-menu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss'],
  standalone: true,
  imports: [
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
    IonMenuToggle,
    IonFooter,
  ]
})
export class SidemenuComponent implements OnInit {
  darkMode = false;

  constructor(private router: Router) {
    // Registrar iconos
    addIcons({settingsOutline,brushOutline,homeOutline,moonOutline,sunnyOutline});
    
    // Cargar preferencia de tema
    const savedTheme = localStorage.getItem('darkMode');
    this.darkMode = savedTheme === 'true';
    this.setTheme(this.darkMode);
  }

  ngOnInit() {}

  // Método para cambiar entre modo oscuro y claro
  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    this.setTheme(this.darkMode);
    localStorage.setItem('darkMode', this.darkMode.toString());
  }

  // Método para aplicar el tema
  setTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark);
  }

  // Navegar a configuración
  goToSettings() {
    this.router.navigate(['/conf']);
  }

  // Navegar a apariencia
  goToAppearance() {
    this.router.navigate(['/apariencia']);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }
}