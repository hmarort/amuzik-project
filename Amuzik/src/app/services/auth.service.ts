import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UserRequest } from './requests/users.request';
import { Router } from '@angular/router';

export interface User {
  id: string;
  username: string;
  email?: string;
  nombre?: string;
  apellidos?: string;
  base64?: string; // Para la imagen de perfil
  // Agregar otros campos según la respuesta de tu API
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';

  constructor(
    private userRequest: UserRequest,
    private router: Router
  ) {
    this.loadUserFromStorage();
  }

  // Cargar usuario desde localStorage o sessionStorage
  private loadUserFromStorage(): void {
    const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.currentUserSubject.next(user);
      } catch (e) {
        console.error('Error parsing user data from storage', e);
        this.logout();
      }
    }
  }
  
  // Obtener usuario actual
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
  
  // Obtener token
  public getToken(): string | null {
    return localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
  }

  // Método para iniciar sesión
  login(username: string, password: string): Observable<any> {
    return this.userRequest.login(username, password).pipe(
      tap(response => {
        const userData = response.message;
        this.currentUserSubject.next(userData);
        
        // Guardar en localStorage o sessionStorage según la opción "rememberMe"
        if (localStorage.getItem('rememberMe') === 'true') {
          localStorage.setItem('userData', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('userData', JSON.stringify(userData));
        }
        
        if (response.token) {
          if (localStorage.getItem('rememberMe') === 'true') {
            localStorage.setItem(this.tokenKey, response.token);
          } else {
            sessionStorage.setItem(this.tokenKey, response.token);
          }
        }
      })
    );
  }

  // Método para registrarse
  register(userData: FormData): Observable<any> {
    return this.userRequest.register(userData);
  }

  // Método para cerrar sesión
  logout(): void {
    // Limpiar datos almacenados
    localStorage.removeItem('userData');
    sessionStorage.removeItem('userData');
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  // Actualizar datos del usuario
  updateUserData(userData: FormData): Observable<any> {
    return this.userRequest.updateUserData(userData).pipe(
      tap(response => {
        // Actualizar el usuario en el estado y en el almacenamiento
        console.log('User data updated:', response);
        const updatedUser = { ...this.currentUserSubject.value, ...response.user };
        this.currentUserSubject.next(updatedUser);
        
        if (localStorage.getItem('userData')) {
          localStorage.setItem('userData', JSON.stringify(updatedUser));
        } else {
          sessionStorage.setItem('userData', JSON.stringify(updatedUser));
        }
      })
    );
  }
}