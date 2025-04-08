import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink } from '@angular/router';
import {
  IonApp, IonSplitPane, IonMenu, IonHeader, IonToolbar,
  IonTitle, IonContent, IonList, IonItem, IonIcon,
  IonLabel, IonToggle, IonItemDivider, IonRouterOutlet,
  IonButtons, IonMenuButton, IonButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  moonOutline,
  sunnyOutline,
  menuOutline,
  closeOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    FormsModule,
    IonApp,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonToggle,
    IonItemDivider,
    IonRouterOutlet,
    IonButtons,
    IonMenuButton,
    IonButton
  ],
  template: `
    <ion-app>
      <ion-split-pane [disabled]="menuHidden" contentId="main-content">
        <!-- Menú lateral -->
        <ion-menu contentId="main-content" type="push" [disabled]="menuHidden">
          <ion-header>
            <ion-toolbar>
              <ion-title>Menú</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="toggleMenu()">
                  <ion-icon name="close-outline"></ion-icon>
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list>
              <ion-item [routerLink]="['/configuracion']" routerDirection="root">
                <ion-icon name="settings-outline" slot="start"></ion-icon>
                <ion-label>Configuración</ion-label>
              </ion-item>
            </ion-list>
            <!-- Separador -->
            <ion-item-divider></ion-item-divider>
            <!-- Botón para cambiar el tema -->
            <ion-item>
              <ion-icon [name]="darkMode ? 'moon-outline' : 'sunny-outline'" slot="start"></ion-icon>
              <ion-label>Tema oscuro</ion-label>
              <ion-toggle [(ngModel)]="darkMode" (ionChange)="toggleTheme()"></ion-toggle>
            </ion-item>
          </ion-content>
        </ion-menu>
        
        <!-- Área de contenido principal donde se cargarán las páginas -->
        <div class="ion-page" id="main-content">
          <ion-header *ngIf="menuHidden">
            <ion-toolbar>
              <ion-buttons slot="start">
                <ion-button (click)="toggleMenu()">
                  <ion-icon name="menu-outline"></ion-icon>
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-router-outlet></ion-router-outlet>
          </ion-content>
        </div>
      </ion-split-pane>
    </ion-app>
  `,
})
export class AppComponent {
  darkMode = false;
  menuHidden = false;
  
  constructor() {
    // Registrar los iconos que usaremos
    addIcons({
      'settings-outline': settingsOutline,
      'moon-outline': moonOutline,
      'sunny-outline': sunnyOutline,
      'menu-outline': menuOutline,
      'close-outline': closeOutline
    });
    
    // Verificar si hay una preferencia guardada de tema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkMode = localStorage.getItem('darkMode') === 'true' || prefersDark.matches;
    this.applyTheme();
    
    // Cargar el estado del menú si existe
    const savedMenuState = localStorage.getItem('menuHidden');
    if (savedMenuState !== null) {
      this.menuHidden = savedMenuState === 'true';
    }
    
    // Escuchar cambios en las preferencias del sistema
    prefersDark.addEventListener('change', (mediaQuery) => {
      if (localStorage.getItem('darkMode') === null) {
        this.darkMode = mediaQuery.matches;
        this.applyTheme();
      }
    });
  }
  
  toggleTheme() {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    localStorage.setItem('darkMode', this.darkMode.toString());
  }
  
  applyTheme() {
    document.body.classList.toggle('dark', this.darkMode);
  }
  
  toggleMenu() {
    this.menuHidden = !this.menuHidden;
    localStorage.setItem('menuHidden', this.menuHidden.toString());
  }
}