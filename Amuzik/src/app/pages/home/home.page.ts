import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
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
  IonCardHeader, 
  IonCardContent,
  IonList,
  IonLabel,
  IonFooter,
  IonButtons,
  IonSkeletonText,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  InfiniteScrollCustomEvent
} from '@ionic/angular/standalone';
import { AudiusFacade } from 'src/app/services/facades/audius.facade';
import { addIcons } from 'ionicons';
import { playOutline, pauseOutline, musicalNotesOutline, stopOutline, chevronDownOutline } from 'ionicons/icons';
import { SplashScreen } from '@capacitor/splash-screen';

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
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar,
    IonItem, 
    IonButton, 
    IonThumbnail, 
    IonIcon, 
    IonCard, 
    IonCardHeader, 
    IonCardContent,
    IonList,
    IonLabel,
    IonFooter,
    IonButtons,
    IonSkeletonText,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  
  trendingTracks: Track[] = [];
  playlists: Playlist[] = [];
  currentTrack: Track | null = null;
  isPlaying: boolean = false;
  isLoading: boolean = true;
  
  // Parámetros para paginación
  playlistsOffset: number = 0;
  tracksOffset: number = 0;
  limit: number = 10;

  constructor(private audiusFacade: AudiusFacade) {
    addIcons({
      playOutline, 
      pauseOutline, 
      musicalNotesOutline, 
      stopOutline,
      chevronDownOutline
    });
  }

  ngOnInit() {
    SplashScreen.show({
      autoHide: false,
    });
  
    // Cargar tracks iniciales
    this.loadInitialTracks();
    
    // Cargar playlists iniciales
    this.loadInitialPlaylists();
  }
  
  loadInitialTracks() {
    this.audiusFacade.tracks().subscribe((response) => {
      if (response && response.data) {
        // Tomar solo los primeros 10 para el carrusel
        this.trendingTracks = response.data.slice(0, 10);
        console.log('Trending tracks cargados:', this.trendingTracks.length);
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
            expanded: false
          };
        });
        console.log('Playlists cargadas:', this.playlists.length);
        
        // Cargamos los tracks de la primera playlist por defecto
        if (this.playlists.length > 0) {
          this.togglePlaylistExpansion(this.playlists[0]);
        }
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
      this.audiusFacade.getPlaylistById(playlist.id).subscribe((response) => {
        if (response && response.data) {
          const updatedPlaylist = this.playlists.find(p => p.id === playlist.id);
          if (updatedPlaylist) {
            updatedPlaylist.playlist_contents = response.data.playlist_contents;
            console.log(`Tracks de playlist ${playlist.playlist_name} cargados:`, updatedPlaylist.playlist_contents.length);
            
            // Obtenemos información detallada de los tracks si es necesario
            updatedPlaylist.playlist_contents.forEach((item: any) => {
              if (!item.title && item.track_id) {
                this.audiusFacade.getTrackById(item.track_id).subscribe((trackData) => {
                  if (trackData && trackData.data) {
                    Object.assign(item, trackData.data);
                  }
                });
              }
            });
          }
        }
      });
    }
  }

  playTrack(track: Track) {
    if (!track || !track.id) {
      console.error('Error: track es inválido. No se puede reproducir.');
      return;
    }
    
    this.currentTrack = track;
    this.isPlaying = true;
    
    // Usar el servicio de facade para reproducir
    this.audiusFacade.play(track.id);
    this.updateMediaSession();
  }

  pauseTrack() {
    this.isPlaying = false;
    this.audiusFacade.pause();
  }

  stopTrack() {
    this.isPlaying = false;
    this.audiusFacade.stop();
    this.currentTrack = null;
  }

  togglePlayPause(track: Track) {
    if (this.currentTrack && this.currentTrack.id === track.id && this.isPlaying) {
      this.pauseTrack();
    } else {
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
        this.playTrack(this.currentTrack!);
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
    // Incrementamos el offset para la siguiente carga
    this.playlistsOffset += this.limit;
    
    // Simulamos una carga (esto deberás adaptarlo para que realmente cargue más contenido de la API)
    setTimeout(() => {
      this.audiusFacade.playlists().subscribe((response) => {
        if (response && response.data && response.data.length > 0) {
          // Aquí deberás implementar la lógica para cargar más playlists con paginación
          // Como la API no tiene paginación directa, esto es solo un ejemplo
          const newPlaylists = response.data.slice(this.playlistsOffset, this.playlistsOffset + this.limit);
          
          if (newPlaylists.length > 0) {
            this.playlists = [
              ...this.playlists, 
              ...newPlaylists.map((playlist: Playlist) => ({...playlist, expanded: false}))
            ];
            (event as InfiniteScrollCustomEvent).target.complete();
          } else {
            // No hay más playlists para cargar
            (event as InfiniteScrollCustomEvent).target.disabled = true;
          }
        } else {
          // No hay datos o hay un error
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