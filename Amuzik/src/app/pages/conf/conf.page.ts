import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonToggle, 
  IonIcon, 
  IonSelect, 
  IonSelectOption,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonAvatar,
  IonButton,
  IonInput,
  IonText,
  IonItemDivider, IonButtons, IonBackButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personOutline, 
  notificationsOutline, 
  settingsOutline, 
  moonOutline, 
  languageOutline, 
  volumeHighOutline, 
  helpCircleOutline, 
  logOutOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { routes } from 'src/app/app.routes';
import { Router } from '@angular/router';

@Component({
  selector: 'app-conf',
  templateUrl: './conf.page.html',
  styleUrls: ['./conf.page.scss'],
  standalone: true,
  imports: [IonBackButton, IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonAvatar,
    IonButton,
    IonItemDivider]
})
export class ConfPage implements OnInit {
  // Usuario de ejemplo
  usuario = {
    nombre: 'Usuario Ejemplo',
    email: 'usuario@ejemplo.com',
    foto: 'https://ionicframework.com/docs/img/demos/avatar.svg'
  };

  // Configuraciones
  configuraciones = {
    cuenta: {
      idioma: 'es',
      tema: false, // false = claro, true = oscuro
    },
    notificaciones: {
      push: true,
      email: true,
      sonido: true,
      vibracion: true
    },
    general: {
      autoGuardado: true,
      sincronizarDatos: true,
      compartirEstadisticas: false
    }
  };

  // Opciones de idioma
  idiomas = [
    { valor: 'es', texto: 'Español' },
    { valor: 'en', texto: 'Inglés' },
    { valor: 'fr', texto: 'Francés' },
    { valor: 'de', texto: 'Alemán' }
  ];

  constructor(private router: Router) {
    // Registrar iconos
    addIcons({
      personOutline, 
      notificationsOutline, 
      settingsOutline, 
      moonOutline, 
      languageOutline, 
      volumeHighOutline, 
      helpCircleOutline, 
      logOutOutline,
      chevronForwardOutline
    });
  }

  ngOnInit() {}
  guardarCambios() {
    // Aquí iría el código para guardar los cambios en el almacenamiento
    console.log('Configuraciones guardadas:', this.configuraciones);
  }

  // Función para cerrar sesión
  cerrarSesion() {
    this.router.navigate(['/login']);
  }
}