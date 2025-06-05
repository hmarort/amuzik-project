import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, IonItem } from '@ionic/angular/standalone';
import { HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, mailOutline, lockClosedOutline, logoGoogle, person, lockClosed, fingerPrint } from 'ionicons/icons';
import { ToastController, Platform } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonIcon,
    IonContent,
    IonSpinner,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule]
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  isSubmitting = false;
  isBiometricSubmitting = false;
  isBiometricsAvailable = false;
  showPassword = false;
  returnUrl: string;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    private toastController: ToastController,
    private platform: Platform
  ) {
    // Añadir iconos que utilizamos en el template
    addIcons({lockClosed, person, logoGoogle, eyeOutline, eyeOffOutline, mailOutline, lockClosedOutline, fingerPrint});
    
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [true], // Por defecto activado para persistencia
      enableBiometric: [false] // Para habilitar la autenticación biométrica
    });
    
    // Capturar URL a la que redirigir después del login
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
  }

  ngOnInit() {
    // Verificar si ya hay una sesión activa y redirigir
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    // Comprobar si la autenticación biométrica está disponible
    this.checkBiometricAvailability();
  }

  /**
   * Comprueba si la autenticación biométrica está disponible
   */
  private checkBiometricAvailability() {
    this.authService.biometricService.isBiometricsAvailable().subscribe({
      next: (available) => {
        this.isBiometricsAvailable = available;
        // Si está disponible y habilitada para el usuario, mostrar el botón
      },
      error: (error) => {
        console.error('Error al verificar disponibilidad biométrica:', error);
        this.isBiometricsAvailable = false;
      }
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isSubmitting = true;

    try {
      const { username, password, rememberMe, enableBiometric } = this.loginForm.value;
      
      // Guarda la preferencia de recordar en el almacenamiento
      localStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
      
      this.authService.login(username, password, enableBiometric).subscribe({
        next: () => {
          // Si el usuario habilitó la biometría y está disponible
          if (enableBiometric && this.isBiometricsAvailable) {
            // Intentar guardar credenciales para biometría
            this.authService.enableBiometricAuth(username, password).subscribe({
              next: (success) => {
                if (success) {
                  this.showToast('Autenticación biométrica habilitada con éxito', 'success');
                }
                this.router.navigate([this.returnUrl]);
              },
              error: (error) => {
                console.error('Error al habilitar biometría:', error);
                this.showToast('No se pudo habilitar la autenticación biométrica', 'warning');
                this.router.navigate([this.returnUrl]);
              }
            });
          } else {
            // Redirigir a la página de destino después del login exitoso
            this.router.navigate([this.returnUrl]);
          }
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
          this.isSubmitting = false;
        },
        complete: () => {
          this.isSubmitting = false;
        }
      });
    } catch (error) {
      console.error('Error inesperado:', error);
      this.isSubmitting = false;
      await this.showErrorToast('Error al procesar la solicitud. Inténtelo de nuevo.');
    }
  }
  
  /**
   * Intenta iniciar sesión con biometría
   */
  async loginWithBiometrics() {
    this.isBiometricSubmitting = true;
    
    try {
      this.authService.loginWithBiometrics().subscribe({
        next: () => {
          this.router.navigate([this.returnUrl]);
        },
        error: async (error) => {
          console.error('Error en autenticación biométrica:', error);
          await this.showErrorToast('Error en autenticación biométrica. Intente con usuario y contraseña.');
        },
        complete: () => {
          this.isBiometricSubmitting = false;
        }
      });
    } catch (error) {
      console.error('Error inesperado en biometría:', error);
      this.isBiometricSubmitting = false;
      await this.showErrorToast('Error al procesar la autenticación biométrica.');
    }
  }
  
  /**
   * Marca todos los controles en un formGroup como touched
   */
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control?.invalid) {
        control.markAsTouched();
      }
    });
  }

  /**
   * Muestra un mensaje de error en un toast
   */
  private async showErrorToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: 'danger'
    });
    toast.present();
  }

  /**
   * Muestra un toast con un mensaje
   */
  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: color
    });
    toast.present();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  navigateToRegister() {
    this.router.navigate(['/signin']);
  }
}