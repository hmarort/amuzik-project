import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonSpinner} from '@ionic/angular/standalone';
import { UsersService } from '../../services/requests/users.request';
import { HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, mailOutline, lockClosedOutline, logoGoogle, logoFacebook, person, lockClosed } from 'ionicons/icons';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonIcon, 
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    IonSpinner, 
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    HttpClientModule,
  ]
})
export class LoginPage {
  loginForm: FormGroup;
  isSubmitting = false;
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private usersService: UsersService,
    private toastController: ToastController
  ) {
    // Añadir iconos que utilizamos en el template
    addIcons({lockClosed,person,logoGoogle,logoFacebook,eyeOutline,eyeOffOutline,mailOutline,lockClosedOutline});

    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]], // Cambiado de email a username según la API
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isSubmitting = true;
    try {
      const { username, password } = this.loginForm.value;
      this.usersService.login(username, password).subscribe({
        next: (response) => {
          console.log('Login exitoso:', response);
          // Guardar datos del usuario en localStorage si "rememberMe" está activado
          if (this.loginForm.value.rememberMe) {
            localStorage.setItem('userData', JSON.stringify(response.message));
          } else {
            sessionStorage.setItem('userData', JSON.stringify(response.message));
          }
          
          this.router.navigate(['/home']);
        },
        error: async (error) => {
          console.error('Error al iniciar sesión:', error);
          const toast = await this.toastController.create({
            message: error.error?.error || 'Error al iniciar sesión',
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

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}