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

  ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
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

    // Suscripciones para ListeningRoomService
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
          if (results.tracks?.data) {
            this.trendingTracks = results.tracks.data.slice(0, 10);
            results.tracks.data.forEach((track: any) => {
              this.tracksCache.set(track.id, track);
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
          response.data.forEach((track: any) => {
            if (track.id) {
              this.tracksCache.set(track.id, track);
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

  createListeningRoom(trackId: string) {
    if (!trackId) {
      console.error('No se puede crear sala: trackId no válido');
      return;
    }
    this.listeningRoomService.createRoom(trackId);
  }

  joinListeningRoom(roomId: string) {
    this.listeningRoomService.joinRoom(roomId);
  }

  leaveCurrentRoom() {
    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.leaveRoom(currentRoom.id);
    }
  }

  inviteUserToRoom(userId: string) {
    const currentRoom = this.listeningRoomService.getCurrentRoom();
    if (currentRoom) {
      this.listeningRoomService.inviteToRoom(currentRoom.id, userId);
    }
  }

  acceptRoomInvitation(invitation: RoomEvent) {
    this.listeningRoomService.acceptInvitation(invitation);
  }

  declineRoomInvitation(invitation: RoomEvent) {
    this.listeningRoomService.declineInvitation(invitation);
  }

  inviteUserDialog() {
    this.showInviteModal = true;
    this.loadUsers();
  }

  closeInviteDialog() {
    this.showInviteModal = false;
    this.userSearchTerm = '';
    this.filteredUsers = [];
    this.selectedUsers = [];
  }

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

  selectUserForInvitation(user: User) {
    if (!this.selectedUsers.some((u) => u.id === user.id)) {
      this.selectedUsers.push(user);
    }
  }

  removeSelectedUser(user: User) {
    this.selectedUsers = this.selectedUsers.filter((u) => u.id !== user.id);
  }

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

  getTrackArtwork(trackId: string): string | null {
    const track = this.findTrackInData(trackId);
    return track?.artwork?.['150x150'] || null;
  }
}
