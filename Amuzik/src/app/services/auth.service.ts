import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, from, of } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { UserRequest } from './requests/users.request';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { BiometricService } from './biometric.service';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { environment } from '../../environments/environment';

declare const google: any;

/**
 * Interfaz para el usuario
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  nombre?: string;
  apellidos?: string;
  base64?: string;
  friends?: User[];
  provider?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenKey = 'auth_token';
  private userDataKey = 'userData';
  private rememberMeKey = 'rememberMe';
  private biometricEnabledKey = 'biometricEnabled';
  private googleClient: any = null;

  /**
   * Constructor de la clase
   * @param userRequest 
   * @param router 
   * @param platform 
   * @param biometricService 
   */
  constructor(
    private userRequest: UserRequest,
    private router: Router,
    private platform: Platform,
    public biometricService: BiometricService
  ) {
    this.loadUserFromStorage();

    this.platform.ready().then(() => {
      if (this.platform.is('capacitor')) {
        GoogleAuth.initialize(environment.googleAuth).catch((error) => {
          console.warn('Google Auth already initialized or failed:', error);
        });
      } else {
        this.initGoogleWebAuth();
      }
    });
  }

  /**
   * Inicializa el cliente de Google Web Auth 
   * @returns 
   */
  private initGoogleWebAuth(): void {
    if (typeof google !== 'undefined' && google.accounts) {
      this.setupGoogleClient();
      return;
    }

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
   * Configura el cliente de la API Google Identify
   * @returns 
   */
  private setupGoogleClient(): void {
    if (typeof google === 'undefined' || !google.accounts) {
      console.error('Google Identity API not available');
      return;
    }

    this.googleClient = google.accounts.oauth2.initTokenClient({
      client_id: environment.googleAuth.clientId,
      scope: environment.googleAuth.scopes.join(' '),
      callback: (tokenResponse: any) => {
        console.log('Token obtenido correctamente');
      },
    });
  }

  /**
   * Cargamos al usuario desde el almacenamiento local
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
   * Determinamos el uso de localStorage o SessionStorage
   * @returns 
   */
  private useLocalStorage(): boolean {
    return localStorage.getItem(this.rememberMeKey) === 'true';
  }

  /**
   * Obtiene un ítem del almacenamiento local o de sesión
   * @param key 
   * @returns 
   */
  private getStoredItem(key: string): string | null {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }

  /**
   * Almacena un ítem en el almacenamiento apropiado
   * @param key 
   * @param value 
   */
  private storeItem(key: string, value: string): void {
    if (this.useLocalStorage()) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  }

  /**
   * Obtener al usuario local
   * @returns 
   */
  public getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtenemos el token de autenticación
   * @returns 
   */
  public getToken(): string | null {
    return this.getStoredItem(this.tokenKey);
  }

  /**
   * Comprobamos si la biometría está activada
   * @returns 
   */
  public isBiometricEnabled(): boolean {
    return this.getStoredItem(this.biometricEnabledKey) === 'true';
  }

  /**
   * Habilita la autenticación biométrica para el usuario actual
   * @param username 
   * @param password 
   * @returns 
   */
  enableBiometricAuth(username: string, password: string): Observable<boolean> {
    return this.biometricService.isBiometricsAvailable().pipe(
      switchMap((isAvailable) => {
        if (!isAvailable) {
          return of(false);
        }

        return this.biometricService.saveCredentials(username, password).pipe(
          tap((success) => {
            if (success) {
              this.storeItem(this.biometricEnabledKey, 'true');
            }
          })
        );
      })
    );
  }

  /**
   * Deshabilitamos el uso de biometría
   * @returns 
   */
  disableBiometricAuth(): Observable<boolean> {
    return this.biometricService.deleteCredentials().pipe(
      tap((success) => {
        if (success) {
          localStorage.removeItem(this.biometricEnabledKey);
          sessionStorage.removeItem(this.biometricEnabledKey);
        }
      })
    );
  }

  /**
   * Intentamos iniciar sesión con biometría
   * @returns 
   */
  loginWithBiometrics(): Observable<any> {
    return this.biometricService.verifyIdentity().pipe(
      switchMap((credentials) => {
        if (!credentials) {
          return throwError(
            () => new Error('Autenticación biométrica fallida')
          );
        }

        return this.login(credentials.username, credentials.password, false);
      })
    );
  }

  /**
   * Método lógico que se encarga de iniciar sesión llamando al backend para autenticar al usuario
   * @param username 
   * @param password 
   * @param saveBiometrics 
   * @returns 
   */
  login(
    username: string,
    password: string,
    saveBiometrics: boolean = false
  ): Observable<any> {
    return this.userRequest.login(username, password).pipe(
      tap((response) => {
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
            this.biometricService
              .isBiometricsAvailable()
              .pipe(
                switchMap((isAvailable) => {
                  if (isAvailable) {
                    return this.enableBiometricAuth(username, password);
                  }
                  return of(false);
                })
              )
              .subscribe();
          }
        }
      }),
      catchError((error) => {
        console.error('Error during login:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Método para registrar un nuevo usuario
   * @param userData 
   * @returns 
   */
  register(userData: FormData): Observable<any> {
    return this.userRequest.register(userData).pipe(
      catchError((error) => {
        console.error('Error during registration:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cerramos la sesión del usuario
   */
  logout(): void {
    localStorage.removeItem(this.userDataKey);
    sessionStorage.removeItem(this.userDataKey);
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);

    if (this.platform.is('capacitor')) {
      GoogleAuth.signOut().catch((error) => {
        console.error('Error signing out from Google Auth:', error);
      });
    }

    this.currentUserSubject.next(null);

    this.router.navigate(['/login']);
  }

  /**
   * Comprobamos si el usuario está autenticado
   * @returns 
   */
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  /**
   * Actualizamos los datos del usuario
   * @param userData 
   * @returns 
   */
  updateUserData(userData: FormData): Observable<any> {
    return this.userRequest.updateUserData(userData).pipe(
      tap((response) => {
        if (response && response.user) {
          const currentUser = this.currentUserSubject.value;
          const provider = currentUser?.provider || 'normal';

          const updatedUser = { ...currentUser, ...response.user, provider };
          this.currentUserSubject.next(updatedUser);

          if (this.getStoredItem(this.userDataKey)) {
            this.storeItem(this.userDataKey, JSON.stringify(updatedUser));
          }
        }
      }),
      catchError((error) => {
        console.error('Error updating user data:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Refrescamos los datos del usuario desde el backend
   * @returns 
   */
  refreshUserData(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      return throwError(
        () => new Error('No hay usuario actual o el ID no está disponible')
      );
    }

    return this.userRequest.getUserById(currentUser.id).pipe(
      tap((response) => {
        if (response && response.message) {
          const provider = currentUser.provider || 'normal';

          const refreshedUser = { ...response.message, provider };

          this.currentUserSubject.next(refreshedUser);

          if (this.getStoredItem(this.userDataKey)) {
            this.storeItem(this.userDataKey, JSON.stringify(refreshedUser));
          }
        }
      }),
      catchError((error) => {
        console.error('Error refreshing user data:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Registramos al usuario con google
   * @returns 
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
   * Método de registro de Google para dispositivos móviles
   * @returns 
   */
  private registerWithGoogleMobile(): Observable<any> {
    return from(GoogleAuth.signIn()).pipe(
      switchMap((googleUser) => {
        console.log('Google Auth successful (mobile):', googleUser);
        return this.processGoogleUserRegistration(googleUser);
      }),
      catchError((error) => {
        console.error('Error durante el registro con Google (mobile):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Registro de Google para la web
   * @returns 
   */
  private registerWithGoogleWeb(): Observable<any> {
    if (!this.googleClient) {
      return throwError(
        () => new Error('Cliente de Google Identity no inicializado')
      );
    }

    return new Observable((observer) => {
      // Solicitamos el token de acceso
      this.googleClient.callback = async (tokenResponse: any) => {
        if (tokenResponse.error) {
          observer.error(
            new Error('Error de autenticación: ' + tokenResponse.error)
          );
          return;
        }

        try {
          // Obtener información del usuario usando el token de acceso
          const accessToken = tokenResponse.access_token;
          const response = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

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
            imageUrl: userInfo.picture,
          };

          // Procesar el registro con los datos obtenidos
          this.processGoogleUserRegistration(googleUser).subscribe({
            next: (result) => observer.next(result),
            error: (error) => observer.error(error),
            complete: () => observer.complete(),
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
   * Procesa al usuario de Google para el registro despues de la autenticación
   * @param googleUser 
   * @returns 
   */
  private processGoogleUserRegistration(googleUser: any): Observable<any> {
    if (!googleUser.email) {
      return throwError(
        () => new Error('No se pudo obtener el email del usuario de Google')
      );
    }

    // Extraemos el username del email
    const username = googleUser.email.split('@')[0];

    // Verificamos si el usuario ya existe
    return this.userRequest.getUserByUsername(username).pipe(
      switchMap((response) => {
        if (response && response.message) {
          // Usuario ya existe, informar al usuario que debe usar ese nombre de usuario para iniciar sesión
          return throwError(
            () =>
              new Error(
                'Este usuario ya existe. Por favor inicia sesión con tu nombre de usuario y contraseña.'
              )
          );
        } else {
          // Usuario no encontrado, registrarlo
          return this.registerGoogleUser(googleUser);
        }
      }),
      catchError((error) => {
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
   * Registramos el usuario que viene de Auth de Google
   * @param googleUser 
   * @returns 
   */
  private registerGoogleUser(googleUser: any): Observable<any> {
    return this.getGoogleProfileImage(googleUser).pipe(
      switchMap((profileImage) => {
        if (profileImage) {
          return this.registerGoogleUserWithProfileImage(
            googleUser,
            profileImage
          );
        } else {
          return this.getDefaultProfileImage().pipe(
            switchMap((defaultImage) => {
              return this.registerGoogleUserWithProfileImage(
                googleUser,
                defaultImage
              );
            })
          );
        }
      }),
      catchError((error) => {
        console.error('Error al obtener imagen:', error);
        return this.registerGoogleUserWithoutImage(googleUser);
      })
    );
  }

  /**
   * Registra un nuevo usuario que viene de Google Auth sin imagen de perfil
   * @param googleUser 
   * @returns 
   */
  private registerGoogleUserWithoutImage(googleUser: any): Observable<any> {
    console.warn(
      'Intentando registro sin imagen de perfil - esto podría fallar si el backend requiere pfp'
    );

    const formData = new FormData();

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

    const tempPassword = password;

    return this.userRequest.register(formData).pipe(
      map((response) => {
        return {
          ...response,
          credentials: {
            username,
            password: tempPassword,
          },
        };
      }),
      catchError((error) => {
        console.error('Error en registro sin imagen:', error);
        return throwError(
          () =>
            new Error(
              'No se pudo registrar el usuario de Google: ' + error.message
            )
        );
      })
    );
  }

  /**
   * Registra un nuevo usuario que viene de Google Auth con imagen de perfil
   * @param googleUser 
   * @param profileImage 
   * @returns 
   */
  private registerGoogleUserWithProfileImage(
    googleUser: any,
    profileImage: File
  ): Observable<any> {
    const formData = new FormData();

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

    formData.append('pfp', profileImage, 'profile.jpg');

    const credentials = { username, password };

    return this.userRequest.register(formData).pipe(
      map((response) => {
        return {
          ...response,
          credentials,
        };
      }),
      catchError((error) => {
        console.error('Error en el registro de Google:', error);
        return throwError(
          () =>
            new Error(
              'Error al registrar usuario de Google: ' +
                (error.message || 'Error desconocido')
            )
        );
      })
    );
  }

  /**
   * Obtiene la imagen de perfil del usuario de Google que se registra
   * @param googleUser 
   * @returns 
   */
  private getGoogleProfileImage(googleUser: any): Observable<File | null> {
    const imageUrl =
      googleUser.imageUrl ||
      googleUser.picture ||
      (googleUser.photos && googleUser.photos.length > 0
        ? googleUser.photos[0].value
        : null);

    if (imageUrl) {
      console.log('Intentando obtener imagen desde URL:', imageUrl);
      return from(
        fetch(imageUrl)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Error al obtener la imagen: ${response.status}`);
            }
            return response.blob();
          })
          .then(
            (blob) =>
              new File([blob], 'google-profile.jpg', { type: 'image/jpeg' })
          )
          .catch((error) => {
            console.error('Error al recuperar imagen de perfil:', error);
            return null;
          })
      );
    }

    console.warn(
      'No se encontró URL de imagen en el objeto de usuario Google:',
      googleUser
    );
    return of(null);
  }

  /**
   * Si no obtenemos imgaen de perfil desde google, damos una imagen por defecto
   * @returns 
   */
  private getDefaultProfileImage(): Observable<File> {

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fondo
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(0, 0, 100, 100);

        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(50, 50, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMUZIK'.charAt(Math.floor(Math.random() * 'AMUZIK'.length)), 50, 50);
      }

      // Convertir el canvas a blob
      return from(
        new Promise<File>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(
                new File([blob], 'default-avatar.png', { type: 'image/png' })
              );
            } else {
              reject(new Error('No se pudo crear la imagen'));
            }
          }, 'image/png');
        })
      ).pipe(
        catchError((error) => {
          console.error('Error al crear la imagen de canvas:', error);
          // Crear un pixel transparente como último recurso absoluto
          const transparentPixel =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
          return from(
            fetch(transparentPixel)
              .then((response) => response.blob())
              .then(
                (blob) => new File([blob], 'pixel.png', { type: 'image/png' })
              )
          );
        })
      );
    } catch (error) {
      console.error('Error al generar imagen predeterminada:', error);
      // Crear un pixel transparente como último recurso
      const transparentPixel =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      return from(
        fetch(transparentPixel)
          .then((response) => response.blob())
          .then((blob) => new File([blob], 'pixel.png', { type: 'image/png' }))
      );
    }
  }

  /**
   * Generamos una contraseña aleatoria para el usuario que se registra con google
   * @returns 
   */
  private generateRandomPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';

    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }
}
