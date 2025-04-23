import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
  ToastController,
  IonInput
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  notificationsOutline,
  settingsOutline,
  languageOutline,
  helpCircleOutline,
  logOutOutline,
  chevronForwardOutline,
  cameraOutline
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
    IonItemDivider,
    IonInput
  ]
})
export class ConfPage implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  
  // Datos del usuario
  usuario: User = {
    id: '',
    username: '',
    email: '',
    nombre: '',
    base64: ''
  };
  
  // Para modo edición
  editMode: boolean = false;
  perfilEditado: User = {
    id: '',
    username: '',
    email: '',
    nombre: '',
    apellidos: '',
    base64: ''
  };
  
  // Para vista previa de la imagen
  previewImage: string | null = null;
  selectedFile: File | null = null;
  
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
      chevronForwardOutline,
      cameraOutline
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
        // Copiar los datos al objeto de edición
        this.resetPerfilEditado();
      }
    });
    
    // Obtener el usuario actual si está disponible
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.usuario = currentUser;
      this.resetPerfilEditado();
    }
  }

  ngOnDestroy() {
    // Desuscribirse para evitar memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  toggleEditMode() {
    this.editMode = true;
    this.resetPerfilEditado();
  }

  cancelarEdicion() {
    this.editMode = false;
    this.resetPerfilEditado();
    this.previewImage = null;
    this.selectedFile = null;
  }

  resetPerfilEditado() {
    this.perfilEditado = {
      id: this.usuario.id,
      username: this.usuario.username,
      email: this.usuario.email || '',
      nombre: this.usuario.nombre || '',
      apellidos: this.usuario.apellidos || '',
      base64: this.usuario.base64 || ''
    };
  }

  async guardarPerfil() {
    try {
      const formData = new FormData();
      
      // Añadir datos del usuario
      formData.append('id', this.perfilEditado.id);
      formData.append('username', this.perfilEditado.username);
      formData.append('email', this.perfilEditado.email || '');
      formData.append('nombre', this.perfilEditado.nombre || '');
      formData.append('apellidos', this.perfilEditado.apellidos || '');
      
      // Añadir imagen si se seleccionó
      if (this.selectedFile) {
        formData.append('imagen', this.selectedFile);
      }
      
      // Llamar al servicio para actualizar
      this.authService.updateUserData(formData).subscribe(
        response => {
          this.editMode = false;
          this.previewImage = null;
          this.selectedFile = null;
          this.mostrarToast('Perfil actualizado correctamente');
        },
        error => {
          console.error('Error al actualizar perfil:', error);
          this.mostrarToast('Error al actualizar perfil', 'danger');
        }
      );
    } catch (error) {
      console.error('Error al procesar la actualización del perfil:', error);
      this.mostrarToast('Error al actualizar perfil', 'danger');
    }
  }

  seleccionarImagen() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      
      // Mostrar vista previa
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImage = e.target.result;
      };
      reader.readAsDataURL(this.selectedFile);
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
    // Cambiado a usar el toggle para edición en la misma página
    this.toggleEditMode();
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