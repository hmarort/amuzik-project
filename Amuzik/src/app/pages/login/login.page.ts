import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonSpinner } from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonIcon, IonContent, IonSpinner, CommonModule, FormsModule, ReactiveFormsModule]
})
export class LoginPage {
  loginForm: FormGroup;
  isSubmitting = false;
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
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
      // Aquí iría tu lógica de autenticación
      // Por ejemplo:
      // await this.authService.login(this.loginForm.value.email, this.loginForm.value.password);
      
      // Si la autenticación es exitosa:
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}