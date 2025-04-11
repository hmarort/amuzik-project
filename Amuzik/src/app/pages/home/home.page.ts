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
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  InfiniteScrollCustomEvent,
  IonSearchbar,
  IonButtons,
  IonMenuButton,
} from '@ionic/angular/standalone';
import { AudiusFacade } from 'src/app/services/facades/audius.facade';
import { addIcons } from 'ionicons';
import {
  playOutline,
  pauseOutline,
  musicalNotesOutline,
  stopOutline,
  chevronDownOutline,
  personCircleOutline,
  closeOutline,
  searchOutline,
} from 'ionicons/icons';
import { SplashScreen } from '@capacitor/splash-screen';
import { Subject, takeUntil, finalize, forkJoin, of, from } from 'rxjs';
import { catchError, map, switchMap, tap, toArray, concatMap, filter } from 'rxjs/operators';
import { menuOutline } from 'ionicons/icons';
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
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSearchbar,
    IonButtons,
    IonMenuButton,
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

  private tracksCache: Map<string, any> = new Map();

  playlistsOffset: number = 0;
  limit: number = 10;
  hasMorePlaylists: boolean = true;
  allPlaylists: Playlist[] = [];

  constructor(private audiusFacade: AudiusFacade) {
    addIcons({
      personCircleOutline,
      chevronDownOutline,
      musicalNotesOutline,
      closeOutline,
      playOutline,
      searchOutline,
      stopOutline,
      pauseOutline,
      menuOutline,
    });
  }

  ngOnInit() {
    SplashScreen.show({
      autoHide: false,
    });

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

        const track = this.findTrackInData(trackId);

        if (track) {
          this.currentTrack = track;
          this.updateMediaSession();
          return;
        }

        this.audiusFacade
          .getTrackById(trackId)
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

    forkJoin({
      tracks: this.audiusFacade.tracks().pipe(
        catchError(() => of({ data: [] }))
      ),
      playlists: this.audiusFacade.playlists().pipe(
        catchError(() => of({ data: [] }))
      )
    })
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        // La pantalla de splash se ocultará después de validar las playlists
      })
    )
    .subscribe({
      next: (results) => {
        // Procesamos los tracks primero
        if (results.tracks?.data) {
          this.trendingTracks = results.tracks.data.slice(0, 10);
          results.tracks.data.forEach((track: any) => {
            this.tracksCache.set(track.id, track);
          });
        }
        
        // Ahora procesamos y validamos las playlists
        if (results.playlists?.data) {
          const rawPlaylists = results.playlists.data.map((playlist: Playlist) => ({
            ...playlist,
            expanded: false,
            isLoading: false,
          }));
          
          // Validamos las playlists (eliminando las inválidas)
          this.validateAllPlaylists(rawPlaylists);
        } else {
          this.isLoading = false;
          SplashScreen.hide();
        }
      },
      error: () => {
        this.isLoading = false;
        SplashScreen.hide();
      },
    });
  }

  private validateAllPlaylists(playlists: Playlist[]) {
    const validationTasks = playlists.map(playlist => 
      this.validatePlaylist(playlist).pipe(
        catchError(() => of(null))
      )
    );
    
    // Usamos forkJoin para procesar todas las validaciones en paralelo
    forkJoin(validationTasks)
      .pipe(
        map(results => results.filter(p => p !== null) as Playlist[]),
        finalize(() => {
          this.isLoading = false;
          SplashScreen.hide();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(validPlaylists => {
        this.allPlaylists = validPlaylists;
        this.playlists = this.allPlaylists.slice(0, this.limit);
        this.hasMorePlaylists = this.allPlaylists.length > this.limit;
        
        // Expandimos la primera playlist si existe
        if (this.playlists.length > 0) {
          this.togglePlaylistExpansion(this.playlists[0]);
        }
      });
  }
  
  private validatePlaylist(playlist: Playlist) {
    if (!playlist.id) return of(null);
    
    return this.audiusFacade.playlistTracks(playlist.id).pipe(
      map(response => {
        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
          // Guardamos los tracks en caché
          response.data.forEach((track: any) => {
            if (track.id) {
              this.tracksCache.set(track.id, track);
            }
          });
          
          // Devolvemos la playlist con sus tracks
          return {
            ...playlist,
            playlist_contents: response.data,
            track_count: response.data.length
          };
        }
        // Si no hay tracks, retornamos null para filtrarla
        return null;
      }),
      catchError(error => {
        console.log(`Playlist ${playlist.id} - ${playlist.playlist_name} ignorada por error:`, error);
        return of(null);
      })
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private findTrackInData(trackId: string): Track | null {
    if (this.tracksCache.has(trackId)) {
      const cachedTrack = this.tracksCache.get(trackId);
      return {
        id: cachedTrack.id,
        title: cachedTrack.title,
        user: { name: cachedTrack.user?.name || 'Artista Desconocido' },
        artwork: cachedTrack.artwork,
      };
    }

    const trendingTrack = this.trendingTracks.find((t) => t.id === trackId);
    if (trendingTrack) return trendingTrack;

    for (const playlist of this.playlists) {
      if (!playlist.playlist_contents) continue;

      const playlistTrack = playlist.playlist_contents.find(
        (item: any) =>
          (item.track_id === trackId || item.id === trackId) &&
          (item.title || item.id)
      );

      if (playlistTrack) {
        const track = {
          id: playlistTrack.track_id || playlistTrack.id,
          title:
            playlistTrack.title ||
            `Track ${playlistTrack.track_id || playlistTrack.id}`,
          user: { name: playlistTrack.user?.name || 'Artista Desconocido' },
          artwork: playlistTrack.artwork || playlist.artwork,
        };
        this.tracksCache.set(trackId, track);
        return track;
      }
    }

    return null;
  }

  togglePlaylistExpansion(playlist: Playlist) {
    if (playlist.expanded) {
      playlist.expanded = false;
      return;
    }
    
    // Si ya tenemos los tracks cargados, solo expandimos la playlist
    if (playlist.playlist_contents?.length > 0) {
      playlist.expanded = true;
      return;
    }
    
    playlist.isLoading = true;
    
    this.loadPlaylistTracksEfficiently(playlist, true)
      .pipe(
        finalize(() => {
          playlist.isLoading = false;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(tracks => {
        playlist.expanded = tracks && tracks.length > 0;
      });
  }
  
  private loadPlaylistTracksEfficiently(playlist: Playlist, forceReload: boolean = false) {
    if (!playlist.id) return of(null);
    
    if (!forceReload && playlist.playlist_contents?.length && !playlist.isLoading) {
      return of(playlist.playlist_contents);
    }
    
    console.log('Cargando tracks de la playlist:', playlist.id);
    
    return this.audiusFacade.playlistTracks(playlist.id).pipe(
      map(response => {
        if (response?.data) {
          playlist.playlist_contents = response.data;
          playlist.track_count = response.data.length;
          
          response.data.forEach((track: any) => {
            if (track.id) {
              this.tracksCache.set(track.id, track);
            }
          });
          
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error al cargar los tracks:', error);
        return of([]);
      })
    );
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

    this.playlistsOffset += this.limit;

    setTimeout(() => {
      const newPlaylists = this.allPlaylists.slice(
        this.playlistsOffset,
        this.playlistsOffset + this.limit
      );

      if (newPlaylists.length) {
        this.playlists = [...this.playlists, ...newPlaylists];

        this.hasMorePlaylists =
          this.playlistsOffset + this.limit < this.allPlaylists.length;
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

    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.audiusFacade
        .search(query)
        .pipe(
          finalize(() => {
            this.isSearching = false;
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((response) => {
          if (response?.data) {
            this.searchResults = response.data.map((track: any) => {
              if (track.id) {
                this.tracksCache.set(track.id, track);
              }

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
      const playlistInState = this.allPlaylists.find((p) => p.id === item.id);

      if (playlistInState?.playlist_contents?.length) {
        const firstTrack = playlistInState.playlist_contents[0];
        const trackId = firstTrack.track_id || firstTrack.id;
        if (trackId) {
          this.audiusFacade.play(trackId);
        }
        return;
      }

      this.audiusFacade
        .getPlaylistById(item.id)
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