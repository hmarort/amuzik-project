import { Component, OnInit, OnDestroy } from '@angular/core';
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
  IonItemDivider, 
  IonButtons, 
  IonBackButton,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  notificationsOutline,
  settingsOutline,
  languageOutline,
  helpCircleOutline,
  logOutOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { ConfigService, Configuraciones } from '../../services/config.service';
import { AuthService, User } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-conf',
  templateUrl: './conf.page.html',
  styleUrls: ['./conf.page.scss'],
  standalone: true,
  imports: [
    IonBackButton, 
    IonButtons,
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
    IonItemDivider
  ]
})
export class ConfPage implements OnInit, OnDestroy {
  // Datos del usuario
  usuario: User = {
    id: '',
    username: '',
    email: '',
    nombre: '',
    base64: ''
  };
  
  private userSubscription: Subscription | null = null;
  
  // Configuraciones
  configuraciones: Configuraciones;
  configuracionesOriginales: Configuraciones;
  
  // Opciones de idioma
  idiomas = [
    { valor: 'es', texto: 'Español' },
    { valor: 'en', texto: 'Inglés' },
    { valor: 'fr', texto: 'Francés' },
    { valor: 'de', texto: 'Alemán' }
  ];

  constructor(
    private router: Router,
    private configService: ConfigService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    addIcons({
      personOutline,
      notificationsOutline,
      settingsOutline,
      languageOutline,
      helpCircleOutline,
      logOutOutline,
      chevronForwardOutline
    });
    
    // Inicializar con valores por defecto
    this.configuraciones = this.configService.configuracionesActuales;
    this.configuracionesOriginales = JSON.parse(JSON.stringify(this.configuraciones));
  }

  ngOnInit() {
    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    
    // Suscribirnos a los cambios en las configuraciones
    this.configService.configuraciones$.subscribe(config => {
      this.configuraciones = config;
      this.configuracionesOriginales = JSON.parse(JSON.stringify(config));
    });
    
    // Suscribirnos a los cambios en el usuario desde AuthService
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.usuario = user;
      }
    });
    
    // Obtener el usuario actual si está disponible
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.usuario = currentUser;
    }
  }

  ngOnDestroy() {
    // Desuscribirse para evitar memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  async guardarCambios() {
    try {
      // Guardar configuraciones usando el servicio
      this.configService.guardarConfiguraciones(this.configuraciones).subscribe(
        () => {
          this.configuracionesOriginales = JSON.parse(JSON.stringify(this.configuraciones));
          this.mostrarToast('Configuraciones guardadas correctamente');
        },
        error => {
          console.error('Error al guardar configuraciones:', error);
          this.mostrarToast('Error al guardar configuraciones', 'danger');
        }
      );
    } catch (error) {
      console.error('Error al guardar configuraciones:', error);
      this.mostrarToast('Error al guardar configuraciones', 'danger');
    }
  }

  async cerrarSesion() {
    // Verificar si hay cambios sin guardar
    if (this.hayCambiosSinGuardar()) {
      const alert = await this.alertController.create({
        header: 'Cambios sin guardar',
        message: '¿Desea guardar los cambios antes de cerrar sesión?',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Salir sin guardar',
            handler: () => {
              this.logout();
            }
          },
          {
            text: 'Guardar y salir',
            handler: () => {
              this.guardarCambios();
              this.logout();
            }
          }
        ]
      });
      await alert.present();
    } else {
      this.logout();
    }
  }

  logout() {
    // Usar el authService para cerrar sesión
    this.authService.logout();
  }

  editarPerfil() {
    // Navegar a la página de edición de perfil
    this.router.navigate(['/editar-perfil']);
  }

  hayCambiosSinGuardar(): boolean {
    return JSON.stringify(this.configuraciones) !== JSON.stringify(this.configuracionesOriginales);
  }

  async mostrarToast(mensaje: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }
}