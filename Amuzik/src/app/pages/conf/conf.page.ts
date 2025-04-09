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
  IonItemDivider
} from '@ionic/angular/standalone';
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

@Component({
  selector: 'app-conf',
  templateUrl: './conf.page.html',
  styleUrls: ['./conf.page.scss'],
  standalone: true,
  imports: [
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
    IonInput,
    IonText,
    IonItemDivider
  ]
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

  constructor() {
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

  ngOnInit() {
    // Inicialización de la página
  }
  guardarCambios() {
    // Aquí iría el código para guardar los cambios en el almacenamiento
    console.log('Configuraciones guardadas:', this.configuraciones);
  }

  // Función para cerrar sesión
  cerrarSesion() {
    console.log('Cerrando sesión...');
    // Aquí iría la lógica para cerrar sesión
  }
}