// AudiusFacade.ts
import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

/**
 * Interfaz para el estado de reproducción de música.
 */
export interface PlaybackState {
  trackId: string | null;
  isPlaying: boolean;
  position: number;
}

/**
 * Interfaz para los eventos de música.
 */
export interface MusicEvent {
  eventType: 'play' | 'pause' | 'seek';
  trackId: string | null;
  position: number;
  timestamp: number;
  metadata?: TrackMetadata;
}

/**
 * Interfaz para los metadatos de una pista.
 */
export interface TrackMetadata {
  title: string;
  artist: string;
  artworkUrl: string;
  duration: number;
}

@Injectable({
  providedIn: 'root',
})
export class AudiusFacade {
  private musicEventSubject = new Subject<MusicEvent>();
  public musicEvent$ = this.musicEventSubject.asObservable();

  private playbackStateSubject = new BehaviorSubject<PlaybackState>({
    trackId: null,
    isPlaying: false,
    position: 0,
  });
  public playbackState$ = this.playbackStateSubject.asObservable();

  private currentMetadataSubject = new BehaviorSubject<TrackMetadata | null>(
    null
  );
  public currentMetadata$ = this.currentMetadataSubject.asObservable();

  /**
   * Constructor de la clase
   * @param audiusRequest 
   */
  constructor(private audiusRequest: AudiusRequest) {
    this.audiusRequest.currentTrackId$.subscribe((trackId) => {
      this.updatePlaybackState({ trackId });
      if (trackId) {
        this.fetchAndUpdateMetadata(trackId);
      } else {
        this.currentMetadataSubject.next(null);
      }
    });

    this.audiusRequest.isPlaying$.subscribe((isPlaying) => {
      this.updatePlaybackState({ isPlaying });

      if (isPlaying) {
        this.emitMusicEvent('play');
      } else {
        if (this.getPlaybackState().trackId) {
          this.emitMusicEvent('pause');
        }
      }
    });

    this.audiusRequest.currentTime$.subscribe((position) => {
      this.updatePlaybackState({ position });
    });
  }
  /**
   * Busca contenido en Audius.
   * @param query 
   * @returns 
   */
  search(query: string): Observable<any> {
    return this.audiusRequest.searchContent(query);
  }

  /**
   * Obtiene las pistas de audio más populares.
   * @returns 
   */
  tracks(): Observable<any> {
    return this.audiusRequest.getTrendingTracks();
  }
  /**
   * Obtiene las listas de reproducción disponibles.
   * @returns 
   */
  playlists(): Observable<any> {
    return this.audiusRequest.getPlaylists();
  }

  /**
   * Obtiene las pistas de una lista de reproducción.
   * @param playlistId 
   * @returns 
   */
  playlistTracks(playlistId: string): Observable<any> {
    return this.audiusRequest.getPlaylistTracks(playlistId);
  }
  /**
   * Obtiene una lista de reproducción por su ID.
   * @param playlistId 
   * @returns 
   */
  getPlaylistById(playlistId: string): Observable<any> {
    return this.audiusRequest.getPlaylistById(playlistId);
  }

  /**
   * Obtiene una pista por su ID.
   * @param trackId 
   * @returns 
   */
  getTrackById(trackId: string): Observable<any> {
    return this.audiusRequest.getTrackById(trackId);
  }

  /**
   * Reproduce una pista de audio.
   * @param trackId 
   * @param playlist 
   * @param syncPosition 
   * @param suppressEvents 
   */
  async play(
    trackId: string,
    playlist?: any[],
    syncPosition?: number,
    suppressEvents: boolean = false
  ) {
    if (playlist) {
      this.audiusRequest.setCurrentPlaylist(playlist, trackId);
    }
    await this.audiusRequest.playTrack(trackId, syncPosition, suppressEvents);
  }

  /**
   * Pausa la reproducción de la pista actual.
   * @param suppressEvents 
   */
  pause(suppressEvents: boolean = false): void {
    this.audiusRequest.pauseTrack(suppressEvents);
  }

  /**
   * Detiene la reproducción de la pista actual.
   */
  stop(): void {
    this.audiusRequest.stopCurrentTrack();
  }

