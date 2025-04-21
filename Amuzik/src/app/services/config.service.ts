// src/app/services/config.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

export interface Usuario {
  nombre: string;
  email: string;
  foto: string;
}

export interface Configuraciones {
  cuenta: {
    idioma: string;
    tema: boolean; // false = claro, true = oscuro
  };
  notificaciones: {
    push: boolean;
    email: boolean;
    sonido: boolean;
    vibracion: boolean;
  };
  general: {
    autoGuardado: boolean;
    sincronizarDatos: boolean;
    compartirEstadisticas: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private API_URL = 'https://tu-api.com/api'; // URL base de tu API (cambiar según corresponda)
  
  private configSubject = new BehaviorSubject<Configuraciones>({
    cuenta: {
      idioma: 'es',
      tema: false,
    },
    notificaciones: {
      push: true,
      email: true,
      sonido: true,
      vibracion: true
    },
    general: {
      autoGuardado: true,
      sincronizarDatos: true,
      compartirEstadisticas: false
    }
  });
  
  private usuarioSubject = new BehaviorSubject<Usuario>({
    nombre: 'Usuario Ejemplo',
    email: 'usuario@ejemplo.com',
    foto: 'https://ionicframework.com/docs/img/demos/avatar.svg'
  });

  constructor(private http: HttpClient) {
    this.cargarConfiguraciones();
    this.cargarUsuario();
  }

  // Getters para acceder a los datos
  get configuraciones$(): Observable<Configuraciones> {
    return this.configSubject.asObservable();
  }

  get configuracionesActuales(): Configuraciones {
    return this.configSubject.value;
  }

  get usuario$(): Observable<Usuario> {
    return this.usuarioSubject.asObservable();
  }

  get usuarioActual(): Usuario {
    return this.usuarioSubject.value;
  }

  // Cargar configuraciones
  cargarConfiguraciones(): void {
    // Primero intentamos cargar desde localStorage
    const configGuardadas = localStorage.getItem('configuraciones');
    if (configGuardadas) {
      this.configSubject.next(JSON.parse(configGuardadas));
    }
    
    // Opcionalmente podemos cargar desde el servidor (comentado por ahora)
    /*
    this.http.get<Configuraciones>(`${this.API_URL}/configuraciones`)
      .pipe(
        tap(config => {
          this.configSubject.next(config);
          localStorage.setItem('configuraciones', JSON.stringify(config));
        }),
        catchError(error => {
          console.error('Error al cargar configuraciones:', error);
          return of(this.configSubject.value);
        })
      )
      .subscribe();
    */
  }

  // Cargar datos del usuario
  cargarUsuario(): void {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (usuarioGuardado) {
      this.usuarioSubject.next(JSON.parse(usuarioGuardado));
    }
    
    // Similar al anterior, podríamos cargar desde el servidor
  }

  // Guardar configuraciones
  guardarConfiguraciones(configuraciones: Configuraciones): Observable<Configuraciones> {
    // Actualizamos el subject y guardamos en localStorage
    this.configSubject.next(configuraciones);
    localStorage.setItem('configuraciones', JSON.stringify(configuraciones));
    
    // Si tienes un backend, podrías sincronizar con él
    // return this.http.post<Configuraciones>(`${this.API_URL}/configuraciones`, configuraciones);
    
    // Por ahora simplemente devolvemos las configuraciones
    return of(configuraciones);
  }

  // Guardar datos del usuario
  guardarUsuario(usuario: Usuario): Observable<Usuario> {
    this.usuarioSubject.next(usuario);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    return of(usuario);
  }

  // Cerrar sesión
  cerrarSesion(): Observable<boolean> {
    // Eliminar datos de sesión
    localStorage.removeItem('authToken');
    return of(true);
  }
}