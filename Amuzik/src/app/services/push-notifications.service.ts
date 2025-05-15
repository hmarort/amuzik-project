import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { Platform } from '@ionic/angular/standalone';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private jwtToken = environment.JWT_SECRET;
  private apiUrl = environment.apiUrl;
  private deviceToken = new BehaviorSubject<string | null>(null);
  public deviceToken$ = this.deviceToken.asObservable();

  constructor(
    private router: Router,
    private platform: Platform,
    private chatService: ChatService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  /**
   * Inicializa el servicio de notificaciones push
   */
  async initialize(username: string): Promise<void> {
    // Solo inicializar en dispositivos nativos
    if (!Capacitor.isNativePlatform()) {
      console.log('Push Notifications no disponibles en la web');
      return;
    }

    try {
      // Verificar permisos
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });
      const permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        // Solicitar permisos
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
          return;
        }
      } else if (permStatus.receive !== 'granted') {
        return;
      }

      // Registrar listeners de eventos para notificaciones
      await this.registerListeners(username);
      // Registrar el dispositivo para notificaciones
      await PushNotifications.register();
    } catch (error) {
      console.error('Error al inicializar las notificaciones push:', error);
    }
  }

  /**
   * Registra los listeners de eventos para las notificaciones
   */
  private async registerListeners(username: string): Promise<void> {
    // Cuando recibimos un token de registro
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token: ', token.value);
      this.deviceToken.next(token.value);
      console.log('Console log antes de enviar el token a la base de datos ');
      this.sendTokenToServer(token.value, username);
    });

    // Errores en el registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on push registration: ', error);
    });

    // Cuando se recibe una notificación mientras la app está en primer plano
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push recibido en primer plano: ', notification);
        this.handleNotification(notification);
      }
    );

    // Cuando el usuario pulsa en una notificación (app en segundo plano)
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Push action performed: ', action);
        this.handleNotificationAction(action);
      }
    );
  }

  /**
   * Envía el token de dispositivo al servidor
   */
  private async sendTokenToServer(
    token: string,
    username: string
  ): Promise<void> {
    console.log('Enviando token al servidor');
    try {
      console.log('Aqui cargamos headers y body');
      const headers = this.getAuthHeaders('application/json');
      const body = {
        username: username,
        token_movil: token,
      };
      console.log('vamos a enviar el token a la bbdd');

      this.http.post(`${this.apiUrl}token`, body, { headers }).subscribe({
        next: (response) =>
          console.log('Token registrado correctamente:', response),
        error: (error) => {
          // Mostrar más información sobre el error
          console.error('Error al registrar token - status:', error.status);
          console.error('Error al registrar token - message:', error.message);
          if (error.error) {
            console.error('Error del servidor:', error.error);
          }
          // Si necesitas ver todo el objeto de error completo
          console.error('Error completo:', JSON.stringify(error, null, 2));
        },
      });

      console.log('Token enviado al servidor');
    } catch (error) {
      console.error(
        'Error al enviar token al servidor:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Maneja una notificación recibida cuando la app está en primer plano
   */
  private handleNotification(notification: PushNotificationSchema): void {
    // Aquí puedes mostrar una notificación personalizada dentro de la app
    // O actualizar la interfaz de usuario

    // Actualizar la lista de mensajes si es un mensaje nuevo
    if (notification.data && notification.data.type === 'chat_message') {
      // Solicitar actualización de los mensajes
      const senderId = notification.data.senderId;
      if (senderId) {
        this.chatService.loadConversation(senderId);
      }
    }
  }

  /**
   * Maneja la acción cuando el usuario pulsa en una notificación
   */
  private handleNotificationAction(action: ActionPerformed): void {
    const data = action.notification.data;

    if (data && data.type === 'chat_message' && data.senderId) {
      // Navegar a la conversación con el remitente
      this.router.navigate(['/chat', data.senderId]);
    }
  }

  /**
   * Obtiene el ID único del dispositivo (útil para identificar dispositivos)
   */
  async getDeviceId(): Promise<string> {
    try {
      const info = await Device.getId();
      return info.identifier;
    } catch (error) {
      console.error('Error al obtener ID de dispositivo:', error);
      return 'unknown-device';
    }
  }

  /**
   * Elimina todas las notificaciones entregadas
   */
  async removeAllDeliveredNotifications(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.removeAllDeliveredNotifications();
    }
  }

  /**
   * Elimina los listeners de notificaciones cuando el servicio se destruye
   */
  removeListeners(): void {
    PushNotifications.removeAllListeners();
  }

  /**
   * Get authorization headers with token
   * @param contentType Optional content type
   * @returns HttpHeaders object
   */
  private getAuthHeaders(contentType?: string): HttpHeaders {
    let headers = new HttpHeaders({
      Authorization: `Bearer ${this.jwtToken}`,
    });
    if (contentType) {
      headers = headers.set('Content-Type', contentType);
    }
    return headers;
  }
}
