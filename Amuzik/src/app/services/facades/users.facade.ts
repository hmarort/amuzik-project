import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserRequest } from '../requests/users.request';

@Injectable({
  providedIn: 'root'
})
export class UserFacade {
  constructor(private userRequest: UserRequest) {}
  
  /**
   * Login with username and password
   */
  login(username: string, password: string): Observable<any> {
    return this.userRequest.login(username, password);
  }
  
  /**
   * Register a new user
   */
  register(userData: FormData): Observable<any> {
    return this.userRequest.register(userData);
  }
  
  /**
   * Update user data
   */
  updateUserData(userData: FormData): Observable<any> {
    return this.userRequest.updateUserData(userData);
  }
  
  /**
   * Get user by ID
   */
  getUserById(userId: string): Observable<any> {
    return this.userRequest.getUserById(userId);
  }
  
  /**
   * Get user by username
   */
  getUserByUsername(username: string): Observable<any> {
    return this.userRequest.getUserByUsername(username);
  }
  
  /**
   * Save friend relationship
   */
  saveFriend(userId: string, friendId: string): Observable<any> {
    return this.userRequest.saveFriend(userId, friendId);
  }

  deleteFriend(userId: string, friendId: string): Observable<any> {
    return this.userRequest.deleteFriend(userId, friendId);
  }
}