import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = environment.apiUrl;
  private token = 'W66jQhYGGzEIuCcAXfpTJkt7uH6GBGpcJLCSXo6O2WF1AZkxiMXpypFaKEfA';

  constructor(private http: HttpClient) { }

  // Método para iniciar sesión (login)
  login(username: string, password: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    });

    const body = {
      username,
      password
    };

    return this.http.post(`${this.apiUrl}find`, body, { headers });
  }

  // Método para registrar un usuario (signin)
  register(userData: FormData): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`
    });

    return this.http.post(`${this.apiUrl}sign`, userData, { headers });
  }
}