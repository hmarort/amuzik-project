import { Component, OnInit, OnDestroy } from '@angular/core';
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
  IonCol, 
  IonRange, 
  IonBackButton, 
  IonButtons,
  IonSegment,
  IonSegmentButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  contrastOutline, 
  colorPaletteOutline, 
  moonOutline, 
  sunnyOutline, 
  checkmarkCircleOutline, 
  textOutline, 
  closeOutline,
  desktopOutline } from 'ionicons/icons';
import { TemaService, TemaConfig, ModoTema } from 'src/app/services/tema.service';
import { Subscription } from 'rxjs';

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
  imports: [
    IonButtons, 
    IonBackButton, 
    IonRange,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonToggle,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonSegment,
    IonSegmentButton
  ]
})
export class AparienciaPage implements OnInit, OnDestroy {
  // Tema actual
  temaActual: string = '';
  modoOscuro: boolean = false;
  
  // Modo de brillo preferido
  modoPreferido: ModoTema = 'sistema';

  // Temas disponibles (utilizando la interfaz local para mantener compatibilidad con el HTML)
  temas: Tema[] = [];
  
  // Suscripciones
  private temaSubscription: Subscription = new Subscription;
  private modoOscuroSubscription: Subscription = new Subscription;
  private preferenciaModoBrilloSubscription: Subscription = new Subscription;

  constructor(private temaService: TemaService) {
    addIcons({
      closeOutline,
      contrastOutline,
      colorPaletteOutline,
      checkmarkCircleOutline,
      textOutline,
      moonOutline,
      sunnyOutline,
      desktopOutline
    });
  }

  ngOnInit() {
    // Mapear los temas del servicio a la estructura local
    this.temas = this.temaService.temasDisponibles
      .filter(tema => ['green', 'blue', 'purple', 'red', 'orange','standard','neutral'].includes(tema.id))
      .map(tema => ({
        id: tema.id,
        nombre: tema.nombre,
        colorClase: tema.colorClase,
        colorPrincipal: tema.colorPrincipal,
        modoOscuro: false
      }));
    
    // Suscribirse a los cambios de tema
    this.temaSubscription = this.temaService.temaActual$.subscribe(tema => {
      this.temaActual = tema;
    });
    
    // Suscribirse a los cambios de modo oscuro
    this.modoOscuroSubscription = this.temaService.modoOscuro$.subscribe(modo => {
      this.modoOscuro = modo;
      
      // Actualizar el estado de modo oscuro en los objetos tema
      this.temas.forEach(tema => {
        tema.modoOscuro = modo;
      });
    });
    
    // Suscribirse a la preferencia de modo brillo
    this.preferenciaModoBrilloSubscription = this.temaService.preferenciaModoBrillo$.subscribe(modo => {
      this.modoPreferido = modo;
    });
  }

  ngOnDestroy() {
    // Cancelar suscripciones para evitar memory leaks
    if (this.temaSubscription) {
      this.temaSubscription.unsubscribe();
    }
    if (this.modoOscuroSubscription) {
      this.modoOscuroSubscription.unsubscribe();
    }
    if (this.preferenciaModoBrilloSubscription) {
      this.preferenciaModoBrilloSubscription.unsubscribe();
    }
  }

  // Método para seleccionar un tema (compatible con el HTML original)
  seleccionarTema(tema: Tema) {
    this.temaService.cambiarTema(tema.id);
  }

  // Método para cambiar el modo oscuro o claro manualmente
  cambiarModoManual(modo: ModoTema) {
    this.temaService.cambiarPreferenciaModo(modo);
  }

  // Método para obtener la clase de vista previa (compatible con el HTML original)
  obtenerClasePrevia(tema: Tema): string {
    const sufijo = this.modoOscuro ? '-dark' : '-light';
    return `${tema.colorClase}${sufijo}`;
  }

  // Método para obtener el ID del tema actual (compatible con el HTML original)
  obtenerTemaActualId(): string {
    // Extraer el id del tema actual desde el nombre de la clase
    const temaActualNombre = this.temaActual.split('-light')[0].split('-dark')[0];
    
    for (const tema of this.temas) {
      if (temaActualNombre === tema.colorClase) {
        return tema.id;
      }
    }
    return '';
  }

  // Método para actualizar el tamaño de fuente
  updateFontSize(event: CustomEvent) {
    const percentage = event.detail.value;
    document.documentElement.style.fontSize = `${percentage}%`;
    // Podrías guardar esta preferencia en localStorage si deseas que persista
    localStorage.setItem('font-size', percentage.toString());
  }

  // Método para restaurar la configuración predeterminada
  restaurarConfiguracion() {
    // Usar el método del servicio
    this.temaService.restaurarConfiguracionPredeterminada();
    
    // Restaurar también el tamaño de fuente
    document.documentElement.style.fontSize = '100%';
    localStorage.removeItem('font-size');
  }
}