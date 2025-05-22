import { Injectable } from '@angular/core';
import { NativeBiometric} from 'capacitor-native-biometric';
import { Platform } from '@ionic/angular/standalone';
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class BiometricService {
  private biometricCredentialsKey = 'ionic_app_credentials';

  /**
   * Constructor de la clase
   * @param platform 
   */
  constructor(private platform: Platform) {}

  /**
   * Verifica si la biometría está disponible en el dispositivo
   * @returns 
   */
  isBiometricsAvailable(): Observable<boolean> {
    if (!this.platform.is('capacitor')) {
      return of(false);
    }

    return from(NativeBiometric.isAvailable()).pipe(
      map(result => result.isAvailable),
      catchError(error => {
        console.error('Error verificando disponibilidad biométrica:', error);
        return of(false);
      })
    );
  }

  /**
   * Guarda las credenciales en el dispositivo siendo solo accesibles a través de la biometría
   * @param username 
   * @param password 
   * @returns 
   */
  saveCredentials(username: string, password: string): Observable<boolean> {
    if (!this.platform.is('capacitor')) {
      return of(false);
    }

    return from(NativeBiometric.setCredentials({
      username,
      password,
      server: this.biometricCredentialsKey,
    })).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error guardando credenciales biométricas:', error);
        return of(false);
      })
    );
  }

  /**
   * Identifica al usuario atrabés de la biometría
   * @returns 
   */
  verifyIdentity(): Observable<{ username: string; password: string } | null> {
    if (!this.platform.is('capacitor')) {
      return of(null);
    }

    return from(NativeBiometric.verifyIdentity({
      reason: "Iniciar sesión",
      title: "Autenticación biométrica",
      subtitle: "Usa tu huella digital para acceder",
      description: "Este método proporciona mayor seguridad para tus datos"
    })).pipe(
      switchMap(() => this.getCredentials()),
      catchError(error => {
        console.error('Error en verificación biométrica:', error);
        return of(null);
      })
    );
  }

  /**
   * Obtenemos las credenciales almacenadas
   * @returns 
   */
  private getCredentials(): Observable<{ username: string; password: string } | null> {
    return from(NativeBiometric.getCredentials({
      server: this.biometricCredentialsKey,
    })).pipe(
      map(credentials => ({
        username: credentials.username,
        password: credentials.password
      })),
      catchError(error => {
        console.error('Error obteniendo credenciales:', error);
        return of(null);
      })
    );
  }

  /**
   * Eliminamos las credenciales almacenadas
   * @returns 
   */
  deleteCredentials(): Observable<boolean> {
    return from(NativeBiometric.deleteCredentials({
      server: this.biometricCredentialsKey
    })).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error eliminando credenciales:', error);
        return of(false);
      })
    );
  }
}