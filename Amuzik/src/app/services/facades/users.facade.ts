import { Injectable } from '@angular/core';
import { UserRequest } from '../requests/users.request';
@Injectable({
  providedIn: 'root'
})
export class UserFacade {

  constructor(private userRequest:UserRequest) { }

  login(username: string, password: string) {
    return this.userRequest.login(username, password);
  }
  register(userData: FormData) {
    return this.userRequest.register(userData);
  }
  updateUserData(userData: FormData) {
    return this.userRequest.updateUserData(userData);
  }
  getUserById(userId: string) {
    return this.userRequest.getUserById(userId);
  }
}
