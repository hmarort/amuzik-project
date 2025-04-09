import { Component, OnInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonToggle, 
  IonIcon, 
  IonSelect, 
  IonSelectOption,
  IonRadioGroup,
  IonRadio,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItemDivider,
  IonButton,
  IonGrid,
  IonRow,
  IonCol, IonRange } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  contrastOutline, 
  colorPaletteOutline, 
  moonOutline, 
  sunnyOutline, 
  checkmarkCircleOutline, textOutline } from 'ionicons/icons';

interface Tema {
  id: string;
  nombre: string;
  colorClase: string;
  colorPrincipal: string;
  modoOscuro: boolean;
}

@Component({
  selector: 'app-apariencia',
  templateUrl: './apariencia.page.html',
  styleUrls: ['./apariencia.page.scss'],
  standalone: true,
  imports: [IonRange, 
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    CommonModule, 
    FormsModule,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonRadioGroup,
    IonRadio,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonItemDivider,
    IonButton,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class AparienciaPage implements OnInit {
  // Tema actual
  temaActual: string = 'light';
  modoOscuro: boolean = false;

  // Temas disponibles
  temas: Tema[] = [
    { 
      id: 'green', 
      nombre: 'Verde Pastel', 
      colorClase: 'theme-pastel-green', 
      colorPrincipal: '#7acb7a',
      modoOscuro: false
    },
    { 
      id: 'blue', 
      nombre: 'Azul Pastel', 
      colorClase: 'theme-pastel-blue', 
      colorPrincipal: '#7fb2d9',
      modoOscuro: false
    },
    { 
      id: 'purple', 
      nombre: 'Morado Pastel', 
      colorClase: 'theme-pastel-purple', 
      colorPrincipal: '#c17fd9',
      modoOscuro: false
    },
    { 
      id: 'red', 
      nombre: 'Rojo Pastel', 
      colorClase: 'theme-pastel-red', 
      colorPrincipal: '#e78787',
      modoOscuro: false
    },
    { 
      id: 'orange', 
      nombre: 'Naranja Pastel', 
      colorClase: 'theme-pastel-orange', 
      colorPrincipal: '#f2a76c',
      modoOscuro: false
    }
  ];

  constructor(private renderer: Renderer2) {
    addIcons({contrastOutline,colorPaletteOutline,checkmarkCircleOutline,textOutline,moonOutline,sunnyOutline});
  }

  ngOnInit() {
    // Cargar tema guardado si existe
    this.cargarTemaGuardado();
  }

  cargarTemaGuardado() {
    // Obtener tema del localStorage
    const temaGuardado = localStorage.getItem('tema-app');
    const modoOscuroGuardado = localStorage.getItem('modo-oscuro-app');
    
    if (temaGuardado) {
      // Extraer solo el color base (sin el -light o -dark)
      const colorBase = temaGuardado.split('-light')[0].split('-dark')[0];
      
      // Buscar el tema en nuestra lista
      const temaEncontrado = this.temas.find(t => t.colorClase === colorBase);
      
      if (temaEncontrado) {
        this.seleccionarTema(temaEncontrado);
      }
    }
    
    if (modoOscuroGuardado === 'true') {
      this.modoOscuro = true;
      this.cambiarModoOscuro();
    }
  }

  seleccionarTema(tema: Tema) {
    // Actualizar tema actual
    const baseClase = tema.colorClase;
    const modoSufijo = this.modoOscuro ? '-dark' : '-light';
    this.temaActual = `${baseClase}${modoSufijo}`;
    
    // Eliminar todas las clases de tema del body
    document.body.classList.forEach(clase => {
      if (clase.startsWith('theme-')) {
        this.renderer.removeClass(document.body, clase);
      }
    });
    
    // Añadir la nueva clase de tema
    this.renderer.addClass(document.body, this.temaActual);
    
    // Guardar en localStorage
    localStorage.setItem('tema-app', this.temaActual);
    
    // Actualizar también el meta theme-color para la barra de estado en móviles
    const metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', tema.colorPrincipal);
    }
  }

  cambiarModoOscuro() {
    // Actualizar estado
    this.modoOscuro = !this.modoOscuro;
    
    // Actualizar tema actual
    const temaActualBase = this.temaActual.split('-light')[0].split('-dark')[0];
    const nuevoTema = this.temas.find(t => t.colorClase === temaActualBase);
    
    if (nuevoTema) {
      this.seleccionarTema(nuevoTema);
    }
    
    // Guardar preferencia
    localStorage.setItem('modo-oscuro-app', this.modoOscuro.toString());
    
    // Aplicar clase dark al body si es necesario
    if (this.modoOscuro) {
      this.renderer.addClass(document.body, 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark');
    }
  }

  obtenerTemaActualId(): string {
    // Extraer el id del tema actual
    for (const tema of this.temas) {
      if (this.temaActual.includes(tema.colorClase)) {
        return tema.id;
      }
    }
    return '';
  }

  // Utilizado para obtener la clase de vista previa
  obtenerClasePrevia(tema: Tema): string {
    const sufijo = this.modoOscuro ? '-dark' : '-light';
    return `${tema.colorClase}${sufijo}`;
  }
  updateFontSize(event: CustomEvent) {
    const percentage = event.detail.value;
    document.documentElement.style.fontSize = `${percentage}%`;
  }
  
}