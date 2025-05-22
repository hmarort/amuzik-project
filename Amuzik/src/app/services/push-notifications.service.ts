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

  /**
   * Constructor de la clase
   * @param router 
   * @param platform 
   * @param chatService 
   * @param authService 
   * @param http 
   */
  constructor(
    private router: Router,
    private platform: Platform,
    private chatService: ChatService,
    private authService: AuthService,
    private http: HttpClient
  ) {}
  /**
   * Inicializa las notificaciones.
   * @param username 
   * @returns 
   */
  async initialize(username: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });
      const permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
          return;
        }
      } else if (permStatus.receive !== 'granted') {
        return;
      }

      await this.registerListeners(username);
      await PushNotifications.register();
    } catch (error) {
      console.error('Error al inicializar las notificaciones push:', error);
    }
  }

  /**
   * Resgitra los listeners que se encargan de recibir las notificaciones.
   * @param username 
   */
  private async registerListeners(username: string): Promise<void> {
    PushNotifications.addListener('registration', (token: Token) => {
      this.deviceToken.next(token.value);
      this.sendTokenToServer(token.value, username);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on push registration: ', error);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        this.handleNotification(notification);
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        this.handleNotificationAction(action);
      }
    );
  }
  /**
   * Envía el token al websocket para guardarlo en la bbdd y asi cuando se envie 
   * un mensaje a ese usuario, se le envie la notificacion.
   * @param token 
   * @param username 
   */
  private async sendTokenToServer(
    token: string,
    username: string
  ): Promise<void> {
    try {
      const headers = this.getAuthHeaders('application/json');
      const body = {
        username: username,
        token_movil: token,
      };

      this.http.post(`${this.apiUrl}token`, body, { headers }).subscribe({
        next: (response) =>
          console.log('Token registrado correctamente:', response),
        error: (error) => {
          console.error('Error al registrar token - status:', error.status);
          console.error('Error al registrar token - message:', error.message);
          if (error.error) {
            console.error('Error del servidor:', error.error);
          }
          console.error('Error completo:', JSON.stringify(error, null, 2));
        },
      });
    } catch (error) {
      console.error(
        'Error al enviar token al servidor:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Maneja la notificación recibida.
   * @param notification 
   */
  private handleNotification(notification: PushNotificationSchema): void {
    if (notification.data && notification.data.type === 'chat_message') {
      const senderId = notification.data.senderId;
      if (senderId) {
        this.chatService.loadConversation(senderId);
      }
    }
  }

  /**
   * Maneja la acción de la notificación.
   * @param action 
   */
  private handleNotificationAction(action: ActionPerformed): void {
    const data = action.notification.data;

    if (data && data.type === 'chat_message' && data.senderId) {
      this.router.navigate(['/chat', data.senderId]);
    }
  }
  /**
   * 
   * @returns Obtiene el Id del dispositivo.
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
   * Elimina todas las notificaciones entregadas.
   */
  async removeAllDeliveredNotifications(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.removeAllDeliveredNotifications();
    }
  }

  /**
   * Elimna los listeners de las aplicaciones.
   */
  removeListeners(): void {
    PushNotifications.removeAllListeners();
  }

  /**
   * Obtiene los headers de autorización para las peticiones HTTP
   * @param contentType 
   * @returns 
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