  /**
   * Reproduce la siguiente pista en la lista de reproducción actual.
   */
  next(): void {
    this.audiusRequest.playNextTrack();
  }

  /**
   * Reproduce la pista anterior en la lista de reproducción actual.
   */
  previous(): void {
    this.audiusRequest.playPreviousTrack();
  }

  /**
   * Busca una pista en la lista de reproducción actual.
   * @param position 
   * @param suppressEvents 
   */
  seekTo(position: number, suppressEvents: boolean = false): void {
    this.audiusRequest.seekTo(position, suppressEvents);
    if (!suppressEvents) {
      this.emitMusicEvent('seek');
    }
  }

  /**
   * Comprueba si se está reproduciendo música.
   * @returns 
   */
  isPlaying(): Observable<boolean> {
    return this.audiusRequest.isPlaying$;
  }

  /**
   * Obtiene el ID de la pista actual.
   * @returns 
   */
  getCurrentTrackId(): Observable<string | null> {
    return this.audiusRequest.currentTrackId$;
  }

  /**
   * Obtiene el tiempo actual de reproducción.
   * @returns 
   */
  getCurrentTime(): Observable<number> {
    return this.audiusRequest.currentTime$;
  }

  /**
   * Obtiene la duración de la pista actual.
   * @returns 
   */
  getDuration(): Observable<number> {
    return this.audiusRequest.duration$;
  }

  /**
   * Obtiene la lista de reproducción actual.
   * @returns 
   */
  getCurrentPlaylist(): Observable<any[] | null> {
    return this.audiusRequest.currentPlaylist$;
  }

  /**
   * Obtiene el índice de la pista actual.
   * @returns 
   */
  getCurrentTrackIndex(): Observable<number> {
    return this.audiusRequest.currentTrackIndex$;
  }

  /**
   * Formatea el tiempo en segundos a un string legible.
   * @param time 
   * @returns 
   */
  formatTime(time: number): string {
    return this.audiusRequest.formatTime(time);
  }

  /**
   * Obtiene el estado de reproducción actual.
   * @returns 
   */
  getPlaybackState(): PlaybackState {
    return this.playbackStateSubject.getValue();
  }

  /**
   * Registra un callback para eventos de música locales.
   */
  onLocalMusicEvent(callback: (event: MusicEvent) => void) {
    return this.musicEvent$.subscribe(callback);
  }

  /**
   * Actualiza el estado de reproducción.
   * @param partialState 
   */
  private updatePlaybackState(partialState: Partial<PlaybackState>) {
    const currentState = this.playbackStateSubject.getValue();
    this.playbackStateSubject.next({
      ...currentState,
      ...partialState,
    });
  }

  /**
   * Emite un evento de música.
   * @param eventType 
   * @returns 
   */
  private emitMusicEvent(eventType: 'play' | 'pause' | 'seek') {
    // No emitir eventos si estamos en proceso de sincronización de sala
    if (this.audiusRequest.isRoomSyncInProgress()) {
      return;
    }

    const state = this.getPlaybackState();
    const metadata = this.currentMetadataSubject.getValue();

    this.musicEventSubject.next({
      eventType,
      trackId: state.trackId,
      position: state.position,
      timestamp: Date.now(),
      metadata: metadata || undefined,
    });
  }

  /**
   * Busca y actualiza los metadatos de una pista.
   * @param trackId 
   */
  private fetchAndUpdateMetadata(trackId: string) {
    this.getTrackById(trackId).subscribe((response) => {
      if (response && response.data) {
        const track = response.data;
        const metadata: TrackMetadata = {
          title: track.title || 'Unknown Title',
          artist: track.user?.name || 'Unknown Artist',
          artworkUrl: track.artwork?.large_url || '',
          duration: track.duration || 0,
        };
        this.currentMetadataSubject.next(metadata);
      }
    });
  }

  /**
   * Establece el modo de sala.
   * @param isRoomMode 
   */
  setRoomMode(isRoomMode: boolean): void {
    this.audiusRequest.setRoomMode(isRoomMode);
  }

  /**
   * Comprueba si se está sincronizando la sala.
   * @returns 
   */
  isRoomSyncInProgress(): boolean {
    return this.audiusRequest.isRoomSyncInProgress();
  }
}
