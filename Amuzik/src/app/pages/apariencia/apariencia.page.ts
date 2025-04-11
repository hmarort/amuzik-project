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
  temaActual: string = '';
  modoOscuro: boolean = false;  
  modoPreferido: ModoTema = 'sistema';
  temas: Tema[] = [];
  
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
    this.temas = this.temaService.temasDisponibles
      .filter(tema => ['green', 'blue', 'purple', 'red', 'orange','standard','neutral'].includes(tema.id))
      .map(tema => ({
        id: tema.id,
        nombre: tema.nombre,
        colorClase: tema.colorClase,
        colorPrincipal: tema.colorPrincipal,
        modoOscuro: false
      }));
    
    this.temaSubscription = this.temaService.temaActual$.subscribe(tema => {
      this.temaActual = tema;
    });
    this.modoOscuroSubscription = this.temaService.modoOscuro$.subscribe(modo => {
      this.modoOscuro = modo;
      
      this.temas.forEach(tema => {
        tema.modoOscuro = modo;
      });
    });
    
    this.preferenciaModoBrilloSubscription = this.temaService.preferenciaModoBrillo$.subscribe(modo => {
      this.modoPreferido = modo;
    });
  }

  ngOnDestroy() {
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

  seleccionarTema(tema: Tema) {
    this.temaService.cambiarTema(tema.id);
  }

  cambiarModoManual(modo: ModoTema) {
    this.temaService.cambiarPreferenciaModo(modo);
  }

  obtenerClasePrevia(tema: Tema): string {
    const sufijo = this.modoOscuro ? '-dark' : '-light';
    return `${tema.colorClase}${sufijo}`;
  }

  obtenerTemaActualId(): string {
    const temaActualNombre = this.temaActual.split('-light')[0].split('-dark')[0];
    
    for (const tema of this.temas) {
      if (temaActualNombre === tema.colorClase) {
        return tema.id;
      }
    }
    return '';
  }

  updateFontSize(event: CustomEvent) {
    const percentage = event.detail.value;
    document.documentElement.style.fontSize = `${percentage}%`;
    localStorage.setItem('font-size', percentage.toString());
  }

  restaurarConfiguracion() {
    this.temaService.restaurarConfiguracionPredeterminada();
    
    document.documentElement.style.fontSize = '100%';
    localStorage.removeItem('font-size');
  }
}