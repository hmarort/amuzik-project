// src/app/services/config.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

/**
 * Interfaz para el usuario
 */
export interface Usuario {
  nombre: string;
  email: string;
  foto: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  
  private usuarioSubject = new BehaviorSubject<Usuario>({
    nombre: 'Usuario Ejemplo',
    email: 'usuario@ejemplo.com',
    foto: 'https://ionicframework.com/docs/img/demos/avatar.svg',
  });

  /**
   * Constructor de la clase ConfigService
   * @param http 
   */
  constructor(private http: HttpClient) {
    this.cargarUsuario();
  }

  get usuario$(): Observable<Usuario> {
    return this.usuarioSubject.asObservable();
  }

  get usuarioActual(): Usuario {
    return this.usuarioSubject.value;
  }

  /**
   * Carga el usuario desde localStorage
   */
  cargarUsuario(): void {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (usuarioGuardado) {
      this.usuarioSubject.next(JSON.parse(usuarioGuardado));
    }
  }

  /**
   * Gurda el usuario en el localStorage.
   * @param usuario 
   * @returns 
   */
  guardarUsuario(usuario: Usuario): Observable<Usuario> {
    this.usuarioSubject.next(usuario);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    return of(usuario);
  }

  /**
   * Cierra la sesión del usuario.
   * @returns 
   */
  cerrarSesion(): Observable<boolean> {
    localStorage.removeItem('authToken');
    return of(true);
  }
}
