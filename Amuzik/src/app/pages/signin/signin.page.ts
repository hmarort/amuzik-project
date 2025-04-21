import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { UsersService } from '../../services/requests/users.request';
import { ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personOutline, mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline, imageOutline, personAdd } from 'ionicons/icons';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.page.html',
  styleUrls: ['./signin.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonIcon,
    IonSpinner,
    CommonModule, 
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule
  ]
})
export class SigninPage implements OnInit {
  signinForm: FormGroup;
  isSubmitting = false;
  showPassword = false;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private usersService: UsersService,
    private toastController: ToastController
  ) {
    // Añadir iconos
    addIcons({personAdd,personOutline,mailOutline,lockClosedOutline,imageOutline,eyeOutline,eyeOffOutline});

    this.signinForm = this.formBuilder.group({
      nombre: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      pfp: [null, [Validators.required]]
    });
  }

  ngOnInit() {
  }

  onFileChange(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files.length) {
      this.selectedFile = fileInput.files[0];
      this.signinForm.patchValue({
        pfp: this.selectedFile
      });
      
      // Crear una vista previa de la imagen
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.signinForm.invalid) {
      Object.keys(this.signinForm.controls).forEach(key => {
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
      Object.keys(this.signinForm.value).forEach(key => {
        if (key === 'pfp' && this.selectedFile) {
          formData.append(key, this.selectedFile, this.selectedFile.name);
        } else {
          formData.append(key, this.signinForm.value[key]);
        }
      });

      this.usersService.register(formData).subscribe({
        next: async (response) => {
          console.log('Registro exitoso:', response);
          const toast = await this.toastController.create({
            message: 'Registro completado con éxito',
            duration: 3000,
            position: 'top',
            color: 'success'
          });
          toast.present();
          this.router.navigate(['/login']);
        },
        error: async (error) => {
          console.error('Error al registrar:', error);
          const toast = await this.toastController.create({
            message: error.error?.error || 'Error al registrar usuario',
            duration: 3000,
            position: 'top',
            color: 'danger'
          });
          toast.present();
        },
        complete: () => {
          this.isSubmitting = false;
        }
      });
    } catch (error) {
      console.error('Error inesperado:', error);
      this.isSubmitting = false;
    }
  }
}