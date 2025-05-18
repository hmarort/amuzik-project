import {
  Component,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { ListeningRoomService, ListeningRoom } from '../../services/listening-room.service';
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
  push, peopleOutline, personOutline, personAddOutline, exitOutline, syncOutline, logInOutline, paperPlaneOutline, copyOutline } from 'ionicons/icons';
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
  pairwise,
} from 'rxjs/operators';
import { PushNotificationService } from 'src/app/services/push-notifications.service';
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
    IonRange,
    IonProgressBar
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

  currentRoom: ListeningRoom | null = null;
  isHost: boolean = false;
  roomMembers: string[] = [];
  syncStatus: 'synced' | 'syncing' | 'out-of-sync' = 'synced';
  showListeningRoomControls: boolean = false;

  showInviteModal: boolean = false;
  inviteUserId: string = '';
  copySuccess: boolean = false;
  constructor(
    private audiusFacade: AudiusFacade,
    private authService: AuthService,
    private pushNotificationService: PushNotificationService,
    private listeningRoomService: ListeningRoomService
  ) {
    addIcons({peopleOutline,personOutline,personAddOutline,exitOutline,syncOutline,logInOutline,chevronDownOutline,musicalNotesOutline,closeOutline,playOutline,searchOutline,paperPlaneOutline,copyOutline,playSkipBackOutline,playSkipForwardOutline,personCircleOutline,stopOutline,pauseOutline,menuOutline,});
  }

  ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
    if (this.currentUser) {
      this.pushNotificationService.initialize(this.currentUser.username);
    }
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
            const rawPlaylists = results.playlists.data.map(
              (playlist: Playlist) => ({
                ...playlist,
                expanded: false,
                isLoading: false,
              })
            );

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

    this.listeningRoomService.currentRoom$
      .pipe(takeUntil(this.destroy$))
      .subscribe(room => {
        this.currentRoom = room;
        this.showListeningRoomControls = !!room;
      });

    // Suscribirse al rol de host
    this.listeningRoomService.isHost$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isHost => {
        this.isHost = isHost;
      });

    // Suscribirse a la lista de miembros
    this.listeningRoomService.members$
      .pipe(takeUntil(this.destroy$))
      .subscribe(members => {
        this.roomMembers = members;
      });

    // Suscribirse al estado de sincronización
    this.listeningRoomService.syncStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.syncStatus = status;
      });

  }

  // Métodos para controlar las salas de escucha
  createListeningRoom(trackId: string) {
    if (!trackId) {
      console.error('No se puede crear sala: trackId no válido');
      return;
    }
    this.listeningRoomService.createRoom(trackId);
  }

  joinListeningRoom(roomId: string) {
    if (!roomId) {
      console.error('No se puede unir a la sala: roomId no válido');
      return;
    }
    this.listeningRoomService.joinRoom(roomId);
  }

  leaveListeningRoom() {
    this.listeningRoomService.leaveRoom();
  }

  inviteToRoom(userId: string) {
    this.listeningRoomService.inviteUser(userId);
  }

  requestSync() {
    this.listeningRoomService.requestSync();
  }

  private validateAllPlaylists(playlists: Playlist[]) {
    const validationTasks = playlists.map((playlist) =>
      this.validatePlaylist(playlist).pipe(catchError(() => of(null)))
    );

    forkJoin(validationTasks)
      .pipe(
        map((results) => results.filter((p) => p !== null) as Playlist[]),
        finalize(() => {
          this.isLoading = false;
          SplashScreen.hide();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((validPlaylists) => {
        this.allPlaylists = validPlaylists;
        this.playlists = this.allPlaylists.slice(0, this.limit);
        this.hasMorePlaylists = this.allPlaylists.length > this.limit;

        if (this.playlists.length > 0) {
          this.togglePlaylistExpansion(this.playlists[0]);
        }
      });
  }

  private validatePlaylist(playlist: Playlist) {
    if (!playlist.id) return of(null);

    return this.audiusFacade.playlistTracks(playlist.id).pipe(
      map((response) => {
        if (
          response?.data &&
          Array.isArray(response.data) &&
          response.data.length > 0
        ) {
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
            track_count: response.data.length,
          };
        }
        // Si no hay tracks, retornamos null para filtrarla
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

  playTrack(track: Track, playlistTracks?: any[]) {
    if (!track?.id) {
      console.error('Error: track es inválido. No se puede reproducir.');
      return;
    }

    const trackId = track.id;

    // Si estamos en una sala de escucha y somos el host, usamos el servicio de sala
    if (this.currentRoom && this.isHost) {
      // Si estamos cambiando la canción en la sala
      if (this.currentRoom.trackId !== trackId) {
        this.listeningRoomService.changeTrack(trackId);
        return;
      }

      // Si solo estamos reproduciendo la canción actual
      this.listeningRoomService.play();
      return;
    }

    // Si no estamos en una sala o no somos el host, usamos la lógica original
    if (playlistTracks && playlistTracks.length) {
      this.audiusFacade.play(trackId, playlistTracks);
    } else if (this.currentPlaylist) {
      this.audiusFacade.play(trackId, this.currentPlaylist);
    } else {
      this.audiusFacade.play(trackId, [track]);
    }
  }

  pauseTrack() {
    // Si estamos en una sala de escucha y somos el host, usamos el servicio de sala
    if (this.currentRoom && this.isHost) {
      this.listeningRoomService.pause();
      return;
    }

    // Si no estamos en una sala o no somos el host, usamos la lógica original
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

  togglePlayer() {
    this.isPlayerExpanded = !this.isPlayerExpanded;
  }

  nextTrack() {
    this.audiusFacade.next();
  }

  previousTrack() {
    this.audiusFacade.previous();
  }

  seekTo(position: number) {
    // Si estamos en una sala de escucha y somos el host, usamos el servicio de sala
    if (this.currentRoom && this.isHost) {
      this.listeningRoomService.seekTo(position);
      return;
    }

    // Si no estamos en una sala o no somos el host, usamos la lógica original
    this.audiusFacade.seekTo(position);
  }

  onSeek(event: Event) {
    const rangeEvent = event as RangeCustomEvent;
    const position = rangeEvent.detail.value as number;
    this.seekTo(position);
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

    // Mejorar los handlers para que usen nuestras nuevas implementaciones
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

  getFormattedTime(time: number): string {
    return this.audiusFacade.formatTime(time);
  }

  getDurationPercentage(): number {
    if (!this.duration) return 0;
    return (this.currentTime / this.duration) * 100;
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
  playPlaylist(playlist: Playlist) {
    if (
      !playlist.playlist_contents ||
      playlist.playlist_contents.length === 0
    ) {
      console.log(
        `Cargando tracks para la playlist ${playlist.id} antes de reproducir`
      );
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
              console.log(`Reproduciendo primer track: ${trackId}`);
              this.audiusFacade.play(trackId, normalizedTracks);
            }
          } else {
            console.warn('No se encontraron tracks en la playlist');
          }
        });
    } else {
      console.log(
        `Playlist ya cargada con ${playlist.playlist_contents.length} tracks`
      );
      // Normalizar los tracks
      const normalizedTracks = playlist.playlist_contents.map((track) => ({
        ...track,
        id: track.track_id || track.id,
      }));

      const firstTrack = normalizedTracks[0];
      const trackId = firstTrack.id;
      if (trackId) {
        console.log(`Reproduciendo primer track: ${trackId}`);
        this.audiusFacade.play(trackId, normalizedTracks);
      }
    }
  }

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

  isCurrentlyPlaying(trackId: string): boolean {
    return this.currentTrack?.id === trackId && this.isPlaying;
  }

  getArtworkUrl(track: any, size: string = '480x480'): string {
    if (track?.artwork && track.artwork[size]) {
      return track.artwork[size];
    }
    return 'assets/default.jpg';
  }

  showInviteDialog() {
    this.showInviteModal = true;
  }

  closeInviteDialog() {
    this.showInviteModal = false;
    this.inviteUserId = '';
    this.copySuccess = false;
  }

  copyRoomId() {
    if (!this.currentRoom) return;

    navigator.clipboard.writeText(this.currentRoom.id).then(
      () => {
        this.copySuccess = true;
        // Mostrar un toast o notificación
        // Se puede implementar con un servicio de Toast o simplemente con un timeout
        setTimeout(() => {
          this.copySuccess = false;
        }, 2000);
      },
      (err) => {
        console.error('No se pudo copiar al portapapeles', err);
      }
    );
  }

  getDisplayName(userId: string): string {
    // Aquí puedes implementar una lógica para mostrar nombres de usuario más amigables
    // Por ejemplo, si tienes una caché de usuarios o un servicio para obtener detalles de usuario

    // Versión simplificada: si el usuario es el actual, mostrar "Tú"
    if (userId === this.currentUser?.id) {
      return 'Tú';
    }

    // Aquí podrías consultar a un servicio para obtener nombres de usuario reales
    // Por ahora, simplemente mostramos un ID corto para mayor legibilidad
    return userId.substring(0, 8) + '...';
  }

  // Método para manejar invitaciones recibidas (puede ser llamado desde un servicio de notificaciones)
  handleRoomInvitation(roomId: string, inviterId: string) {
    // Aquí puedes implementar la lógica para mostrar una notificación al usuario
    // Por ejemplo, usando ion-alert

    // Ejemplo básico (no implementa realmente la alerta)
    console.log(`Invitación recibida para la sala ${roomId} de ${inviterId}`);

    // En una implementación real, mostrarías una alerta y permitirías al usuario
    // aceptar o rechazar la invitación
    /*
    this.alertController.create({
      header: 'Invitación a sala de escucha',
      message: `${this.getDisplayName(inviterId)} te ha invitado a unirte a una sala de escucha.`,
      buttons: [
        {
          text: 'Rechazar',
          role: 'cancel'
        },
        {
          text: 'Aceptar',
          handler: () => {
            this.joinListeningRoom(roomId);
          }
        }
      ]
    }).then(alert => alert.present());
    */
  }

  // Implementación de la notificación cuando un usuario entra o sale de la sala
  private monitorRoomMembersChanges() {
    this.listeningRoomService.members$
      .pipe(
        takeUntil(this.destroy$),
        // Usamos pairwise para comparar el valor anterior con el actual
        pairwise()
      )
      .subscribe(([prevMembers, currentMembers]) => {
        // Encontrar miembros nuevos (los que están en currentMembers pero no en prevMembers)
        const newMembers = currentMembers.filter(id => !prevMembers.includes(id));

        // Encontrar miembros que se fueron (los que están en prevMembers pero no en currentMembers)
        const leftMembers = prevMembers.filter(id => !currentMembers.includes(id));

        // Notificar sobre miembros nuevos
        newMembers.forEach(id => {
          // Mostrar una notificación temporal o toast
          console.log(`${this.getDisplayName(id)} se ha unido a la sala`);

          // Aquí podrías mostrar un toast o una notificación
        });

        // Notificar sobre miembros que se fueron
        leftMembers.forEach(id => {
          console.log(`${this.getDisplayName(id)} ha abandonado la sala`);

          // Aquí podrías mostrar un toast o una notificación
        });
      });
  }
}
