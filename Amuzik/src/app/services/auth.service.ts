import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, from, of } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { UserRequest } from './requests/users.request';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { BiometricService } from './biometric.service';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { environment } from '../../environments/environment';

// Importamos el SDK de Google Identity para web
declare const google: any;

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
  private googleClient: any = null;
  
  constructor(
    private userRequest: UserRequest,
    private router: Router,
    private platform: Platform,
    public biometricService: BiometricService
  ) {
    this.loadUserFromStorage();
    
    this.platform.ready().then(() => {
      if (this.platform.is('capacitor')) {
        // Inicializar GoogleAuth de Capacitor para dispositivos móviles
        GoogleAuth.initialize(environment.googleAuth).catch(error => {
          console.warn('Google Auth already initialized or failed:', error);
        });
      } else {
        // Inicializar Google Identity API para web
        this.initGoogleWebAuth();
      }
    });
  }
  
  /**
   * Inicializa la API de Google Identity para entornos web
   */
  private initGoogleWebAuth(): void {
    // Verificar si ya existe el script de Google
    if (typeof google !== 'undefined' && google.accounts) {
      this.setupGoogleClient();
      return;
    }
    
    // Cargar el script de Google Identity API si no está cargado
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.setupGoogleClient();
    };
    document.body.appendChild(script);
  }
  
  /**
   * Configura el cliente de Google Identity API
   */
  private setupGoogleClient(): void {
    if (typeof google === 'undefined' || !google.accounts) {
      console.error('Google Identity API not available');
      return;
    }
    
    // Inicializar el cliente de Google (versión web)
    this.googleClient = google.accounts.oauth2.initTokenClient({
      client_id: environment.googleAuth.clientId,
      scope: environment.googleAuth.scopes.join(' '),
      callback: (tokenResponse: any) => {
        // Este callback se utiliza internamente por el método registerWithGoogleWeb
        console.log('Token obtenido correctamente');
      }
    });
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
    
    // Si estamos en una plataforma capacitor, desconectar de Google Auth
    if (this.platform.is('capacitor')) {
      GoogleAuth.signOut().catch(error => {
        console.error('Error signing out from Google Auth:', error);
      });
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
   * Método para registrarse con Google usando el método apropiado para la plataforma
   */
  registerWithGoogle(): Observable<any> {
    // Verificar si estamos en una plataforma Capacitor (móvil)
    if (this.platform.is('capacitor')) {
      return this.registerWithGoogleMobile();
    } else {
      return this.registerWithGoogleWeb();
    }
  }
  
  /**
   * Método para autenticación con Google en dispositivos móviles usando Capacitor
   */
  private registerWithGoogleMobile(): Observable<any> {
    // Usamos el plugin de Capacitor para autenticar con Google
    return from(GoogleAuth.signIn()).pipe(
      switchMap(googleUser => {
        console.log('Google Auth successful (mobile):', googleUser);
        return this.processGoogleUserRegistration(googleUser);
      }),
      catchError(error => {
        console.error('Error durante el registro con Google (mobile):', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Versión web del registro con Google utilizando Google Identity API
   */
  private registerWithGoogleWeb(): Observable<any> {
    if (!this.googleClient) {
      return throwError(() => new Error('Cliente de Google Identity no inicializado'));
    }
    
    return new Observable(observer => {
      // Solicitamos el token de acceso
      this.googleClient.callback = async (tokenResponse: any) => {
        if (tokenResponse.error) {
          observer.error(new Error('Error de autenticación: ' + tokenResponse.error));
          return;
        }
        
        try {
          // Obtener información del usuario usando el token de acceso
          const accessToken = tokenResponse.access_token;
          const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          
          if (!response.ok) {
            throw new Error('Error al obtener información del usuario');
          }
          
          const userInfo = await response.json();
          console.log('Google Auth Web successful:', userInfo);
          
          // Adaptar el formato al mismo que usa Capacitor Google Auth
          const googleUser = {
            email: userInfo.email,
            familyName: userInfo.family_name,
            givenName: userInfo.given_name,
            name: userInfo.name,
            imageUrl: userInfo.picture
          };
          
          // Procesar el registro con los datos obtenidos
          this.processGoogleUserRegistration(googleUser).subscribe({
            next: (result) => observer.next(result),
            error: (error) => observer.error(error),
            complete: () => observer.complete()
          });
        } catch (error) {
          console.error('Error procesando respuesta de Google:', error);
          observer.error(error);
        }
      };
      
      // Solicitar token de acceso
      this.googleClient.requestAccessToken();
    });
  }
  
  /**
   * Procesa el usuario de Google después de la autenticación para registro
   */
  private processGoogleUserRegistration(googleUser: any): Observable<any> {
    if (!googleUser.email) {
      return throwError(() => new Error('No se pudo obtener el email del usuario de Google'));
    }
    
    // Extraemos el username del email
    const username = googleUser.email.split('@')[0];
    
    // Verificamos si el usuario ya existe
    return this.userRequest.getUserByUsername(username).pipe(
      switchMap(response => {
        if (response && response.message) {
          // Usuario ya existe, informar al usuario que debe usar ese nombre de usuario para iniciar sesión
          return throwError(() => new Error('Este usuario ya existe. Por favor inicia sesión con tu nombre de usuario y contraseña.'));
        } else {
          // Usuario no encontrado, registrarlo
          return this.registerGoogleUser(googleUser);
        }
      }),
      catchError(error => {
        // Error al buscar el usuario, intentamos registrarlo
        if (error.status === 404) {
          console.log('Usuario no encontrado, procediendo a registrar');
          return this.registerGoogleUser(googleUser);
        }
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Registra un nuevo usuario que viene de Google Auth
   * @param googleUser Usuario de Google Auth
   */
  private registerGoogleUser(googleUser: any): Observable<any> {
    // Primero intentamos obtener la imagen de perfil de Google
    return this.getGoogleProfileImage(googleUser).pipe(
      switchMap(profileImage => {
        if (profileImage) {
          return this.registerGoogleUserWithProfileImage(googleUser, profileImage);
        } else {
          // Si no pudimos obtener la imagen de perfil, usamos una predeterminada
          return this.getDefaultProfileImage().pipe(
            switchMap(defaultImage => {
              return this.registerGoogleUserWithProfileImage(googleUser, defaultImage);
            })
          );
        }
      }),
      catchError(error => {
        console.error('Error al obtener imagen:', error);
        // Como último recurso, intentamos registrar sin imagen
        return this.registerGoogleUserWithoutImage(googleUser);
      })
    );
  }
  
  /**
   * Método alternativo para registrar sin imagen de perfil
   * Solo para casos donde no se puede obtener ninguna imagen
   */
  private registerGoogleUserWithoutImage(googleUser: any): Observable<any> {
    console.warn('Intentando registro sin imagen de perfil - esto podría fallar si el backend requiere pfp');
    
    // Crear datos básicos para el registro
    const formData = new FormData();
    
    // Extraer nombre y apellidos del displayName
    let nombre = '';
    let apellidos = '';
    
    if (googleUser.givenName || googleUser.familyName) {
      nombre = googleUser.givenName || '';
      apellidos = googleUser.familyName || '';
    } else if (googleUser.name) {
      const nameParts = googleUser.name.split(' ');
      nombre = nameParts[0] || '';
      apellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }
    
    const username = googleUser.email?.split('@')[0] || `user_${Date.now()}`;
    const email = googleUser.email || '';
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
   * @param googleUser Usuario de Google Auth
   * @param profileImage Archivo de imagen de perfil
   */
  private registerGoogleUserWithProfileImage(googleUser: any, profileImage: File): Observable<any> {
    // Crear FormData para mantener consistencia con el método de registro normal
    const formData = new FormData();
    
    // Extraer nombre y apellidos de los campos adecuados
    let nombre = '';
    let apellidos = '';
    
    if (googleUser.givenName || googleUser.familyName) {
      nombre = googleUser.givenName || '';
      apellidos = googleUser.familyName || '';
    } else if (googleUser.name) {
      const nameParts = googleUser.name.split(' ');
      nombre = nameParts[0] || '';
      apellidos = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }
    
    // Asegurar que se envíen valores no vacíos (requisitos de la tabla)
    const username = googleUser.email?.split('@')[0] || `user_${Date.now()}`;
    const email = googleUser.email || '';
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
   * Método para intentar obtener la imagen de perfil del usuario de Google
   * @param googleUser Usuario de Google Auth
   * @returns Observable con el archivo de imagen
   */
  private getGoogleProfileImage(googleUser: any): Observable<File | null> {
    // Intentar obtener la URL de la imagen de perfil si está disponible
    if (googleUser.imageUrl) {
      return from(fetch(googleUser.imageUrl)
        .then(response => response.blob())
        .then(blob => new File([blob], 'google-profile.jpg', { type: 'image/jpeg' }))
        .catch(() => null)
      );
    }
    
    return of(null);
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