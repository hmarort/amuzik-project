import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, from, of } from 'rxjs';
import { tap, catchError, switchMap, map, finalize } from 'rxjs/operators';
import { UserRequest } from './requests/users.request';
import { Router } from '@angular/router';
import { 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  UserCredential 
} from '@angular/fire/auth';
import { Platform } from '@ionic/angular/standalone';
import { BiometricService } from './biometric.service';

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
  private biometricEnabledKey = 'biometricEnabled';
  
  constructor(
    private userRequest: UserRequest,
    private router: Router,
    private auth: Auth,
    private platform: Platform,
    public biometricService: BiometricService
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
   * Verifica si el usuario tiene habilitada la autenticación biométrica
   * @returns true si la autenticación biométrica está habilitada
   */
  public isBiometricEnabled(): boolean {
    return this.getStoredItem(this.biometricEnabledKey) === 'true';
  }
  
  /**
   * Habilita la autenticación biométrica para el usuario actual
   * @param username Nombre de usuario
   * @param password Contraseña
   * @returns Observable que indica si se guardaron correctamente
   */
  enableBiometricAuth(username: string, password: string): Observable<boolean> {
    return this.biometricService.isBiometricsAvailable().pipe(
      switchMap(isAvailable => {
        if (!isAvailable) {
          return of(false);
        }
        
        return this.biometricService.saveCredentials(username, password).pipe(
          tap(success => {
            if (success) {
              this.storeItem(this.biometricEnabledKey, 'true');
            }
          })
        );
      })
    );
  }
  
  /**
   * Deshabilita la autenticación biométrica para el usuario actual
   */
  disableBiometricAuth(): Observable<boolean> {
    return this.biometricService.deleteCredentials().pipe(
      tap(success => {
        if (success) {
          localStorage.removeItem(this.biometricEnabledKey);
          sessionStorage.removeItem(this.biometricEnabledKey);
        }
      })
    );
  }
  
  /**
   * Intenta iniciar sesión utilizando autenticación biométrica
   */
  loginWithBiometrics(): Observable<any> {
    return this.biometricService.verifyIdentity().pipe(
      switchMap(credentials => {
        if (!credentials) {
          return throwError(() => new Error('Autenticación biométrica fallida'));
        }
        
        return this.login(credentials.username, credentials.password, false);
      })
    );
  }
  
  /**
   * Método para iniciar sesión
   * @param username Nombre de usuario
   * @param password Contraseña
   * @param saveCredentials Si es true, intentará guardar credenciales para biometría
   * @returns Observable con la respuesta
   */
  login(username: string, password: string, saveBiometrics: boolean = false): Observable<any> {
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
          
          // Si se indicó guardar credenciales y hay soporte biométrico, guardarlas
          if (saveBiometrics) {
            this.biometricService.isBiometricsAvailable().pipe(
              switchMap(isAvailable => {
                if (isAvailable) {
                  return this.enableBiometricAuth(username, password);
                }
                return of(false);
              })
            ).subscribe();
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
   * Detecta si estamos en Android
   */
  private isAndroid(): boolean {
    return this.platform.is('android');
  }
  
  /**
   * Método para registrarse con Google
   * (Modificado para solo usar en registro y no en login)
   */
  registerWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    
    // Solo usamos el Popup para el registro con Google
    return from(signInWithPopup(this.auth, provider)).pipe(
      switchMap((result: UserCredential) => {
        return this.processGoogleUserRegistration(result.user);
      }),
      catchError(error => {
        console.error('Error durante el registro con Google:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Procesa el usuario de Google después de la autenticación para registro
   */
  private processGoogleUserRegistration(user: any): Observable<any> {
    if (!user.email) {
      return throwError(() => new Error('No se pudo obtener el email del usuario de Google'));
    }
    
    // Extraemos el username del email
    const username = user.email.split('@')[0];
    
    // Verificamos si el usuario ya existe
    return this.userRequest.getUserByUsername(username).pipe(
      switchMap(response => {
        if (response && response.message) {
          // Usuario ya existe, informar al usuario que debe usar ese nombre de usuario para iniciar sesión
          return throwError(() => new Error('Este usuario ya existe. Por favor inicia sesión con tu nombre de usuario y contraseña.'));
        } else {
          // Usuario no encontrado, registrarlo
          return this.registerGoogleUser(user);
        }
      }),
      catchError(error => {
        // Error al buscar el usuario, intentamos registrarlo
        if (error.status === 404) {
          console.log('Usuario no encontrado, procediendo a registrar');
          return this.registerGoogleUser(user);
        }
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Registra un nuevo usuario que viene de Google Auth
   * @param user Usuario de Firebase
   */
  private registerGoogleUser(user: any): Observable<any> {
    // Usamos directamente una imagen predeterminada local
    return this.getDefaultProfileImage().pipe(
      switchMap(defaultImageFile => {
        return this.registerGoogleUserWithProfileImage(user, defaultImageFile);
      }),
      catchError(error => {
        console.error('Error al obtener imagen predeterminada:', error);
        // Como último recurso, intentamos registrar sin imagen
        return this.registerGoogleUserWithoutImage(user);
      })
    );
  }
  
  /**
   * Método alternativo para registrar sin imagen de perfil
   * Solo para casos donde no se puede obtener ninguna imagen
   */
  private registerGoogleUserWithoutImage(user: any): Observable<any> {
    console.warn('Intentando registro sin imagen de perfil - esto podría fallar si el backend requiere pfp');
    
    // Crear datos básicos para el registro
    const formData = new FormData();
    
    // Extraer nombre y apellidos del displayName
    let nombre = '';
    let apellidos = '';
    
    if (user.displayName) {
      const nameParts = user.displayName.split(' ');
      nombre = nameParts[0] || '';
      apellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }
    
    const username = user.email?.split('@')[0] || `user_${Date.now()}`;
    const email = user.email || '';
    nombre = nombre || 'Usuario';
    apellidos = apellidos || 'Google';
    const password = this.generateRandomPassword();
    
    formData.append('username', username);
    formData.append('email', email);
    formData.append('nombre', nombre);
    formData.append('apellidos', apellidos);
    formData.append('password', password);
    
    // Almacenar temporalmente la contraseña para mostrarla al usuario
    const tempPassword = password;
    
    // Registro y retorno de información de credenciales
    return this.userRequest.register(formData).pipe(
      map(response => {
        // Retornamos las credenciales para que el usuario pueda iniciar sesión
        return {
          ...response,
          credentials: {
            username,
            password: tempPassword
          }
        };
      }),
      catchError(error => {
        console.error('Error en registro sin imagen:', error);
        return throwError(() => new Error('No se pudo registrar el usuario de Google: ' + error.message));
      })
    );
  }

  /**
   * Completar el registro de Google con la imagen de perfil
   * @param user Usuario de Firebase
   * @param profileImage Archivo de imagen de perfil
   */
  private registerGoogleUserWithProfileImage(user: any, profileImage: File): Observable<any> {
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
    
    // Añadir la imagen de perfil como archivo
    formData.append('pfp', profileImage, 'profile.jpg');
    
    // Guardamos las credenciales para retornarlas
    const credentials = { username, password };
    
    return this.userRequest.register(formData).pipe(
      map(response => {
        // Retornamos la respuesta y las credenciales para mostrarlas al usuario
        return {
          ...response,
          credentials
        };
      }),
      catchError(error => {
        console.error('Error en el registro de Google:', error);
        return throwError(() => new Error('Error al registrar usuario de Google: ' + (error.message || 'Error desconocido')));
      })
    );
  }
  
  /**
   * Obtiene una imagen de perfil predeterminada
   * @returns Observable con el archivo de imagen
   */
  private getDefaultProfileImage(): Observable<File> {
    // Generamos una imagen simple como último recurso
    
    try {
      // Crear un canvas pequeño de 100x100 pixels
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      
      // Obtener el contexto 2D y dibujar un círculo de color
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fondo
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, 100, 100);
        
        // Círculo para avatar
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(50, 50, 40, 0, Math.PI * 2);
        ctx.fill();
        
        // Iniciales genéricas
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('U', 50, 50);
      }
      
      // Convertir el canvas a blob
      return from(new Promise<File>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], 'default-avatar.png', { type: 'image/png' }));
          } else {
            reject(new Error('No se pudo crear la imagen'));
          }
        }, 'image/png');
      })).pipe(
        catchError(error => {
          console.error('Error al crear la imagen de canvas:', error);
          // Crear un pixel transparente como último recurso absoluto
          const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
          return from(fetch(transparentPixel)
            .then(response => response.blob())
            .then(blob => new File([blob], 'pixel.png', { type: 'image/png' }))
          );
        })
      );
    } catch (error) {
      console.error('Error al generar imagen predeterminada:', error);
      // Crear un pixel transparente como último recurso
      const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      return from(fetch(transparentPixel)
        .then(response => response.blob())
        .then(blob => new File([blob], 'pixel.png', { type: 'image/png' }))
      );
    }
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
}