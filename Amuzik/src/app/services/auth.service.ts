import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, from } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
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
   * Utiliza los endpoints existentes para login/register
   */
  loginWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    
    return from(signInWithPopup(this.auth, provider)).pipe(
      switchMap((result: UserCredential) => {
        const user = result.user;
        
        if (!user.email) {
          return throwError(() => new Error('No se pudo obtener el email del usuario de Google'));
        }
        
        // Primero intentamos iniciar sesión directamente usando el email como username
        // y el uid como password (simulación)
        const username = user.email.split('@')[0];
        
        // Primero verificamos si el usuario existe buscando por username o email
        return this.userRequest.getUserByUsername(username).pipe(
          switchMap(response => {
            if (response && response.message) {
              // Usuario encontrado, intentar login con credenciales normales
              // En un caso real, esto podría necesitar un endpoint específico que verifique
              // el token de Google en lugar de una contraseña
              return this.login(username, user.uid).pipe(
                catchError(loginError => {
                  // Si el login falla (p.ej. contraseña incorrecta para usuario existente)
                  console.error('Error en login con usuario existente:', loginError);
                  return throwError(() => new Error('No se pudo iniciar sesión con la cuenta de Google. El usuario existe pero no coinciden las credenciales.'));
                })
              );
            } else {
              // Usuario no encontrado, hay que registrarlo
              return this.registerGoogleUser(user);
            }
          }),
          catchError(error => {
            // Error al buscar el usuario, intentamos registrarlo
            console.log('Usuario no encontrado, procediendo a registrar:', error);
            return this.registerGoogleUser(user);
          })
        );
      }),
      catchError(error => {
        console.error('Error durante el inicio de sesión con Google:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Registra un nuevo usuario que viene de Google Auth
   * @param user Usuario de Firebase
   */
  private registerGoogleUser(user: any): Observable<any> {
    // Crear FormData para mantener consistencia con el método de registro normal
    const formData = new FormData();
    
    // Extraer nombre y apellidos del displayName
    let nombre = '';
    let apellidos = '';
    
    if (user.displayName) {
      const nameParts = user.displayName.split(' ');
      nombre = nameParts[0] || '';
      apellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }
    
    // Asegurar que se envíen valores no vacíos (requisitos de la tabla)
    const username = user.email?.split('@')[0] || `user_${Date.now()}`;
    const email = user.email || '';
    nombre = nombre || 'Usuario';
    apellidos = apellidos || 'Google';
    const password = this.generateRandomPassword();
    
    // Añadir campos requeridos por la tabla users
    formData.append('username', username);
    formData.append('email', email);
    formData.append('nombre', nombre);
    formData.append('apellidos', apellidos);
    formData.append('password', password);
    
    // Si hay foto de perfil, intentar obtenerla para el campo pfp
    if (user.photoURL) {
      // Opción 1: Si el backend acepta URL y luego la procesa
      formData.append('pfp_url', user.photoURL);
      
      // Opción 2: Si necesitamos convertir la imagen a un archivo
      // Esto requeriría implementar una función para convertir URL a File/Blob
      // this.urlToFile(user.photoURL).then(file => {
      //   formData.append('pfp', file, 'profile.jpg');
      // });
    }
    
    return this.userRequest.register(formData).pipe(
      switchMap(response => {
        if (response && response.message) {
          // Simulamos un login después de registrar
          return this.processGoogleLoginSuccess(response);
        }
        return throwError(() => new Error('Error al registrar usuario de Google'));
      })
    );
  }
  
  /**
   * Procesa la respuesta exitosa del login con Google
   * @param response Respuesta del servidor
   */
  private processGoogleLoginSuccess(response: any): Observable<any> {
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
      
      return from([response]);
    }
    
    return throwError(() => new Error('Respuesta inválida del servidor'));
  }
  
  /**
   * Genera una contraseña aleatoria para usuarios de Google
   * @returns Contraseña aleatoria
   */
  private generateRandomPassword(): string {
    // Generamos una contraseña más segura con letras mayúsculas, minúsculas y números
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    
    // Crear contraseña de 12 caracteres
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }
  
  /**
   * Función auxiliar para convertir una URL de imagen a un archivo
   * Útil si necesitamos convertir photoURL de Google a un archivo para subir
   * @param url URL de la imagen
   * @param filename Nombre del archivo
   */
  private async urlToFile(url: string, filename: string = 'profile.jpg'): Promise<File> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      console.error('Error al convertir URL a File:', error);
      throw new Error('No se pudo convertir la URL de la imagen a un archivo');
    }
  }
}