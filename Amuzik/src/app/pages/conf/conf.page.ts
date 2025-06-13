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
  IonMenuToggle,
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
    IonMenuToggle,
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
    base64: '',
    password: ''
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
  cropperHeight = 300;

  private userSubscription: Subscription | null = null;

  /**
   * Constuctor de la clase
   * @param router 
   * @param authService 
   * @param alertController 
   * @param toastController 
   * @param sanitizer 
   */
  constructor(
    private router: Router,
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

  /**
   * Inicializa el componente
   * @returns 
   */
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

  /**
   * Limpia las suscripciones al destruir el componente
   */
  ngOnDestroy() {
    // Desuscribirse para evitar memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  /**
   * Activa el modo de edición del perfil.
   */
  toggleEditMode() {
    this.editMode = true;
    this.resetPerfilEditado();
  }

  /**
   * Cancela la edición y resetea los datos del perfil editado.
   */
  cancelarEdicion() {
    this.editMode = false;
    this.resetPerfilEditado();
    this.previewImage = null;
    this.selectedFile = null;
  }

  /**
   * Resetea los datos del perfil editado con los datos actuales del usuario.
   */
  resetPerfilEditado() {
    this.perfilEditado = {
      id: this.usuario.id,
      username: this.usuario.username,
      email: this.usuario.email || '',
      nombre: this.usuario.nombre || '',
      apellidos: this.usuario.apellidos || '',
      base64: this.usuario.base64 || '',
      password: ''
    };
  }

  /**
   * Guarda los cambios realizados en el perfil del usuario.
   */
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

      if (this.selectedFile) {
        formData.append('pfp', this.selectedFile);
      }

      if (this.perfilEditado.password) {
        formData.append('password', this.perfilEditado.password);
      }

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

  /**
   * Abre el modal para recortar la imagen.
   */
  seleccionarImagen() {
    this.fileInput.nativeElement.click();
  }

  /**
   * Maneja la selección de un archivo de imagen.
   * @param event 
   * @returns 
   */
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

      setTimeout(() => {
        this.cropperModal.present();
      }, 100);
    }
  }

  /**
   * Maneja la imagen recortada y actualiza la vista previa.
   * @param event 
   */
  imageCropped(event: ImageCroppedEvent) {
    if (event.objectUrl) {
      this.croppedImage = event.objectUrl;
    } else if (event.base64) {
      // Respaldo si no hay objectUrl
      this.croppedImage = event.base64;
    }
  }

  /**
   * Maneja la imagen cargada en el cropper.
   * @param image 
   */
  imageLoaded(image: LoadedImage) {
    // Imagen cargada en el cropper
    console.log('Imagen cargada en el cropper', image);

    // Ajustar altura según la imagen cargada
    const imgElement = image.original.image as HTMLImageElement;
    if (imgElement) {
      const aspectRatio = imgElement.naturalWidth / imgElement.naturalHeight;
      this.cropperHeight = Math.min(400, Math.round(300 / aspectRatio));
    }
  }

  /**
   * Evento que se da cuando el cropper está listo.
   */
  cropperReady() {
    // El cropper está listo
    console.log('Cropper listo');
  }

  /**
   * Muestra un mensaje de error si falla la carga de la imagen.
   */
  loadImageFailed() {
    // Error al cargar la imagen
    this.mostrarToast('Error al cargar la imagen', 'danger');
    this.showCropper = false;
    this.cropperModal.dismiss();
  }

  /**
   * Confirma el recorte de la imagen y actualiza la vista previa.
   * @returns 
   */
  async confirmCrop() {
    if (!this.croppedImage) {
      this.mostrarToast('Error al procesar la imagen', 'danger');
      return;
    }

    try {
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

  /**
   * Cancela el recorte de la imagen y cierra el modal.
   */
  cancelCrop() {
    this.cropperModal.dismiss();
    this.showCropper = false;
    this.imageChangedEvent = '';
    this.croppedImage = '';
  }

  /**
   * Convierte una cadena base64 a un objeto File.
   * @param dataUrl 
   * @param filename 
   * @param mimeType 
   * @returns 
   */
  base64ToFile(
    dataUrl: string,
    filename: string,
    mimeType: string
  ): Promise<File> {
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

  /**
   * Cierra la sesión del usuario y redirige a la página de inicio de sesión.
   */
  async cerrarSesion() {

    this.logout();

  }

  /**
   * Cierra la sesión del usuario.
   */
  logout() {
    this.authService.logout();
  }

  /**
   * Abre el modal para editar el perfil.
   */
  editarPerfil() {
    this.toggleEditMode();
  }

  /**
   * Muestra un mensaje de confirmación para eliminar el usuario.
   */
  deleteUser(){
    this.toastController.create({
      message: '¿Estás seguro de que quieres eliminar tu cuenta?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => {
            console.log('Eliminación cancelada');
          }
        },
        {
          text: 'Eliminar',
          handler: () => {
            this.confirmarEliminacionUsuario();
          }
        }
      ]
    }).then(toast => {
      toast.present();
    });
  }

  /**
   * Confirma la eliminación del usuario y realiza la solicitud al servicio de autenticación.
   */
  async confirmarEliminacionUsuario() {
      this.authService.deleteUser().subscribe(() => {
      this.mostrarToast('Usuario eliminado', 'success');
      this.cerrarSesion();
    }, error => {
      this.mostrarToast('Error al eliminar usuario', 'danger');
    });
  }
  
  /**
   * Muestra un mensaje toast con el mensaje y color especificados.
   * @param mensaje 
   * @param color 
   */
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