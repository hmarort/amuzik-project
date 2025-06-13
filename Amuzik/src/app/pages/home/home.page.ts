import {
  Component,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
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
  IonRange,
  RangeCustomEvent,
  IonProgressBar,
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
  playSkipForwardOutline,
  playSkipBackOutline,
  menuOutline,
  volumeHighOutline,
  push,
  exitOutline,
  personAddOutline,
  checkmarkOutline,
  peopleOutline,
} from 'ionicons/icons';
import { SplashScreen } from '@capacitor/splash-screen';
import { Subject, takeUntil, finalize, forkJoin, of, from } from 'rxjs';
import {
  catchError,
  map,
  switchMap,
  tap,
  toArray,
  concatMap,
  filter,
} from 'rxjs/operators';
import { PushNotificationService } from 'src/app/services/push-notifications.service';
import {
  ListeningRoomService,
  ListeningRoom,
  RoomEvent,
} from '../../services/listening-room.service';
import { UserFacade } from 'src/app/services/facades/users.facade';
import { Capacitor } from '@capacitor/core';

/**
 * Interfaz para representar un track.
 */
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

/**
 * Interfaz para representar una playlist.
 */
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
    IonRange,
    IonProgressBar,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  @ViewChild('trackSeeker') trackSeeker?: ElementRef<HTMLIonRangeElement>;

  currentUser: User | null = null;
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

  currentTime: number = 0;
  duration: number = 0;
  currentPlaylist: any[] | null = null;
  currentTrackIndex: number = -1;
  isPlayerExpanded: boolean = false;

  private tracksCache: Map<string, any> = new Map();

  playlistsOffset: number = 0;
  limit: number = 10;
  hasMorePlaylists: boolean = true;
  allPlaylists: Playlist[] = [];

  showInviteModal = false;
  userSearchTerm = '';
  filteredUsers: User[] = [];
  isSearchingUsers = false;
  selectedUsers: User[] = [];

  isNativePlatform = Capacitor.isNativePlatform();

  // Variables estáticas para controlar la carga única
  private static dataLoaded = false;
  private static staticTrendingTracks: Track[] = [];
  private static staticAllPlaylists: Playlist[] = [];
  private static staticTracksCache: Map<string, any> = new Map();
  private static isInitializing = false;

  /**
   * Constructor de la clase
   * @param audiusFacade 
   * @param authService 
   * @param pushNotificationService 
   * @param listeningRoomService 
   * @param userFacade 
   */
  constructor(
    private audiusFacade: AudiusFacade,
    private authService: AuthService,
    private pushNotificationService: PushNotificationService,
    protected listeningRoomService: ListeningRoomService,
    private userFacade: UserFacade
  ) {
    addIcons({
      exitOutline,
      personAddOutline,
      checkmarkOutline,
      closeOutline,
      peopleOutline,
      chevronDownOutline,
      musicalNotesOutline,
      playOutline,
      searchOutline,
      playSkipBackOutline,
      playSkipForwardOutline,
      personCircleOutline,
      stopOutline,
      pauseOutline,
      menuOutline,
    });
  }

  /**
   * Inicializa el componente y suscripciones necesarias.
   */
  ngOnInit() {
    this.initializeBasicSubscriptions();
    this.initializeListeningRoomSubscriptions();
    this.loadInitialData();
  }

  /**
   * Inicializa las suscripciones básicas que siempre deben ejecutarse.
   */
  private initializeBasicSubscriptions() {
    // Suscripciones básicas que siempre deben ejecutarse
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
      });

    if (this.currentUser) {
      this.pushNotificationService.initialize(this.currentUser.username);
    }

    this.audiusFacade
      .isPlaying()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isPlaying) => {
        this.isPlaying = isPlaying;
      });

    this.audiusFacade
      .getCurrentTime()
      .pipe(takeUntil(this.destroy$))
      .subscribe((time) => {
        this.currentTime = time;
      });

    this.audiusFacade
      .getDuration()
      .pipe(takeUntil(this.destroy$))
      .subscribe((duration) => {
        this.duration = duration;
      });

    this.audiusFacade
      .getCurrentPlaylist()
      .pipe(takeUntil(this.destroy$))
      .subscribe((playlist) => {
        this.currentPlaylist = playlist;
      });

    this.audiusFacade
      .getCurrentTrackIndex()
      .pipe(takeUntil(this.destroy$))
      .subscribe((index) => {
        this.currentTrackIndex = index;
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
              HomePage.staticTracksCache.set(trackId, trackData);

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
  }

  /**
   * Inicializa las suscripciones para la sala de escucha.
   */
  private initializeListeningRoomSubscriptions() {
    if (!this.isNativePlatform) {
      this.listeningRoomService.currentRoom$
        .pipe(takeUntil(this.destroy$))
        .subscribe((room) => {
          console.log('Current listening room updated:', room);
        });

      this.listeningRoomService.roomEvent$
        .pipe(takeUntil(this.destroy$))
        .subscribe((event) => {
          console.log('Room event received:', event);
          switch (event.type) {
            case 'joined':
              break;
            case 'member_joined':
              break;
          }
        });

      this.listeningRoomService.pendingInvitations$
        .pipe(takeUntil(this.destroy$))
        .subscribe((invitations) => {
          console.log('Pending invitations updated:', invitations);
        });
    } else {
      console.log('Esto es is native: ', this.isNativePlatform);
    }
  }

  /**
   * Carga los datos iniciales de la página.
   * @returns 
   */
  private loadInitialData() {
    // Si los datos ya están cargados, usarlos directamente
    if (HomePage.dataLoaded) {
      this.useStaticData();
      return;
    }

    // Si ya se está inicializando en otra instancia, esperar
    if (HomePage.isInitializing) {
      this.waitForInitialization();
      return;
    }

    // Marcar como iniciando y cargar datos
    HomePage.isInitializing = true;
    this.loadDataFromAPI();
  }

  /**
   * Usa los datos estáticos ya cargados para evitar múltiples llamadas a la API.
   */
  private useStaticData() {
    console.log('Usando datos estáticos ya cargados');

    // Copiar datos estáticos a la instancia actual
    this.trendingTracks = [...HomePage.staticTrendingTracks];
    this.allPlaylists = [...HomePage.staticAllPlaylists];
    this.tracksCache = new Map(HomePage.staticTracksCache);

    // Configurar las playlists para mostrar
    this.playlists = this.allPlaylists.slice(0, this.limit);
    this.hasMorePlaylists = this.allPlaylists.length > this.limit;

    // Expandir la primera playlist si existe
    if (this.playlists.length > 0) {
      this.togglePlaylistExpansion(this.playlists[0]);
    }

    this.isLoading = false;
    SplashScreen.hide();
  }

  /**
   * Espera a que la inicialización de datos esté completa.
   */
  private waitForInitialization() {
    console.log('Esperando inicialización de datos...');

    // Verificar cada 100ms si la inicialización ha terminado
    const checkInterval = setInterval(() => {
      if (HomePage.dataLoaded) {
        clearInterval(checkInterval);
        this.useStaticData();
      }
    }, 100);

    // Timeout de seguridad (10 segundos)
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!HomePage.dataLoaded) {
        console.warn(
          'Timeout esperando inicialización, cargando datos nuevamente'
        );
        HomePage.isInitializing = false;
        this.loadDataFromAPI();
      }
    }, 10000);
  }

  /**
   * Carga los datos desde la API de Audius.
   */
  private loadDataFromAPI() {
    console.log('Cargando datos desde la API...');

    // Mostrar splash screen solo en la primera carga
    SplashScreen.show({
      autoHide: false,
    });

    forkJoin({
      tracks: this.audiusFacade
        .tracks()
        .pipe(catchError(() => of({ data: [] }))),
      playlists: this.audiusFacade
        .playlists()
        .pipe(catchError(() => of({ data: [] }))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          HomePage.isInitializing = false;
        })
      )
      .subscribe({
        next: (results) => {
          if (results.tracks?.data) {
            const tracks = results.tracks.data.slice(0, 10);
            this.trendingTracks = tracks;
            HomePage.staticTrendingTracks = [...tracks];

            results.tracks.data.forEach((track: any) => {
              this.tracksCache.set(track.id, track);
              HomePage.staticTracksCache.set(track.id, track);
            });
          }

          if (results.playlists?.data) {
            const rawPlaylists = results.playlists.data.map(
              (playlist: Playlist) => ({
                ...playlist,
                expanded: false,
                isLoading: false,
              })
            );

            this.validateAllPlaylists(rawPlaylists);
          } else {
            this.isLoading = false;
            HomePage.dataLoaded = true;
            SplashScreen.hide();
          }
        },
        error: () => {
          this.isLoading = false;
          HomePage.dataLoaded = true;
          HomePage.isInitializing = false;
          SplashScreen.hide();
        },
      });
  }

  /**
   * Valida todas las playlists y carga sus tracks.
   * @param playlists 
   */
  private validateAllPlaylists(playlists: Playlist[]) {
    const validationTasks = playlists.map((playlist) =>
      this.validatePlaylist(playlist).pipe(catchError(() => of(null)))
    );

    forkJoin(validationTasks)
      .pipe(
        map((results) => results.filter((p) => p !== null) as Playlist[]),
        finalize(() => {
          this.isLoading = false;
          HomePage.dataLoaded = true;
          SplashScreen.hide();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((validPlaylists) => {
        this.allPlaylists = validPlaylists;
        HomePage.staticAllPlaylists = [...validPlaylists];

        this.playlists = this.allPlaylists.slice(0, this.limit);
        this.hasMorePlaylists = this.allPlaylists.length > this.limit;

        if (this.playlists.length > 0) {
          this.togglePlaylistExpansion(this.playlists[0]);
        }
      });
  }

  /**
   * Valida una playlist y carga sus tracks.
   * @param playlist 
   * @returns 
   */
  private validatePlaylist(playlist: Playlist) {
    if (!playlist.id) return of(null);

    return this.audiusFacade.playlistTracks(playlist.id).pipe(
      map((response) => {
        if (
          response?.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
          response.data.forEach((track: any) => {
            if (track.id) {
              this.tracksCache.set(track.id, track);
              HomePage.staticTracksCache.set(track.id, track);
            }
          });

          return {
            ...playlist,
            playlist_contents: response.data,
            track_count: response.data.length,
          };
        }
        return null;
      }),
      catchError((error) => {
        console.log(
          `Playlist ${playlist.id} - ${playlist.playlist_name} ignorada por error:`,
          error
        );
        return of(null);
      })
    );
  }

  /**
   * Limpia las suscripciones y recursos al destruir el componente.
   */
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Limpia los datos estáticos y la caché para permitir una nueva carga de datos.
   */
  static clearStaticData() {
    HomePage.dataLoaded = false;
    HomePage.staticTrendingTracks = [];
    HomePage.staticAllPlaylists = [];
    HomePage.staticTracksCache.clear();
    HomePage.isInitializing = false;
  }

  /**
   * Busca un track en los datos cargados, priorizando la caché local y estática.
   * @param trackId 
   * @returns 
   */
  private findTrackInData(trackId: string): Track | null {
    // Buscar primero en la caché local
    if (this.tracksCache.has(trackId)) {
      const cachedTrack = this.tracksCache.get(trackId);
      return {
        id: cachedTrack.id,
        title: cachedTrack.title,
        user: { name: cachedTrack.user?.name || 'Artista Desconocido' },
        artwork: cachedTrack.artwork,
      };
    }

    // Buscar en la caché estática
    if (HomePage.staticTracksCache.has(trackId)) {
      const cachedTrack = HomePage.staticTracksCache.get(trackId);
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
        HomePage.staticTracksCache.set(trackId, track);
        return track;
      }
    }

    return null;
  }

  /**
   * Alterna la expansión de una playlist.
   * @param playlist 
   * @returns 
   */
  togglePlaylistExpansion(playlist: Playlist) {
    if (playlist.expanded) {
      playlist.expanded = false;
      return;
    }

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
      .subscribe((tracks) => {
        playlist.expanded = tracks && tracks.length > 0;
      });
  }

  /**
   * Carga los tracks de una playlist de manera eficiente.
   * @param playlist 
   * @param forceReload 
   * @returns 
   */
  private loadPlaylistTracksEfficiently(
    playlist: Playlist,
    forceReload: boolean = false
  ) {
    if (!playlist.id) return of(null);

    if (
      !forceReload &&
      playlist.playlist_contents?.length &&
      !playlist.isLoading
    ) {
      return of(playlist.playlist_contents);
    }

    console.log('Cargando tracks de la playlist:', playlist.id);

    return this.audiusFacade.playlistTracks(playlist.id).pipe(
      map((response) => {
        if (response?.data) {
          playlist.playlist_contents = response.data;
          playlist.track_count = response.data.length;

          response.data.forEach((track: any) => {
            if (track.id) {
              this.tracksCache.set(track.id, track);
              HomePage.staticTracksCache.set(track.id, track);
            }
          });

          return response.data;
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error al cargar los tracks:', error);
        return of([]);
      })
    );
  }

  /**
   * Reproduce un track específico y actualiza el estado de la sala de escucha.
   * @param track 
   * @param playlistTracks 
   * @returns 
   */
  playTrack(track: Track, playlistTracks?: any[]) {
    if (!track?.id) {
      console.error('Error: track es inválido. No se puede reproducir.');
      return;
    }

    const trackId = track.id;

    if (playlistTracks && playlistTracks.length) {
      this.audiusFacade.play(trackId, playlistTracks);
    } else if (this.currentPlaylist) {
      this.audiusFacade.play(trackId, this.currentPlaylist);
    } else {
      this.audiusFacade.play(trackId, [track]);
    }
    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.updateRoomTrack(currentRoom.id, trackId);
      this.listeningRoomService.updateRoomState(currentRoom.id, 'playing', 0);
    }
  }

  /**
   * Reproduce un track específico y actualiza el estado de la sala de escucha.
   */
  pauseTrack() {
    this.audiusFacade.pause();

    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.updateRoomState(
        currentRoom.id,
        'paused',
        this.currentTime
      );
    }
  }

  /**
   * Detiene la reproducción del track actual.
   */
  stopTrack() {
    this.audiusFacade.stop();
  }

  /**
   * Alterna entre reproducir y pausar un track.
   * @param track 
   */
  togglePlayPause(track: Track) {
    if (this.currentTrack?.id === track.id) {
      this.isPlaying ? this.pauseTrack() : this.audiusFacade.play(track.id);
    } else {
      this.playTrack(track);
    }
  }

  /**
   * Alterna la expansión del reproductor de música.
   */
  togglePlayer() {
    this.isPlayerExpanded = !this.isPlayerExpanded;
  }

  /**
   * Reproduce el siguiente track en la lista de reproducción actual.
   */
  nextTrack() {
    this.audiusFacade.next();
  }

  /**
   * Reproduce el track anterior en la lista de reproducción actual.
   */
  previousTrack() {
    this.audiusFacade.previous();
  }

  /**
   * Reproduce un track específico y actualiza el estado de la sala de escucha.
   * @param position 
   */
  seekTo(position: number) {
    this.audiusFacade.seekTo(position);

    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.updateRoomState(
        currentRoom.id,
        this.isPlaying ? 'playing' : 'paused',
        position
      );
    }
  }

  /**
   * Maneja el evento de búsqueda de un rango para buscar una posición específica en el track.
   * @param event 
   */
  onSeek(event: Event) {
    const rangeEvent = event as RangeCustomEvent;
    const position = rangeEvent.detail.value as number;
    this.seekTo(position);
  }

  /**
   * Actualiza la sesión de medios del navegador para reflejar el track actual.
   * @returns 
   */
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
      if (this.currentTrack) {
        this.audiusFacade.play(this.currentTrack.id);
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.pauseTrack();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.previousTrack();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.nextTrack();
    });
  }

  /**
   * Formatea el tiempo en un string legible.
   * @param time 
   * @returns 
   */
  getFormattedTime(time: number): string {
    return this.audiusFacade.formatTime(time);
  }

  /**
   * Calcula el porcentaje de duración del track actual.
   * @returns 
   */
  getDurationPercentage(): number {
    if (!this.duration) return 0;
    return (this.currentTime / this.duration) * 100;
  }

  /**
   * Carga más playlists al hacer scroll infinito.
   * @param event 
   * @returns 
   */
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

  /**
   * Maneja la búsqueda de música basada en el término ingresado.
   * @param event 
   * @returns 
   */
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
                HomePage.staticTracksCache.set(track.id, track);
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

  /**
   * Limpia los resultados de búsqueda y el término de búsqueda.
   */
  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  /**
   * Reproduce un resultado de búsqueda específico.
   * @param item 
   * @returns 
   */
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
          this.audiusFacade.play(trackId, playlistInState.playlist_contents);
        }
        return;
      }

      this.audiusFacade
        .getPlaylistById(item.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe((response) => {
          const contents = response?.data?.playlist_contents;
          if (contents?.length) {
            const firstTrackId = contents[0].track_id || contents[0].id;
            if (firstTrackId) {
              this.audiusFacade.play(firstTrackId, contents);
            }
          }
        });
    }
  }

  /**
   * Reproduce una playlist completa.
   * @param playlist 
   */
  playPlaylist(playlist: Playlist) {
    if (
      !playlist.playlist_contents ||
      playlist.playlist_contents.length === 0
    ) {
      this.loadPlaylistTracksEfficiently(playlist)
        .pipe(takeUntil(this.destroy$))
        .subscribe((tracks) => {
          if (tracks && tracks.length > 0) {
            console.log(`Tracks cargados: ${tracks.length}`);
            // Normalizar los tracks
            const normalizedTracks = tracks.map(
              (track: { track_id: any; id: any }) => ({
                ...track,
                id: track.track_id || track.id,
              })
            );

            const firstTrack = normalizedTracks[0];
            const trackId = firstTrack.id;
            if (trackId) {
              this.audiusFacade.play(trackId, normalizedTracks);
            }
          } else {
            console.warn('No se encontraron tracks en la playlist');
          }
        });
    } else {
      // Normalizar los tracks
      const normalizedTracks = playlist.playlist_contents.map((track) => ({
        ...track,
        id: track.track_id || track.id,
      }));

      const firstTrack = normalizedTracks[0];
      const trackId = firstTrack.id;
      if (trackId) {
        this.audiusFacade.play(trackId, normalizedTracks);
      }
    }
  }

  /**
   * Reproduce un track específico de una playlist.
   * @param playlist 
   * @param trackIndex 
   * @returns 
   */
  trackFromPlaylist(playlist: Playlist, trackIndex: number) {
    if (
      !playlist.playlist_contents ||
      trackIndex >= playlist.playlist_contents.length
    ) {
      return;
    }

    const trackItem = playlist.playlist_contents[trackIndex];
    const trackId = trackItem.track_id || trackItem.id;

    if (trackId) {
      this.audiusFacade.play(trackId, playlist.playlist_contents);
    }
  }

  /**
   * Verifica si un track está actualmente reproduciéndose.
   * @param trackId 
   * @returns 
   */
  isCurrentlyPlaying(trackId: string): boolean {
    return this.currentTrack?.id === trackId && this.isPlaying;
  }

  /**
   * Obtiene la URL del artwork de un track.
   * @param track 
   * @param size 
   * @returns 
   */
  getArtworkUrl(track: any, size: string = '480x480'): string {
    if (track?.artwork && track.artwork[size]) {
      return track.artwork[size];
    }
    return 'assets/default.jpg';
  }

  /**
   * Crea una nueva sala de escucha para un track específico.
   * @param trackId 
   * @returns 
   */
  createListeningRoom(trackId: string) {
    if (!trackId) {
      console.error('No se puede crear sala: trackId no válido');
      return;
    }
    this.listeningRoomService.createRoom(trackId);
  }

  /**
   * Se une a una sala de escucha existente.
   * @param roomId 
   */
  joinListeningRoom(roomId: string) {
    this.listeningRoomService.joinRoom(roomId);
  }

  /**
   * Abandona la sala de escucha actual.
   */
  leaveCurrentRoom() {
    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.leaveRoom(currentRoom.id);
    }
  }

  /**
   * Invita a un usuario a la sala de escucha actual.
   * @param userId 
   */
  inviteUserToRoom(userId: string) {
    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.inviteToRoom(currentRoom.id, userId);
    }
  }

  /**
   * Acepta una invitación a una sala de escucha.
   * @param invitation 
   */
  acceptRoomInvitation(invitation: RoomEvent) {
    this.listeningRoomService.acceptInvitation(invitation);
  }

  /**
   * Declina una invitación a una sala de escucha.
   * @param invitation 
   */
  declineRoomInvitation(invitation: RoomEvent) {
    this.listeningRoomService.declineInvitation(invitation);
  }

  /**
   * Abre el diálogo de invitación para seleccionar usuarios.
   */
  inviteUserDialog() {
    this.showInviteModal = true;
    this.loadUsers();
  }

  /**
   * Cierra el diálogo de invitación y limpia los datos.
   */
  closeInviteDialog() {
    this.showInviteModal = false;
    this.userSearchTerm = '';
    this.filteredUsers = [];
    this.selectedUsers = [];
  }

  /**
   * Busca usuarios en la lista de amigos del usuario actual.
   * @param event 
   * @returns 
   */
  searchUsers(event: any) {
    const query = event.target.value.toLowerCase().trim();
    this.userSearchTerm = query;

    if (!query) {
      this.loadUsers();
      return;
    }

    this.isSearchingUsers = true;

    if (this.currentUser && this.currentUser.friends) {
      this.filteredUsers = this.currentUser.friends.filter(
        (friend) =>
          friend.username.toLowerCase().includes(query) ||
          (friend.nombre && friend.nombre.toLowerCase().includes(query)) ||
          (friend.apellidos && friend.apellidos.toLowerCase().includes(query))
      );
      this.isSearchingUsers = false;
    } else {
      this.authService.refreshUserData().subscribe({
        next: (user) => {
          if (user && user.friends) {
            this.filteredUsers = user.friends.filter(
              (friend: {
                username: string;
                nombre: string;
                apellidos: string;
              }) =>
                friend.username.toLowerCase().includes(query) ||
                (friend.nombre &&
                  friend.nombre.toLowerCase().includes(query)) ||
                (friend.apellidos &&
                  friend.apellidos.toLowerCase().includes(query))
            );
          } else {
            this.filteredUsers = [];
          }
          this.isSearchingUsers = false;
        },
        error: (error) => {
          console.error('Error al cargar amigos:', error);
          this.filteredUsers = [];
          this.isSearchingUsers = false;
        },
      });
    }
  }

  /**
   * Carga los usuarios amigos del usuario actual.
   */
  loadUsers() {
    if (
      this.currentUser &&
      this.currentUser.friends &&
      this.currentUser.friends.length > 0
    ) {
      this.filteredUsers = [...this.currentUser.friends];
    } else {
      this.filteredUsers = [];
    }
  }

  /**
   * Selecciona un usuario para invitar a la sala de escucha.
   * @param user 
   */
  selectUserForInvitation(user: User) {
    if (!this.selectedUsers.some((u) => u.id === user.id)) {
      this.selectedUsers.push(user);
    }
  }

  /**
   * Elimina un usuario seleccionado de la lista de invitaciones.
   * @param user 
   */
  removeSelectedUser(user: User) {
    this.selectedUsers = this.selectedUsers.filter((u) => u.id !== user.id);
  }

  /**
   * Envía invitaciones a los usuarios seleccionados en la sala de escucha actual.
   */
  sendInvitations() {
    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (!currentRoom) {
      if (this.currentTrack) {
        this.listeningRoomService.createRoom(this.currentTrack.id);
        setTimeout(() => {
          const newRoom = this.listeningRoomService.getCurrentRoom();
          if (newRoom && newRoom.id) {
            this.inviteSelectedUsers(newRoom.id);
          } else {
            console.error('Error al crear sala de escucha: roomId no válido');
          }
        }, 300);
      } else {
        console.error('No hay track actual para crear una sala de escucha');
      }
    } else {
      this.inviteSelectedUsers(currentRoom.id);
    }
  }

  /**
   * Invita a los usuarios seleccionados a la sala de escucha actual.
   * @param roomId 
   * @returns 
   */
  private inviteSelectedUsers(roomId: string) {
    if (this.selectedUsers.length === 0) {
      return;
    }

    this.selectedUsers.forEach((user) => {
      this.listeningRoomService.inviteToRoom(roomId, user.id);
    });

    this.selectedUsers = [];
    this.closeInviteDialog();
  }

  /**
   * Obtiene la URL del artwork de un track específico.
   * @param trackId 
   * @returns 
   */
  getTrackArtwork(trackId: string): string | null {
    const track = this.findTrackInData(trackId);
    return track?.artwork?.['150x150'] || null;
  }
}
