import {
  Component,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
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
  IonInfiniteScrollContent,
  InfiniteScrollCustomEvent,
  IonSearchbar,
} from '@ionic/angular/standalone';
import { AudiusFacade } from 'src/app/services/facades/audius.facade';
import { addIcons } from 'ionicons';
import {
  playOutline,
  pauseOutline,
  musicalNotesOutline,
  stopOutline,
  chevronDownOutline,
  personCircleOutline, closeOutline, searchOutline } from 'ionicons/icons';
import { SplashScreen } from '@capacitor/splash-screen';
import { Subject, takeUntil, finalize, forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
    IonInfiniteScrollContent,
    IonSearchbar,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  private destroy$ = new Subject<void>();
  searchTerm: string = '';
  searchResults: any[] = [];
  isSearching: boolean = false;
  showSearchResults: boolean = false;
  trendingTracks: Track[] = [];
  playlists: Playlist[] = [];
  currentTrack: Track | null = null;
  isPlaying: boolean = false;
  isLoading: boolean = true;
  private _searchTimeout: any;

  // Caché para tracks
  private tracksCache: Map<string, any> = new Map();

  // Parámetros para paginación
  playlistsOffset: number = 0;
  limit: number = 10;
  hasMorePlaylists: boolean = true;
  allPlaylists: Playlist[] = []; // Almacenamos todas las playlists para simular paginación local

  constructor(private audiusFacade: AudiusFacade) {
    addIcons({personCircleOutline,chevronDownOutline,musicalNotesOutline,closeOutline,playOutline,searchOutline,stopOutline,pauseOutline,});
  }

  ngOnInit() {
    SplashScreen.show({
      autoHide: false,
    });

    // Suscribirse a cambios en el estado de reproducción
    this.audiusFacade
      .isPlaying()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isPlaying) => {
        this.isPlaying = isPlaying;
      });

    this.audiusFacade
      .getCurrentTrackId()
      .pipe(takeUntil(this.destroy$))
      .subscribe((trackId) => {
        if (!trackId) {
          this.currentTrack = null;
          return;
        }
        
        // Intentar encontrar el track en los ya cargados
        const track = this.findTrackInData(trackId);

        if (track) {
          this.currentTrack = track;
          this.updateMediaSession();
          return;
        }
        
        // Si no lo encontramos, cargar desde la API
        this.audiusFacade.getTrackById(trackId)
          .pipe(
            catchError(() => of(null)),
            takeUntil(this.destroy$)
          )
          .subscribe((response) => {
            if (response?.data) {
              const trackData = response.data;
              
              this.tracksCache.set(trackId, trackData);
              
              this.currentTrack = {
                id: trackData.id,
                title: trackData.title,
                user: {
                  name: trackData.user?.name || 'Artista Desconocido',
                },
                artwork: trackData.artwork,
              };
              
              this.updateMediaSession();
            }
          });
      });

    // Cargar datos iniciales en paralelo para mejorar rendimiento
    forkJoin({
      tracks: this.audiusFacade.tracks(),
      playlists: this.audiusFacade.playlists()
    })
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        SplashScreen.hide();
      })
    )
    .subscribe({
      next: (results) => {
        // Procesar tracks
        if (results.tracks?.data) {
          this.trendingTracks = results.tracks.data.slice(0, 10);
          results.tracks.data.forEach((track: any) => {
            this.tracksCache.set(track.id, track);
          });
        }
        
        // Procesar playlists
        if (results.playlists?.data) {
          this.allPlaylists = results.playlists.data.map((playlist: Playlist) => ({
            ...playlist,
            expanded: false,
            isLoading: false,
          }));
          
          // Aplicar paginación local inicial
          this.playlists = this.allPlaylists.slice(0, this.limit);
          this.hasMorePlaylists = this.allPlaylists.length > this.limit;
          if (this.playlists.length > 0) {
            this.togglePlaylistExpansion(this.playlists[0]);
          }
        }
      },
      error: () => {
        this.isLoading = false;
        SplashScreen.hide();
      }
    });
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private findTrackInData(trackId: string): Track | null {
    // Primero verificar en la caché para optimizar búsqueda
    if (this.tracksCache.has(trackId)) {
      const cachedTrack = this.tracksCache.get(trackId);
      return {
        id: cachedTrack.id,
        title: cachedTrack.title,
        user: { name: cachedTrack.user?.name || 'Artista Desconocido' },
        artwork: cachedTrack.artwork,
      };
    }

    // Buscar en trending tracks
    const trendingTrack = this.trendingTracks.find((t) => t.id === trackId);
    if (trendingTrack) return trendingTrack;


    for (const playlist of this.playlists) {
      if (!playlist.playlist_contents) continue;
      
      const playlistTrack = playlist.playlist_contents.find((item: any) => 
        (item.track_id === trackId || item.id === trackId) && (item.title || item.id)
      );
      
      if (playlistTrack) {
        const track = {
          id: playlistTrack.track_id || playlistTrack.id,
          title: playlistTrack.title || `Track ${playlistTrack.track_id || playlistTrack.id}`,
          user: { name: playlistTrack.user?.name || 'Artista Desconocido' },
          artwork: playlistTrack.artwork || playlist.artwork,
        };
        
        // Guardar en caché para futuras búsquedas rápidas
        this.tracksCache.set(trackId, track);
        return track;
      }
    }

    return null;
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

      this.audiusFacade.getPlaylistById(playlist.id)
        .pipe(
          finalize(() => {
            playlist.isLoading = false;
          }),
          catchError(() => {
            playlist.expanded = false;
            return of(null);
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((response) => {
          if (response?.data) {
            playlist.playlist_contents = response.data.playlist_contents || [];
            playlist.track_count = response.data.track_count || playlist.playlist_contents.length;
            
            if (playlist.id) {
              this.loadPlaylistTracksEfficiently(playlist);
            }
          }
        });
    }
  }

  private loadPlaylistTracksEfficiently(playlist: Playlist) {
    if (!playlist.id) return;  // Verificar que tenemos un ID de playlist válido
  
    // Si ya tenemos los tracks en caché, no hacer la petición
    if (playlist.playlist_contents?.length && !playlist.isLoading) {
      return;
    }
  
    // Marcar que estamos cargando los tracks de la playlist
    playlist.isLoading = true;
  
    // Obtener todos los tracks de la playlist utilizando getPlaylistTracks
    this.audiusFacade.playlistTracks(playlist.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          playlist.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (response?.data) {
            playlist.playlist_contents = response.data;
            playlist.track_count = response.data.length;
  
            // Actualizar la caché de los tracks
            response.data.forEach((track: any) => {
              this.tracksCache.set(track.id, track);
            });
          }
        },
        error: () => {
          playlist.isLoading = false;
        }
      });
  }  

  playTrack(track: Track) {
    if (!track?.id) {
      console.error('Error: track es inválido. No se puede reproducir.');
      return;
    }

    this.audiusFacade.play(track.id);
  }

  pauseTrack() {
    this.audiusFacade.pause();
  }

  stopTrack() {
    this.audiusFacade.stop();
  }

  togglePlayPause(track: Track) {
    if (this.currentTrack?.id === track.id) {
      this.isPlaying ? this.pauseTrack() : this.audiusFacade.play(track.id);
    } else {
      this.playTrack(track);
    }
  }

  updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.currentTrack) return;
    
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

  loadMore(event: any) {
    if (!this.hasMorePlaylists) {
      (event as InfiniteScrollCustomEvent).target.complete();
      (event as InfiniteScrollCustomEvent).target.disabled = true;
      return;
    }

    // Incrementamos el offset para la siguiente carga
    this.playlistsOffset += this.limit;
    
    setTimeout(() => {
      // Simulamos paginación local para mejorar rendimiento
      const newPlaylists = this.allPlaylists.slice(
        this.playlistsOffset,
        this.playlistsOffset + this.limit
      );
      
      if (newPlaylists.length) {
        this.playlists = [...this.playlists, ...newPlaylists];
        
        // Revisar si hay más playlists disponibles
        this.hasMorePlaylists = this.playlistsOffset + this.limit < this.allPlaylists.length;
      } else {
        this.hasMorePlaylists = false;
      }
      
      (event as InfiniteScrollCustomEvent).target.complete();
      
      if (!this.hasMorePlaylists) {
        (event as InfiniteScrollCustomEvent).target.disabled = true;
      }
    }, 300);
  }

  searchMusic(event: any) {
    const query = event.target.value.trim();
    this.searchTerm = query;

    if (!query || query.length < 1) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    this.isSearching = true;
    this.showSearchResults = true;

    // Agregamos un debounce básico para evitar múltiples peticiones
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.audiusFacade.search(query)
        .pipe(
          finalize(() => {
            this.isSearching = false;
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((response) => {
          if (response?.data) {
            // Procesar resultados y guardar en caché
            this.searchResults = response.data.map((track: any) => {
              // Guardar en caché para futuras búsquedas
              this.tracksCache.set(track.id, track);
              
              return {
                type: 'track',
                id: track.id,
                title: track.title,
                user: track.user,
                artwork: track.artwork,
                playCount: track.play_count,
                duration: track.duration,
              };
            });
          } else {
            this.searchResults = [];
          }
        });
    }, 300);
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  playSearchResult(item: any) {
    if (item.type === 'track') {
      this.playTrack({
        id: item.id,
        title: item.title,
        user: item.user,
        artwork: item.artwork,
      });
    } else if (item.type === 'playlist') {
      // Optimización: Verificar si ya tenemos la playlist en cache
      const playlistInState = this.allPlaylists.find(p => p.id === item.id);
      
      if (playlistInState?.playlist_contents?.length) {
        // Usar la playlist ya cargada
        const firstTrack = playlistInState.playlist_contents[0];
        const trackId = firstTrack.track_id || firstTrack.id;
        if (trackId) {
          this.audiusFacade.play(trackId);
        }
        return;
      }
      
      // Si no está cargada, hacer la petición
      this.audiusFacade.getPlaylistById(item.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe((response) => {
          const contents = response?.data?.playlist_contents;
          if (contents?.length) {
            const firstTrackId = contents[0].track_id;
            if (firstTrackId) {
              this.audiusFacade.play(firstTrackId);
            }
          }
        });
    }
  }
}