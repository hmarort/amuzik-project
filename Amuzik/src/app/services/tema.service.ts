import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TemaConfig {
  id: string;
  nombre: string;
  colorClase: string;
  colorPrincipal: string;
}

@Injectable({
  providedIn: 'root'
})
export class TemaService {
  private renderer: Renderer2;
  private temaActualSubject = new BehaviorSubject<string>('theme-pastel-green-light');
  temaActual$ = this.temaActualSubject.asObservable();
  
  private modoOscuroSubject = new BehaviorSubject<boolean>(false);
  modoOscuro$ = this.modoOscuroSubject.asObservable();

  // Lista de temas disponibles
  temasDisponibles: TemaConfig[] = [
    { 
      id: 'green', 
      nombre: 'Verde Pastel', 
      colorClase: 'theme-pastel-green', 
      colorPrincipal: '#7acb7a' 
    },
    { 
      id: 'blue', 
      nombre: 'Azul Pastel', 
      colorClase: 'theme-pastel-blue', 
      colorPrincipal: '#7fb2d9' 
    },
    { 
      id: 'purple', 
      nombre: 'Morado Pastel', 
      colorClase: 'theme-pastel-purple', 
      colorPrincipal: '#c17fd9' 
    },
    { 
      id: 'red', 
      nombre: 'Rojo Pastel', 
      colorClase: 'theme-pastel-red', 
      colorPrincipal: '#e78787' 
    },
    { 
      id: 'orange', 
      nombre: 'Naranja Pastel', 
      colorClase: 'theme-pastel-orange', 
      colorPrincipal: '#f2a76c' 
    }
  ];

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.inicializarTema();
  }

  private inicializarTema() {
    // Cargar preferencias guardadas
    const temaGuardado = localStorage.getItem('tema-app') || 'theme-pastel-green-light';
    const modoOscuroGuardado = localStorage.getItem('modo-oscuro-app') === 'true';
    
    // Establecer valores iniciales
    this.temaActualSubject.next(temaGuardado);
    this.modoOscuroSubject.next(modoOscuroGuardado);
    
    // Aplicar tema
    this.aplicarTema(temaGuardado);
    
    // Aplicar modo oscuro si es necesario
    if (modoOscuroGuardado) {
      this.renderer.addClass(document.body, 'dark');
    }
  }

  cambiarTema(temaId: string) {
    // Buscar el tema por ID
    const tema = this.temasDisponibles.find(t => t.id === temaId);
    if (!tema) return;
    
    // Construir el nombre completo del tema con el modo
    const modoSufijo = this.modoOscuroSubject.value ? '-dark' : '-light';
    const nombreCompleto = `${tema.colorClase}${modoSufijo}`;
    
    // Aplicar el tema
    this.aplicarTema(nombreCompleto);
    
    // Actualizar el tema actual
    this.temaActualSubject.next(nombreCompleto);
    
    // Guardar en localStorage
    localStorage.setItem('tema-app', nombreCompleto);
  }

  cambiarModoOscuro(activar: boolean) {
    // Actualizar el estado
    this.modoOscuroSubject.next(activar);
    
    // Guardar en localStorage
    localStorage.setItem('modo-oscuro-app', activar.toString());
    
    // Modificar la clase dark del body
    if (activar) {
      this.renderer.addClass(document.body, 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark');
    }
    
    // Actualizar el tema con el nuevo modo
    const temaActual = this.temaActualSubject.value;
    const baseClase = temaActual.split('-light')[0].split('-dark')[0];
    const nuevoTema = `${baseClase}${activar ? '-dark' : '-light'}`;
    
    // Aplicar el tema actualizado
    this.aplicarTema(nuevoTema);
    
    // Actualizar el tema actual
    this.temaActualSubject.next(nuevoTema);
    
    // Guardar en localStorage
    localStorage.setItem('tema-app', nuevoTema);
  }

  private aplicarTema(nombreClase: string) {
    // Eliminar todas las clases de tema anteriores
    document.body.classList.forEach(clase => {
      if (clase.startsWith('theme-')) {
        this.renderer.removeClass(document.body, clase);
      }
    });
    
    // Añadir la nueva clase de tema
    this.renderer.addClass(document.body, nombreClase);
    
    // Actualizar el meta theme-color
    const metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (metaThemeColor) {
      // Buscar el color principal del tema actual
      const temaId = nombreClase.split('-')[2];
      const tema = this.temasDisponibles.find(t => t.id === temaId);
      if (tema) {
        metaThemeColor.setAttribute('content', tema.colorPrincipal);
      }
    }
  }

  restaurarConfiguracionPredeterminada() {
    // Tema predeterminado y modo claro
    this.cambiarModoOscuro(false);
    this.cambiarTema('green');
  }
}