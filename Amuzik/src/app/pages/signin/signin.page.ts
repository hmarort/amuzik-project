import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import {
  IonContent,
  IonIcon,
  IonSpinner,
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
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.page.html',
  styleUrls: ['./signin.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonSpinner,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule
],
})
export class SigninPage implements OnInit {
  signinForm: FormGroup;
  isSubmitting = false;
  isGoogleSubmitting = false;
  showPassword = false;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  googleCredentials: {username: string, password: string} | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
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

      // Procesar la imagen (redimensionar)
      this.processImage(file);
    }
  }

  processImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      // Crear una imagen para obtener las dimensiones
      const img = new Image();
      img.onload = () => {
        // Crear canvas para redimensionar
        const canvas = document.createElement('canvas');

        // Tamaño deseado para la foto de perfil (300x300)
        const maxSize = 300;

        // Calcular el nuevo tamaño manteniendo la proporción
        let width = img.width;
        let height = img.height;

        // Determinar la dimensión más grande
        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        // Configurar el canvas y dibujar la imagen redimensionada
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          console.error('No se pudo obtener el contexto del canvas');
          return;
        }

        // Convertir a formato base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Actualizar la vista previa
        this.previewUrl = dataUrl;

        // Convertir base64 a Blob/File para el formulario
        this.base64ToFile(dataUrl, file.name, file.type).then((resizedFile) => {
          // Establecer el archivo redimensionado en el formulario
          this.selectedFile = resizedFile;
          const pfpControl = this.signinForm.get('pfp');
          if (pfpControl) {
            pfpControl.setValue(resizedFile);
            pfpControl.updateValueAndValidity();
            pfpControl.markAsDirty();
          }
        });
      };

      // Cargar la imagen
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  }

  base64ToFile(
    dataUrl: string,
    filename: string,
    mimeType: string
  ): Promise<File> {
    return fetch(dataUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => new File([buf], filename, { type: mimeType }));
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

  /**
   * Método para registrarse con Google
   */
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

  /**
   * Navegar a la página de login
   */
  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  /**
   * Copiar las credenciales al portapapeles
   */
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