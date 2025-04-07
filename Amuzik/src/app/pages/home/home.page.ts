import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonItem, 
  IonButton, 
  IonThumbnail, 
  IonIcon, 
  IonCard, 
  IonList,
  IonLabel,
  IonFooter,
  IonButtons,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  InfiniteScrollCustomEvent
} from '@ionic/angular/standalone';
import { AudiusFacade } from 'src/app/services/facades/audius.facade';
import { addIcons } from 'ionicons';
import { playOutline, pauseOutline, musicalNotesOutline, stopOutline, chevronDownOutline, personCircleOutline } from 'ionicons/icons';
import { SplashScreen } from '@capacitor/splash-screen';
import { Subject, takeUntil } from 'rxjs';

interface Track {
  id: string;
  title: string;
  user: {
    name: string;
  };
  artwork?: {
    [key: string]: string;
  };
}

interface Playlist {
  id: string;
  playlist_name: string;
  playlist_contents: any[];
  user: {
    name: string;
  };
  artwork?: {
    [key: string]: string;
  };
  description?: string;
  track_count?: number;
  expanded?: boolean;
  isLoading?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonItem,
    IonButton,
    IonThumbnail,
    IonIcon,
    IonCard,
    IonList,
    IonLabel,
    IonFooter,
    IonButtons,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent
],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  
  private destroy = new Subject<void>();
  
  trendingTracks: Track[] = [];
  playlists: Playlist[] = [];
  currentTrack: Track | null = null;
  isPlaying: boolean = false;
  isLoading: boolean = true;
  
  // Cache para evitar peticiones duplicadas
  private tracksCache: Map<string, any> = new Map();
  
  // Parámetros para paginación
  playlistsOffset: number = 0;
  tracksOffset: number = 0;
  limit: number = 10;
  hasMorePlaylists: boolean = true;

  constructor(private audiusFacade: AudiusFacade) {
    addIcons({personCircleOutline,chevronDownOutline,musicalNotesOutline,stopOutline,playOutline,pauseOutline});
  }

  ngOnInit() {
    SplashScreen.show({
      autoHide: false,
    });
  
    // Suscribirse a cambios en el estado de reproducción
    this.audiusFacade.isPlaying()
      .pipe(takeUntil(this.destroy))
      .subscribe(isPlaying => {
        this.isPlaying = isPlaying;
      });
      
    this.audiusFacade.getCurrentTrackId()
      .pipe(takeUntil(this.destroy))
      .subscribe(trackId => {
        if (trackId) {
          // Intentar encontrar el track en los ya cargados
          let track = this.findTrackInData(trackId);
          
          if (!track) {
            // Si no lo encontramos, cargar desde la API
            this.audiusFacade.getTrackById(trackId).subscribe(response => {
              if (response && response.data) {
                this.currentTrack = {
                  id: response.data.id,
                  title: response.data.title,
                  user: { name: response.data.user?.name || 'Artista Desconocido' },
                  artwork: response.data.artwork
                };
              }
            });
          } else {
            this.currentTrack = track;
          }
        } else {
          this.currentTrack = null;
        }
      });
    
    // Cargar tracks iniciales
    this.loadInitialTracks();
    
    // Cargar playlists iniciales
    this.loadInitialPlaylists();
  }
  
  ngOnDestroy() {
    this.destroy.next();
    this.destroy.complete();
  }
  
  private findTrackInData(trackId: string): Track | null {
    // Buscar en trending tracks
    const trendingTrack = this.trendingTracks.find(t => t.id === trackId);
    if (trendingTrack) return trendingTrack;
    
    // Buscar en playlists
    for (const playlist of this.playlists) {
      if (playlist.playlist_contents) {
        const track = this.getPlaylistTrackById(playlist, trackId);
        if (track) return track;
      }
    }
    
    // Buscar en cache
    const cachedTrack = this.tracksCache.get(trackId);
    if (cachedTrack) {
      return {
        id: cachedTrack.id,
        title: cachedTrack.title,
        user: { name: cachedTrack.user?.name || 'Artista Desconocido' },
        artwork: cachedTrack.artwork
      };
    }
    
    return null;
  }
  
  loadInitialTracks() {
    this.audiusFacade.tracks().subscribe((response) => {
      if (response && response.data) {
        // Tomar solo los primeros 10 para el carrusel
        this.trendingTracks = response.data.slice(0, 10);
        console.log('Trending tracks cargados:', this.trendingTracks.length);
        
        // Almacenar en cache
        response.data.forEach((track: any) => {
          this.tracksCache.set(track.id, track);
        });
      }
      this.checkDataLoaded();
    });
  }
  
  loadInitialPlaylists() {
    this.audiusFacade.playlists().subscribe((response) => {
      if (response && response.data) {
        this.playlists = response.data.map((playlist: Playlist) => {
          return {
            ...playlist,
            expanded: false,
            isLoading: false
          };
        });
        console.log('Playlists cargadas:', this.playlists.length);
        
        // Cargamos los tracks de la primera playlist por defecto
        if (this.playlists.length > 0) {
          this.togglePlaylistExpansion(this.playlists[0]);
        }
        
        // Determinar si hay más playlists disponibles
        this.hasMorePlaylists = response.data.length >= this.limit;
      }
      this.checkDataLoaded();
    });
  }
  
  checkDataLoaded() {
    if (this.trendingTracks.length > 0 && this.playlists.length > 0) {
      this.isLoading = false;
      SplashScreen.hide();
    }
  }

  togglePlaylistExpansion(playlist: Playlist) {
    // Si ya está expandido, solo cerramos
    if (playlist.expanded) {
      playlist.expanded = false;
      return;
    }
    
    // Si no está expandido y no tiene tracks cargados, los cargamos
    playlist.expanded = true;
    
    if (!playlist.playlist_contents || playlist.playlist_contents.length === 0) {
      playlist.isLoading = true;
      
      this.audiusFacade.getPlaylistById(playlist.id).subscribe((response) => {
        playlist.isLoading = false;
        
        if (response && response.data) {
          playlist.playlist_contents = response.data.playlist_contents || [];
          playlist.track_count = response.data.track_count || playlist.playlist_contents.length;
          console.log(`Tracks de playlist ${playlist.playlist_name} cargados:`, playlist.playlist_contents.length);
          
          // Procesar tracks en lotes para mejorar el rendimiento
          this.processPlaylistTracks(playlist);
        }
      });
    }
  }
  
  // Procesar tracklist en lotes para evitar bloquear UI
  private processPlaylistTracks(playlist: Playlist, batchSize: number = 5) {
    if (!playlist.playlist_contents) return;
    
    const processTracksBatch = (startIndex: number) => {
      const endIndex = Math.min(startIndex + batchSize, playlist.playlist_contents.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const item = playlist.playlist_contents[i];
        
        if (!item.title && item.track_id) {
          // Verificar si ya está en cache
          const cachedTrack = this.tracksCache.get(item.track_id);
          
          if (cachedTrack) {
            // Usar cache
            Object.assign(item, cachedTrack);
          } else {
            // Cargar desde API
            this.audiusFacade.getTrackById(item.track_id).subscribe((trackData) => {
              if (trackData && trackData.data) {
                Object.assign(item, trackData.data);
                // Guardar en cache
                this.tracksCache.set(item.track_id, trackData.data);
              }
            });
          }
        }
      }
      
      // Procesar siguiente lote si quedan tracks
      if (endIndex < playlist.playlist_contents.length) {
        setTimeout(() => processTracksBatch(endIndex), 300);
      }
    };
    
    // Iniciar procesamiento por lotes
    processTracksBatch(0);
  }

  playTrack(track: Track) {
    if (!track || !track.id) {
      console.error('Error: track es inválido. No se puede reproducir.');
      return;
    }
    
    this.audiusFacade.play(track.id);
    this.updateMediaSession();
  }

  pauseTrack() {
    this.audiusFacade.pause();
  }

  stopTrack() {
    this.audiusFacade.stop();
  }

  togglePlayPause(track: Track) {
    if (this.currentTrack && this.currentTrack.id === track.id && this.isPlaying) {
      this.pauseTrack();
    } else if (this.currentTrack && this.currentTrack.id === track.id && !this.isPlaying) {
      // Resume the same track
      this.audiusFacade.play(track.id);
    } else {
      // Play a new track
      this.playTrack(track);
    }
  }

  updateMediaSession() {
    if ('mediaSession' in navigator && this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title || 'Unknown Title',
        artist: this.currentTrack.user?.name || 'Unknown Artist',
        album: 'Audius',
        artwork: [
          {
            src: this.currentTrack.artwork?.['1000x1000'] || 'assets/default.jpg',
            sizes: '1000x1000',
            type: 'image/jpeg',
          },
        ],
      });
      
      navigator.mediaSession.setActionHandler('play', () => {
        this.audiusFacade.play(this.currentTrack!.id);
      });
      
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pauseTrack();
      });
      
      navigator.mediaSession.setActionHandler('stop', () => {
        this.stopTrack();
      });
    }
  }
  
  loadMore(event: any) {
    if (!this.hasMorePlaylists) {
      (event as InfiniteScrollCustomEvent).target.complete();
      (event as InfiniteScrollCustomEvent).target.disabled = true;
      return;
    }
    
    // Incrementamos el offset para la siguiente carga
    this.playlistsOffset += this.limit;
    
    setTimeout(() => {
      this.audiusFacade.playlists().subscribe((response) => {
        if (response && response.data && response.data.length > 0) {
          // Como la API no tiene paginación directa, aplicamos una simulación de paginación
          const newPlaylists = response.data.slice(this.playlistsOffset, this.playlistsOffset + this.limit);
          
          if (newPlaylists.length > 0) {
            const formattedPlaylists = newPlaylists.map((playlist: Playlist) => ({
              ...playlist, 
              expanded: false,
              isLoading: false
            }));
            
            this.playlists = [...this.playlists, ...formattedPlaylists];
            (event as InfiniteScrollCustomEvent).target.complete();
            
            // Determinar si hay más playlists disponibles
            this.hasMorePlaylists = this.playlistsOffset + this.limit < response.data.length;
            if (!this.hasMorePlaylists) {
              (event as InfiniteScrollCustomEvent).target.disabled = true;
            }
          } else {
            // No hay más playlists para cargar
            this.hasMorePlaylists = false;
            (event as InfiniteScrollCustomEvent).target.disabled = true;
          }
        } else {
          // No hay datos o hay un error
          this.hasMorePlaylists = false;
          (event as InfiniteScrollCustomEvent).target.disabled = true;
        }
      });
    }, 500);
  }
  
  getPlaylistTrackById(playlist: Playlist, trackId: string): Track | null {
    if (!playlist.playlist_contents) return null;
    
    const track = playlist.playlist_contents.find((item: any) => {
      return item.track_id === trackId || item.id === trackId;
    });
    
    if (!track) return null;
    
    return {
      id: track.track_id || track.id,
      title: track.title || `Track ${track.track_id || track.id}`,
      user: { name: track.user?.name || 'Artista Desconocido' },
      artwork: track.artwork || playlist.artwork
    };
  }
}