import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GoogleUserData {
  email: string;
  nombre: string;
  apellidos: string;
  username: string;
  google_id: string;
  photo_url: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserRequest {
  private apiUrl = environment.apiUrl;
  private token = 'W66jQhYGGzEIuCcAXfpTJkt7uH6GBGpcJLCSXo6O2WF1AZkxiMXpypFaKEfA';
  
  constructor(private http: HttpClient) {}
  
  /**
   * Get authorization headers with token
   * @param contentType Optional content type
   * @returns HttpHeaders object
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
   * Login with username and password
   */
  login(username: string, password: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = { username, password };
    return this.http.post(`${this.apiUrl}login`, body, { headers });
  }
  
  /**
   * Register a new user
   */
  register(userData: FormData): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}register`, userData, { headers });
  }
  
  /**
   * Update user data
   */
  updateUserData(userData: FormData): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}update`, userData, { headers });
  }
  
  /**
   * Get user by ID
   */
  getUserById(userId: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get(`${this.apiUrl}info?id=${userId}`, { headers });
  }
  
  /**
   * Get user by username
   */
  getUserByUsername(username: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = { username };
    return this.http.post(`${this.apiUrl}find`, body, { headers });
  }
  
  /**
   * Save friend relationship
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
   * Delete friend relationship
   */
  deleteFriend(userId: string, friendId: string): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    const body = {
      user_id: userId,
      friend_id: friendId,
    };
    return this.http.post(`${this.apiUrl}deleteFriendship`, body, { headers });
  }
  
  /**
   * Find or create a user from Google Auth
   * Este método buscará un usuario por email, y si no existe, lo creará
   */
  findOrCreateGoogleUser(googleUser: GoogleUserData): Observable<any> {
    const headers = this.getAuthHeaders('application/json');
    return this.http.post(`${this.apiUrl}googleAuth`, googleUser, { headers });
  }
}