import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TemaConfig {
  id: string;
  nombre: string;
  colorClase: string;
  colorPrincipal: string;
}

export type ModoTema = 'claro' | 'oscuro' | 'sistema';

@Injectable({
  providedIn: 'root'
})
export class TemaService {
  private renderer: Renderer2;
  private temaActualSubject = new BehaviorSubject<string>('theme-pastel-green-light');
  temaActual$ = this.temaActualSubject.asObservable();
  
  private modoOscuroSubject = new BehaviorSubject<boolean>(false);
  modoOscuro$ = this.modoOscuroSubject.asObservable();
  
  private preferenciaModoBrillo = new BehaviorSubject<ModoTema>('sistema');
  preferenciaModoBrillo$ = this.preferenciaModoBrillo.asObservable();

  // MediaQueryList para detectar el modo del sistema
  private prefiereModoOscuro: MediaQueryList;
  
  // Lista de temas disponibles
  temasDisponibles: TemaConfig[] = [
    { 
      id: 'neutral', 
      nombre: 'Color Neutro', 
      colorClase: 'theme-neutral', 
      colorPrincipal: '#666666' 
    },
    { 
      id: 'standard', 
      nombre: 'Color Standard', 
      colorClase: 'theme-standard', 
      colorPrincipal: '#3880ff' 
    },
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
    
    // Configurar la detección del modo del sistema
    this.prefiereModoOscuro = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Listener para cambios en la preferencia del sistema
    this.prefiereModoOscuro.addEventListener('change', (e) => {
      if (this.preferenciaModoBrillo.value === 'sistema') {
        this.cambiarModoOscuro(e.matches);
      }
    });
    
    this.inicializarTema();
  }

  private inicializarTema() {
    // Cargar preferencias guardadas
    const temaGuardado = localStorage.getItem('tema-app') || 'theme-pastel-green-light';
    const modoPreferencia = localStorage.getItem('modo-preferencia') as ModoTema || 'sistema';
    
    // Establecer la preferencia de modo
    this.preferenciaModoBrillo.next(modoPreferencia);
    
    // Determinar si debe estar en modo oscuro
    let usarModoOscuro: boolean;
    
    if (modoPreferencia === 'sistema') {
      // Usar la preferencia del sistema
      usarModoOscuro = this.prefiereModoOscuro.matches;
    } else {
      // Usar la preferencia manual
      usarModoOscuro = modoPreferencia === 'oscuro';
    }
    
    // Establecer valores iniciales
    this.modoOscuroSubject.next(usarModoOscuro);
    
    // Construir el nombre completo del tema con el modo correcto
    const baseClase = temaGuardado.split('-light')[0].split('-dark')[0];
    const nombreCompletoTema = `${baseClase}${usarModoOscuro ? '-dark' : '-light'}`;
    
    this.temaActualSubject.next(nombreCompletoTema);
    
    // Aplicar tema
    this.aplicarTema(nombreCompletoTema);
    
    // Aplicar modo oscuro si es necesario
    if (usarModoOscuro) {
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
  
  cambiarPreferenciaModo(modo: ModoTema) {
    // Guardar la preferencia
    this.preferenciaModoBrillo.next(modo);
    localStorage.setItem('modo-preferencia', modo);
    
    // Aplicar el modo correspondiente
    if (modo === 'sistema') {
      // Usar la preferencia del sistema
      this.cambiarModoOscuro(this.prefiereModoOscuro.matches);
    } else {
      // Establecer modo manual
      this.cambiarModoOscuro(modo === 'oscuro');
    }
  }

  obtenerPreferenciaModo(): ModoTema {
    return this.preferenciaModoBrillo.value;
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
      const temaIdParts = nombreClase.split('-');
      let temaId = '';
      if (temaIdParts.length >= 3) {
        temaId = temaIdParts[2];
      }
      const tema = this.temasDisponibles.find(t => t.id === temaId);
      if (tema) {
        metaThemeColor.setAttribute('content', tema.colorPrincipal);
      }
    }
  }

  restaurarConfiguracionPredeterminada() {
    // Tema predeterminado, modo automático (sistema)
    this.cambiarPreferenciaModo('sistema');
    this.cambiarTema('standard');
  }
}