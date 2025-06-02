import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle,
  IonMenuToggle, 
  IonToolbar, 
  IonLabel, 
  IonIcon, 
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonGrid,
  IonRow,
  IonCol, 
  IonRange, 
  IonBackButton, 
  IonButtons,
  IonSegment,
  IonSegmentButton, IonAvatar } from '@ionic/angular/standalone';
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
import { TemaService, ModoTema } from 'src/app/services/tema.service';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

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
  imports: [IonAvatar,
    IonButtons,
    IonMenuToggle,
    IonRange,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonLabel,
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
    IonSegmentButton]
})
export class AparienciaPage implements OnInit, OnDestroy {
  temaActual: string = '';
  modoOscuro: boolean = false;  
  modoPreferido: ModoTema = 'sistema';
  temas: Tema[] = [];
  percentage: number = 100;
  usuario: User | null = null;
  
  private temaSubscription: Subscription = new Subscription;
  private modoOscuroSubscription: Subscription = new Subscription;
  private preferenciaModoBrilloSubscription: Subscription = new Subscription;

  private userSubscription: Subscription | null = null;

  constructor(private temaService: TemaService, private authService: AuthService) {
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
    // Cargar el tamaño de fuente guardado
    this.cargarTamanoFuenteGuardado();
    
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.usuario = user;
      }
    });

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

  /**
   * Carga el tamaño de fuente guardado desde localStorage
   */
  private cargarTamanoFuenteGuardado() {
    const tamanoGuardado = localStorage.getItem('font-size');
    if (tamanoGuardado) {
      this.percentage = parseInt(tamanoGuardado, 10);
      // Aplicar el tamaño de fuente guardado
      document.documentElement.style.fontSize = `${this.percentage}%`;
    } else {
      // Si no hay valor guardado, usar el predeterminado
      this.percentage = 100;
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

  /**
   * Actualiza el tamaño de fuente y lo guarda en localStorage
   */
  updateFontSize(event: CustomEvent) {
    this.percentage = event.detail.value;
    
    // Aplicar el cambio inmediatamente
    document.documentElement.style.fontSize = `${this.percentage}%`;
    
    // Guardar en localStorage
    localStorage.setItem('font-size', this.percentage.toString());
  }

  /**
   * Restaura la configuración predeterminada
   */
  restaurarConfiguracion() {
    // Restaurar tema
    this.temaService.restaurarConfiguracionPredeterminada();
    
    // Restaurar tamaño de fuente
    this.percentage = 100;
    document.documentElement.style.fontSize = '100%';
    localStorage.removeItem('font-size');
  }
}