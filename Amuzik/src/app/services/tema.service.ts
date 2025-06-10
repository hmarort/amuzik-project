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

  /**
   * Constructor del servicio de tema.
   * @param rendererFactory 
   */
  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    
    this.prefiereModoOscuro = window.matchMedia('(prefers-color-scheme: dark)');
    
    this.prefiereModoOscuro.addEventListener('change', (e) => {
      if (this.preferenciaModoBrillo.value === 'sistema') {
        this.cambiarModoOscuro(e.matches);
      }
    });
    
    this.inicializarTema();
  }

  /**
   * Inicializa el tema y el modo de brillo según la configuración guardada en localStorage.
   */
  private inicializarTema() {
    const temaGuardado = localStorage.getItem('tema-app') || 'theme-standard-light';
    const modoPreferencia = localStorage.getItem('modo-preferencia') as ModoTema || 'sistema';
    
    this.preferenciaModoBrillo.next(modoPreferencia);
    
    let usarModoOscuro: boolean;
    
    if (modoPreferencia === 'sistema') {
      usarModoOscuro = this.prefiereModoOscuro.matches;
    } else {
      usarModoOscuro = modoPreferencia === 'oscuro';
    }
    
    this.modoOscuroSubject.next(usarModoOscuro);
    
    const baseClase = temaGuardado.split('-light')[0].split('-dark')[0];
    const nombreCompletoTema = `${baseClase}${usarModoOscuro ? '-dark' : '-light'}`;
    
    this.temaActualSubject.next(nombreCompletoTema);
    
    this.aplicarTema(nombreCompletoTema);
    
    if (usarModoOscuro) {
      this.renderer.addClass(document.body, 'dark');
    }
  }
  /**
   * Cambia el tema de la aplicación.
   * @param temaId 
   * @returns 
   */
  cambiarTema(temaId: string) {
    const tema = this.temasDisponibles.find(t => t.id === temaId);
    if (!tema) return;
    
    const modoSufijo = this.modoOscuroSubject.value ? '-dark' : '-light';
    const nombreCompleto = `${tema.colorClase}${modoSufijo}`;
    
    this.aplicarTema(nombreCompleto);
    
    this.temaActualSubject.next(nombreCompleto);
    
    localStorage.setItem('tema-app', nombreCompleto);
  }

  /**
   * Funcion para cambiar al modo oscruro o claro.
   * @param activar 
   */
  cambiarModoOscuro(activar: boolean) {
    this.modoOscuroSubject.next(activar);
    
    if (activar) {
      this.renderer.addClass(document.body, 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark');
    }
    
    const temaActual = this.temaActualSubject.value;
    const baseClase = temaActual.split('-light')[0].split('-dark')[0];
    const nuevoTema = `${baseClase}${activar ? '-dark' : '-light'}`;
    
    this.aplicarTema(nuevoTema);
    
    this.temaActualSubject.next(nuevoTema);
    
    localStorage.setItem('tema-app', nuevoTema);
  }
  
  /**
   * Cambia la preferencia de modo de la aplicación.
   * @param modo 
   */
  cambiarPreferenciaModo(modo: ModoTema) {
    this.preferenciaModoBrillo.next(modo);
    localStorage.setItem('modo-preferencia', modo);
    
    if (modo === 'sistema') {
      this.cambiarModoOscuro(this.prefiereModoOscuro.matches);
    } else {
      this.cambiarModoOscuro(modo === 'oscuro');
    }
  }

  /**
   * Obtiene la preferencia de modo actual
   * @returns 
   */
  obtenerPreferenciaModo(): ModoTema {
    return this.preferenciaModoBrillo.value;
  }
  /**
   * Aplicamos el tema al cuerpo del documento
   * @param nombreClase 
   */
  private aplicarTema(nombreClase: string) {
    document.body.classList.forEach(clase => {
      if (clase.startsWith('theme-')) {
        this.renderer.removeClass(document.body, clase);
      }
    });
    
    this.renderer.addClass(document.body, nombreClase);
    
    const metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (metaThemeColor) {
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

  /**
   * Restauramos el estilo al que hemos decidido por defecto
   */
  restaurarConfiguracionPredeterminada() {
    this.cambiarPreferenciaModo('sistema');
    this.cambiarTema('standard');
  }
}