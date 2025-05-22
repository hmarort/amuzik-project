import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRequest } from '../requests/users.request';

@Injectable({
  providedIn: 'root'
})
export class UserFacade {
  constructor(private userRequest: UserRequest) {}
  
  /**
   * Login usando username y contraseña
   * @param username 
   * @param password 
   * @returns 
   */
  login(username: string, password: string): Observable<any> {
    return this.userRequest.login(username, password);
  }
  
  /**
   * Registro del usuario
   * @param userData 
   * @returns 
   */
  register(userData: FormData): Observable<any> {
    return this.userRequest.register(userData);
  }
  
  /**
   * Actualizamos la información del usuario
   * @param userData 
   * @returns 
   */
  updateUserData(userData: FormData): Observable<any> {
    return this.userRequest.updateUserData(userData);
  }
  
  /**
   * Obtener usuario por su id
   * @param userId 
   * @returns 
   */
  getUserById(userId: string): Observable<any> {
    return this.userRequest.getUserById(userId);
  }
  
  /**
   * Obtener ususario a través de su username
   * @param username 
   * @returns 
   */
  getUserByUsername(username: string): Observable<any> {
    return this.userRequest.getUserByUsername(username);
  }
  
  /**
   * Guardamos la relación de amistad entre usuarios
   * @param userId 
   * @param friendId 
   * @returns 
   */
  saveFriend(userId: string, friendId: string): Observable<any> {
    return this.userRequest.saveFriend(userId, friendId);
  }

  /**
   * Eliminamos la relación de amistad entre dos usuarios
   * @param userId
   * @param friendId 
   * @returns 
   */
  deleteFriend(userId: string, friendId: string): Observable<any> {
    return this.userRequest.deleteFriend(userId, friendId);
  }
}