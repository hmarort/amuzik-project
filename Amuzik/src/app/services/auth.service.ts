import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, from, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { UserRequest } from './requests/users.request';
import { Router } from '@angular/router';
import { Auth, GoogleAuthProvider, signInWithPopup, UserCredential } from '@angular/fire/auth';

export interface User {
  id: string;
  username: string;
  email?: string;
  nombre?: string;
  apellidos?: string;
  base64?: string;
  friends?: User[];
  provider?: string; // Para indicar el proveedor de autenticación (normal, google, etc.)
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';
  private userDataKey = 'userData';
  private rememberMeKey = 'rememberMe';
  
  constructor(
    private userRequest: UserRequest,
    private router: Router,
    private auth: Auth
  ) {
    this.loadUserFromStorage();
  }
  
  /**
   * Cargar usuario desde localStorage o sessionStorage
   */
  private loadUserFromStorage(): void {
    const userData = this.getStoredItem(this.userDataKey);
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
  
  /**
   * Determina si se debe usar localStorage o sessionStorage
   * @returns true si se debe usar localStorage, false para sessionStorage
   */
  private useLocalStorage(): boolean {
    return localStorage.getItem(this.rememberMeKey) === 'true';
  }
  
  /**
   * Obtiene un item del almacenamiento apropiado
   * @param key La clave del item
   * @returns El valor almacenado o null
   */
  private getStoredItem(key: string): string | null {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }
  
  /**
   * Almacena un item en el storage apropiado (local o session)
   * @param key La clave del item
   * @param value El valor a almacenar
   */
  private storeItem(key: string, value: string): void {
    if (this.useLocalStorage()) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  }
  
  /**
   * Obtener usuario actual
   * @returns El usuario autenticado o null
   */
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
  
  /**
   * Obtener token de autenticación
   * @returns El token almacenado o null
   */
  public getToken(): string | null {
    return this.getStoredItem(this.tokenKey);
  }
  
  /**
   * Método para iniciar sesión
   * @param username Nombre de usuario
   * @param password Contraseña
   * @returns Observable con la respuesta
   */
  login(username: string, password: string): Observable<any> {
    return this.userRequest.login(username, password).pipe(
      tap(response => {
        if (response && response.message) {
          const userData = response.message;
          // Añadir el proveedor para diferenciarlo
          userData.provider = 'normal';
          this.currentUserSubject.next(userData);
          
          // Guardar en el almacenamiento apropiado
          this.storeItem(this.userDataKey, JSON.stringify(userData));
          
          // Si hay un token en la respuesta, guardarlo también
          if (response.token) {
            this.storeItem(this.tokenKey, response.token);
          }
        }
      }),
      catchError(error => {
        console.error('Error during login:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Método para registrarse
   * @param userData Datos del formulario de registro
   * @returns Observable con la respuesta
   */
  register(userData: FormData): Observable<any> {
    return this.userRequest.register(userData).pipe(
      catchError(error => {
        console.error('Error during registration:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Método para cerrar sesión
   */
  logout(): void {
    // Limpiar datos almacenados
    localStorage.removeItem(this.userDataKey);
    sessionStorage.removeItem(this.userDataKey);
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);
    
    // Desconectar de Firebase si está autenticado
    if (this.auth.currentUser) {
      this.auth.signOut();
    }
    
    // Resetear el estado
    this.currentUserSubject.next(null);
    
    // Redirigir al login
    this.router.navigate(['/login']);
  }
  
  /**
   * Verificar si el usuario está autenticado
   * @returns true si hay un usuario autenticado
   */
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }
  
  /**
   * Actualizar datos del usuario
   * @param userData Datos del formulario de actualización
   * @returns Observable con la respuesta
   */
  updateUserData(userData: FormData): Observable<any> {
    return this.userRequest.updateUserData(userData).pipe(
      tap(response => {
        if (response && response.user) {
          // Mantener el proveedor actual
          const currentUser = this.currentUserSubject.value;
          const provider = currentUser?.provider || 'normal';
          
          // Actualizar el usuario en el estado y en el almacenamiento
          const updatedUser = { ...currentUser, ...response.user, provider };
          this.currentUserSubject.next(updatedUser);
          
          // Guardar en el almacenamiento apropiado
          if (this.getStoredItem(this.userDataKey)) {
            this.storeItem(this.userDataKey, JSON.stringify(updatedUser));
          }
        }
      }),
      catchError(error => {
        console.error('Error updating user data:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Refrescar los datos del usuario actual siempre desde la base de datos
   * @returns Observable con la respuesta
   */
  refreshUserData(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      return throwError(() => new Error('No hay usuario actual o el ID no está disponible'));
    }
    
    return this.userRequest.getUserById(currentUser.id).pipe(
      tap(response => {
        if (response && response.message) {
          // Mantener el proveedor actual
          const provider = currentUser.provider || 'normal';
          
          // Usar siempre los datos frescos del servidor, incluyendo la lista de amigos
          const refreshedUser = { ...response.message, provider };
          
          // Actualizar el estado y el almacenamiento
          this.currentUserSubject.next(refreshedUser);
          
          if (this.getStoredItem(this.userDataKey)) {
            this.storeItem(this.userDataKey, JSON.stringify(refreshedUser));
          }
        }
      }),
      catchError(error => {
        console.error('Error refreshing user data:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Método para iniciar sesión con Google
   */
  loginWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    
    return from(signInWithPopup(this.auth, provider)).pipe(
      switchMap((result: UserCredential) => {
        const user = result.user;
        
        if (!user.email) {
          return throwError(() => new Error('No se pudo obtener el email del usuario de Google'));
        }
        
        // Verificar si el usuario ya existe en nuestra base de datos
        return this.userRequest.findOrCreateGoogleUser({
          email: user.email,
          nombre: user.displayName?.split(' ')[0] || '',
          apellidos: user.displayName?.split(' ').slice(1).join(' ') || '',
          username: user.email.split('@')[0],
          google_id: user.uid,
          photo_url: user.photoURL || '',
        }).pipe(
          tap(response => {
            if (response && response.message) {
              const userData = response.message;
              // Añadir el proveedor para diferenciarlo
              userData.provider = 'google';
              this.currentUserSubject.next(userData);
              
              // Guardar en el almacenamiento apropiado
              this.storeItem(this.userDataKey, JSON.stringify(userData));
              
              // Si hay un token en la respuesta, guardarlo también
              if (response.token) {
                this.storeItem(this.tokenKey, response.token);
              }
            }
          })
        );
      }),
      catchError(error => {
        console.error('Error during Google sign-in:', error);
        return throwError(() => error);
      })
    );
  }
}