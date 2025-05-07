import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  IonContent, 
  IonIcon, 
  IonSpinner, 
  IonCheckbox,
  IonButton
} from '@ionic/angular/standalone';
import { HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { 
  eyeOutline, 
  eyeOffOutline, 
  mailOutline, 
  lockClosedOutline, 
  logoGoogle, 
  logoFacebook, 
  person, 
  lockClosed 
} from 'ionicons/icons';
import { ToastController } from '@ionic/angular/standalone';
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
    IonCheckbox,
    IonButton,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule
  ]
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  isSubmitting = false;
  isGoogleSubmitting = false;
  showPassword = false;
  returnUrl: string;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastController: ToastController
  ) {
    // Add icons needed in the template
    addIcons({
      lockClosed, 
      person, 
      logoGoogle, 
      logoFacebook, 
      eyeOutline, 
      eyeOffOutline, 
      mailOutline, 
      lockClosedOutline
    });
    
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [true] // Default active for persistence
    });
    
    // Get URL to redirect after login
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
  }

  ngOnInit() {
    // Check if there's an active session and redirect
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.returnUrl]);
    }
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
      this.authService.login(username, password).subscribe({
        next: () => {
          // Redirect to target page after successful login
          this.router.navigate([this.returnUrl]);
        },
        error: async (error) => {
          console.error('Error during login:', error);
          const toast = await this.toastController.create({
            message: error.error?.error || 'Error durante el inicio de sesión',
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
      console.error('Unexpected error:', error);
      this.isSubmitting = false;
      const toast = await this.toastController.create({
        message: 'Error al procesar la solicitud. Inténtelo de nuevo.',
        duration: 3000,
        position: 'top',
        color: 'danger'
      });
      toast.present();
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  navigateToRegister() {
    this.router.navigate(['/signin']);
  }
  
  async loginWithGoogle() {
    this.isGoogleSubmitting = true;
    
    try {
      this.authService.loginWithGoogle().subscribe({
        next: () => {
          // Redirect to target page after successful login with Google
          this.router.navigate([this.returnUrl]);
        },
        error: async (error) => {
          console.error('Error during Google login:', error);
          const toast = await this.toastController.create({
            message: error.message || 'Error al iniciar sesión con Google',
            duration: 3000,
            position: 'top',
            color: 'danger'
          });
          toast.present();
          this.isGoogleSubmitting = false;
        },
        complete: () => {
          this.isGoogleSubmitting = false;
        }
      });
    } catch (error) {
      console.error('Unexpected error in Google login:', error);
      this.isGoogleSubmitting = false;
      const toast = await this.toastController.create({
        message: 'Error al procesar la solicitud con Google. Inténtelo de nuevo.',
        duration: 3000,
        position: 'top',
        color: 'danger'
      });
      toast.present();
    }
  }
}