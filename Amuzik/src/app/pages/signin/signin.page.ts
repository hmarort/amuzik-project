import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import {
  IonContent,
  IonIcon,
  IonSpinner,
  IonModal,
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  imageOutline,
  personAdd,
  closeOutline,
  logoGoogle,
  cropOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ImageCroppedEvent, ImageCropperComponent, LoadedImage } from 'ngx-image-cropper';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.page.html',
  styleUrls: ['./signin.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonSpinner,
    IonModal,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    ImageCropperComponent
  ],
})
export class SigninPage implements OnInit {
  @ViewChild('cropperModal')
  cropperModal!: IonModal;
  
  signinForm: FormGroup;
  isSubmitting = false;
  isGoogleSubmitting = false;
  showPassword = false;
  selectedFile: File | null = null;
  previewUrl: SafeUrl | null = null;
  googleCredentials: {username: string, password: string} | null = null;
  
  // Variables para el cropper
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper = false;
  originalFileName = '';
  originalFileType = '';
  cropperHeight = 300; // Altura por defecto del cropper

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController,
    private sanitizer: DomSanitizer
  ) {
    // Añadir iconos
    addIcons({
      personAdd,
      personOutline,
      mailOutline,
      lockClosedOutline,
      imageOutline,
      eyeOutline,
      eyeOffOutline,
      closeOutline,
      logoGoogle,
      cropOutline,
      checkmarkOutline,
    });

    this.signinForm = this.formBuilder.group({
      nombre: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      pfp: [null, [Validators.required]],
    });
  }

  ngOnInit() {}

  onFileChange(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];

      // Validar tipo de archivo
      if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)/)) {
        this.showToast(
          'Por favor, selecciona una imagen válida (JPEG, PNG, GIF o WEBP)',
          'warning'
        );
        return;
      }

      // Validar tamaño máximo (5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('La imagen no debe exceder los 5MB', 'warning');
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
    this.showToast('Error al cargar la imagen', 'danger');
    this.showCropper = false;
    this.cropperModal.dismiss();
  }

  async confirmCrop() {
    if (!this.croppedImage) {
      this.showToast('Error al procesar la imagen', 'danger');
      return;
    }

    try {
      // Si tenemos un objectUrl, usarlo para crear un Blob/File
      if (this.croppedImage.startsWith('blob:')) {
        // Actualizar la vista previa (sanitizada)
        this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(this.croppedImage);
        
        // Obtener el blob desde el objectUrl
        const response = await fetch(this.croppedImage);
        const blob = await response.blob();
        
        // Crear un File a partir del Blob
        this.selectedFile = new File([blob], this.originalFileName, { 
          type: this.originalFileType || blob.type 
        });
        
        // Establecer el archivo en el formulario
        const pfpControl = this.signinForm.get('pfp');
        if (pfpControl) {
          pfpControl.setValue(this.selectedFile);
          pfpControl.updateValueAndValidity();
          pfpControl.markAsDirty();
        }
      } 
      // Si tenemos un base64, convertirlo a File
      else if (this.croppedImage.startsWith('data:')) {
        // Actualizar la vista previa (sanitizada)
        this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(this.croppedImage);
        
        // Convertir base64 a File
        const file = await this.base64ToFile(
          this.croppedImage, 
          this.originalFileName, 
          this.originalFileType
        );
        
        this.selectedFile = file;
        const pfpControl = this.signinForm.get('pfp');
        if (pfpControl) {
          pfpControl.setValue(file);
          pfpControl.updateValueAndValidity();
          pfpControl.markAsDirty();
        }
      }
      
      // Cerrar el modal
      this.cropperModal.dismiss();
      this.showCropper = false;
    } catch (error) {
      console.error('Error al procesar la imagen recortada:', error);
      this.showToast('Error al procesar la imagen recortada', 'danger');
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

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: color,
    });
    toast.present();
  }

  async onSubmit() {
    if (this.signinForm.invalid) {
      Object.keys(this.signinForm.controls).forEach((key) => {
        const control = this.signinForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isSubmitting = true;

    try {
      // Crear FormData para enviar los datos incluyendo el archivo
      const formData = new FormData();
      Object.keys(this.signinForm.value).forEach((key) => {
        if (key === 'pfp' && this.selectedFile) {
          formData.append(key, this.selectedFile, this.selectedFile.name);
        } else {
          formData.append(key, this.signinForm.value[key]);
        }
      });

      // Usar el AuthService para registrar
      this.authService.register(formData).subscribe({
        next: async (response) => {
          console.log('Registro exitoso:', response);
          await this.showToast('Registro completado con éxito', 'success');
          this.router.navigate(['/login']);
        },
        error: async (error) => {
          console.error('Error al registrar:', error);
          await this.showToast(
            error.error?.error || 'Error al registrar usuario',
            'danger'
          );
        },
        complete: () => {
          this.isSubmitting = false;
        },
      });
    } catch (error) {
      console.error('Error inesperado:', error);
      this.isSubmitting = false;
    }
  }

  registerWithGoogle() {
    this.isGoogleSubmitting = true;
    this.googleCredentials = null;

    this.authService.registerWithGoogle().subscribe({
      next: async (response) => {
        console.log('Registro con Google exitoso:', response);
        
        // Si la respuesta contiene credenciales, las mostramos al usuario
        if (response && response.credentials) {
          this.googleCredentials = response.credentials;
          await this.showToast(
            'Cuenta creada con éxito. Guarda tus credenciales.',
            'success'
          );
        } else {
          await this.showToast('Registro con Google completado', 'success');
          this.router.navigate(['/login']);
        }
      },
      error: async (error) => {
        console.error('Error en registro con Google:', error);
        await this.showToast(
          error.message || 'Error al registrar con Google',
          'danger'
        );
      },
      complete: () => {
        this.isGoogleSubmitting = false;
      }
    });
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  copyCredentialsToClipboard() {
    if (!this.googleCredentials) return;
    
    const text = `Usuario: ${this.googleCredentials.username}\nContraseña: ${this.googleCredentials.password}`;
    
    navigator.clipboard.writeText(text).then(
      () => {
        this.showToast('Credenciales copiadas al portapapeles', 'success');
      },
      () => {
        this.showToast('No se pudieron copiar las credenciales', 'danger');
      }
    );
  }
}