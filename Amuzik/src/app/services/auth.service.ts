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
    // En lugar de intentar descargar la imagen de Google (que podría causar problemas CORS),
    // usaremos directamente una imagen predeterminada local
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
    
    // NOTA: No estamos adjuntando ninguna imagen pfp - esto probablemente fallará
    // si el backend requiere esta imagen, pero es un último recurso
    
    return this.userRequest.register(formData).pipe(
      switchMap(response => {
        return this.login(username, password);
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
    
    // Guardamos las credenciales para usarlas después del registro
    const credentials = { username, password };
    
    return this.userRequest.register(formData).pipe(
      switchMap(response => {
        // Una vez registrado, hacemos login directamente con las credenciales
        // en lugar de procesar la respuesta del registro
        console.log('Registro exitoso, intentando login con credenciales:', credentials.username);
        return this.login(credentials.username, credentials.password);
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
    // Generamos una imagen simple de 1x1 pixel como último recurso
    // Esto garantiza que siempre tendremos una imagen válida para enviar
    
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
   * Procesa la respuesta exitosa del login con Google
   * NOTA: Este método ya no se usa, se reemplazó por un login directo después del registro
   * Se mantiene para referencia o uso futuro
   * @param response Respuesta del servidor
   */
  private processGoogleLoginSuccess(response: any): Observable<any> {
    // Validamos primero que la respuesta contenga datos de usuario
    if (response && response.message && typeof response.message === 'object') {
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
    
    console.error('Respuesta inválida en processGoogleLoginSuccess:', response);
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
   * Función mejorada para convertir una URL de imagen a un archivo
   * @param url URL de la imagen
   * @param filename Nombre del archivo
   */
  private async urlToFile(url: string, filename: string = 'profile.jpg'): Promise<File> {
    try {
      // Crear una petición con encabezados para evitar problemas CORS
      const headers = new Headers();
      headers.append('Access-Control-Allow-Origin', '*');
      
      const corsProxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
      // Intentar primero con la URL directa, sino intentar con un proxy CORS
      let response: Response;
      
      try {
        response = await fetch(url, { mode: 'cors' });
      } catch (directError) {
        console.warn('Error al cargar directamente, intentando con proxy CORS:', directError);
        try {
          response = await fetch(corsProxyUrl);
        } catch (proxyError) {
          throw new Error('No se pudo acceder a la imagen: ' + (proxyError instanceof Error ? proxyError.message : 'Error desconocido'));
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    } catch (error) {
      console.error('Error al convertir URL a File:', error);
      
      // Si hay un error al descargar la imagen, intentamos con una imagen predeterminada
      return this.getDefaultProfileImage().toPromise().then(file => {
        if (!file) {
          throw new Error('Failed to generate default profile image');
        }
        return file;
      });
    }
  }
}