import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Interfaz de datos de usuario de google que ya no necesitamos, pero mantenemos
 * por compatibilidad con el código antiguo
 */
export interface GoogleUserData {
  email: string;
  nombre: string;
  apellidos: string;
  username: string;
  password: string;
  pfp?: File | Blob;
}

@Injectable({
  providedIn: 'root',
})
export class UserRequest {
  private apiUrl = environment.apiUrl;
  private token = environment.JWT_SECRET;

  /**
   * Contructor de la clase
   * @param http 
   */
  constructor(private http: HttpClient) {}

  /**
   * Obtiene el token de autenticación
   * @param contentType 
   * @returns 
   */
  private getAuthHeaders(contentType?: string): HttpHeaders {
    let headers = new HttpHeaders({
      Authorization: `Bearer ${this.token}`
    });
    if (contentType) {
      headers = headers.set('Content-Type', contentType);
    }
    return headers;
  }

  /**
   * Login usando username y contraseña
   * @param username 
   * @param password 
   * @returns 
   */
  login(username: string, password: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = { username, password };
    return this.http.post(`${this.apiUrl}login`, body, { headers });
  }

  /**
   * Registro de usuario
   * @param userData 
   * @returns 
   */
  register(userData: FormData): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}register`, userData, { headers });
  }

  /**
   * Actualizacion de los datos del usuario
   * @param userData 
   * @returns 
   */
  updateUserData(userData: FormData): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}update`, userData, { headers });
  }

  /**
   * Obtenemos usuario a través de su id
   * @param userId 
   * @returns 
   */
  getUserById(userId: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get(`${this.apiUrl}info?id=${userId}`, { headers });
  }

  /**
   * Obtenemos el usuario a través de su nombre de usuario
   * @param username 
   * @returns 
   */
  getUserByUsername(username: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = { username };
    return this.http.post(`${this.apiUrl}find`, body, { headers });
  }

  /**
   * Eliminar a un usuario
   * @param userId 
   * @returns 
   */
  deleteUser(userId: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = { id: userId };
    return this.http.post(`${this.apiUrl}delete`, body, { headers });
  }

  /**
   * Guardamos la relación de amistad entre usuarios
   * @param userId 
   * @param friendId 
   * @returns 
   */
  saveFriend(userId: string, friendId: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = {
      user_id: userId,
      friend_id: friendId,
    };
    return this.http.post(`${this.apiUrl}saveFriendship`, body, { headers });
  }

  /**
   * Eliminamos la relación de amistad de los usuarios
   * @param userId 
   * @param friendId 
   * @returns 
   */
  deleteFriend(userId: string, friendId: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = {
      user_id: userId,
      friend_id: friendId,
    };
    return this.http.post(`${this.apiUrl}deleteFriendship`, body, { headers });
  }
}