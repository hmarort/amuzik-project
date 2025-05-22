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
  IonInput,
  IonModal, IonFooter
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
  cameraOutline,
  eyeOutline,
  eyeOffOutline,
  closeOutline,
  cropOutline,
  checkmarkOutline,
  imageOutline
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { ConfigService } from '../../services/config.service';
import { AuthService, User } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { ImageCroppedEvent, ImageCropperComponent, LoadedImage } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-conf',
  templateUrl: './conf.page.html',
  styleUrls: ['./conf.page.scss'],
  standalone: true,
  imports: [IonFooter,
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
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonAvatar,
    IonButton,
    IonItemDivider,
    IonInput,
    IonModal,
    ImageCropperComponent]
})
export class ConfPage implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('cropperModal') cropperModal!: IonModal;

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

  // Variables para el cropper
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper = false;
  originalFileName = '';
  originalFileType = '';
  cropperHeight = 300; // Altura por defecto del cropper

  private userSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private configService: ConfigService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
    private sanitizer: DomSanitizer
  ) {
    addIcons({
      personOutline,
      notificationsOutline,
      settingsOutline,
      languageOutline,
      helpCircleOutline,
      logOutOutline,
      chevronForwardOutline,
      cameraOutline,
      eyeOutline,
      eyeOffOutline,
      closeOutline,
      cropOutline,
      checkmarkOutline,
      imageOutline
    });
  }

  ngOnInit() {
    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

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

      // Siempre añadir el ID
      formData.append('id', this.perfilEditado.id);

      // Comparar los campos actuales con los originales y solo añadir los modificados
      if (this.perfilEditado.username !== this.usuario.username) {
        formData.append('username', this.perfilEditado.username);
      }

      if (this.perfilEditado.email !== this.usuario.email) {
        formData.append('email', this.perfilEditado.email || '');
      }

      if (this.perfilEditado.nombre !== this.usuario.nombre) {
        formData.append('nombre', this.perfilEditado.nombre || '');
      }

      if (this.perfilEditado.apellidos !== this.usuario.apellidos) {
        formData.append('apellidos', this.perfilEditado.apellidos || '');
      }

      // Añadir imagen solo si se seleccionó una nueva
      if (this.selectedFile) {
        formData.append('pfp', this.selectedFile); // Cambiado a 'pfp' para que coincida con el backend
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
          this.mostrarToast('Error al actualizar perfil: ' + (error.error?.error || 'Error desconocido'), 'danger');
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
      const file = input.files[0];

      // Validar tipo de archivo
      if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
        this.mostrarToast('Por favor, selecciona una imagen válida (JPEG, PNG, GIF o WEBP)', 'warning');
        return;
      }

      // Validar tamaño máximo (5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.mostrarToast('La imagen no debe exceder los 5MB', 'warning');
        return;
      }

      // Guardar el nombre y tipo del archivo original
      this.originalFileName = file.name;
      this.originalFileType = file.type;

      // Iniciar el proceso de recorte
      this.imageChangedEvent = event;
      this.showCropper = true;

      // Presentar el modal después de un breve retraso para asegurar que el DOM esté listo
      setTimeout(() => {
        this.cropperModal.present();
      }, 100);
    }
  }

  imageCropped(event: ImageCroppedEvent) {
    // Guardar la imagen recortada y sanitizar el objectUrl para mayor seguridad
    if (event.objectUrl) {
      this.croppedImage = event.objectUrl;
    } else if (event.base64) {
      // Respaldo si no hay objectUrl
      this.croppedImage = event.base64;
    }
  }

  imageLoaded(image: LoadedImage) {
    // Imagen cargada en el cropper
    console.log('Imagen cargada en el cropper', image);

    // Ajustar altura según la imagen cargada
    const imgElement = image.original.image as HTMLImageElement;
    if (imgElement) {
      // Calcular una altura razonable basada en las dimensiones de la imagen
      // pero manteniéndola dentro de límites razonables para la UI
      const aspectRatio = imgElement.naturalWidth / imgElement.naturalHeight;
      this.cropperHeight = Math.min(400, Math.round(300 / aspectRatio));
    }
  }

  cropperReady() {
    // El cropper está listo
    console.log('Cropper listo');
  }

  loadImageFailed() {
    // Error al cargar la imagen
    this.mostrarToast('Error al cargar la imagen', 'danger');
    this.showCropper = false;
    this.cropperModal.dismiss();
  }

  async confirmCrop() {
    if (!this.croppedImage) {
      this.mostrarToast('Error al procesar la imagen', 'danger');
      return;
    }

    try {
      // Si tenemos un objectUrl, usarlo para crear un Blob/File
      if (this.croppedImage.startsWith('blob:')) {
        // Actualizar la vista previa (sanitizada)
        this.previewImage = this.croppedImage;

        // Obtener el blob desde el objectUrl
        const response = await fetch(this.croppedImage);
        const blob = await response.blob();

        // Crear un File a partir del Blob
        this.selectedFile = new File([blob], this.originalFileName, {
          type: this.originalFileType || blob.type
        });
      }
      // Si tenemos un base64, convertirlo a File
      else if (this.croppedImage.startsWith('data:')) {
        // Actualizar la vista previa (sanitizada)
        this.previewImage = this.croppedImage;

        // Convertir base64 a File
        const file = await this.base64ToFile(
          this.croppedImage,
          this.originalFileName,
          this.originalFileType
        );

        this.selectedFile = file;
      }

      // Cerrar el modal
      this.cropperModal.dismiss();
      this.showCropper = false;
    } catch (error) {
      console.error('Error al procesar la imagen recortada:', error);
      this.mostrarToast('Error al procesar la imagen recortada', 'danger');
    }
  }

  cancelCrop() {
    this.cropperModal.dismiss();
    this.showCropper = false;
    this.imageChangedEvent = '';
    this.croppedImage = '';
  }

  base64ToFile(
    dataUrl: string,
    filename: string,
    mimeType: string
  ): Promise<File> {
    // Extraer la parte de datos del base64 (eliminar el prefijo data:image/xyz;base64,)
    const base64Data = dataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType || 'image/png' });
    return Promise.resolve(new File([blob], filename, { type: mimeType || 'image/png' }));
  }

  async cerrarSesion() {

    this.logout();

  }

  logout() {
    // Usar el authService para cerrar sesión
    this.authService.logout();
  }

  editarPerfil() {
    // Cambiado a usar el toggle para edición en la misma página
    this.toggleEditMode();
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