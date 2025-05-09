// AudiusFacade.ts
import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

export interface PlaybackState {
  trackId: string | null;
  isPlaying: boolean;
  position: number; // en segundos
}

export interface MusicEvent {
  eventType: 'play' | 'pause' | 'seek';
  trackId: string | null;
  position: number;
  timestamp: number; // Timestamp cuando ocurrió el evento
  metadata?: TrackMetadata; // Incluir metadatos si está disponible
}

export interface TrackMetadata {
  title: string;
  artist: string;
  artworkUrl: string;
  duration: number; // en segundos
}

@Injectable({
  providedIn: 'root',
})
export class AudiusFacade {
  // Subject para eventos musicales
  private musicEventSubject = new Subject<MusicEvent>();
  public musicEvent$ = this.musicEventSubject.asObservable();

  // Estado de reproducción
  private playbackStateSubject = new BehaviorSubject<PlaybackState>({
    trackId: null,
    isPlaying: false,
    position: 0
  });
  public playbackState$ = this.playbackStateSubject.asObservable();

  // Metadatos de la pista actual
  private currentMetadataSubject = new BehaviorSubject<TrackMetadata | null>(null);
  public currentMetadata$ = this.currentMetadataSubject.asObservable();

  constructor(private audiusRequest: AudiusRequest) {
    // Actualizar el estado de reproducción cuando cambia cualquier valor relevante
    this.audiusRequest.currentTrackId$.subscribe(trackId => {
      this.updatePlaybackState({ trackId });
      if (trackId) {
        this.fetchAndUpdateMetadata(trackId);
      } else {
        this.currentMetadataSubject.next(null);
      }
    });

    this.audiusRequest.isPlaying$.subscribe(isPlaying => {
      this.updatePlaybackState({ isPlaying });
      
      if (isPlaying) {
        this.emitMusicEvent('play');
      } else {
        // Solo emitir pausa si ya teníamos un track
        if (this.getPlaybackState().trackId) {
          this.emitMusicEvent('pause');
        }
      }
    });

    this.audiusRequest.currentTime$.subscribe(position => {
      this.updatePlaybackState({ position });
    });
  }

  // Métodos existentes
  search(query: string): Observable<any> {
    return this.audiusRequest.searchContent(query);
  }

  tracks(): Observable<any> {
    return this.audiusRequest.getTrendingTracks();
  }

  playlists(): Observable<any> {
    return this.audiusRequest.getPlaylists();
  }

  playlistTracks(playlistId: string): Observable<any> {
    return this.audiusRequest.getPlaylistTracks(playlistId);
  }

  getPlaylistById(playlistId: string): Observable<any> {
    return this.audiusRequest.getPlaylistById(playlistId);
  }

  getTrackById(trackId: string): Observable<any> {
    return this.audiusRequest.getTrackById(trackId);
  }

  async play(trackId: string, playlist?: any[]) {
    if (playlist) {
      this.audiusRequest.setCurrentPlaylist(playlist, trackId);
    }
    await this.audiusRequest.playTrack(trackId);
    // No emitimos el evento aquí porque se emitirá desde los subscriptions
  }

  pause(): void {
    this.audiusRequest.pauseTrack();
    // No emitimos el evento aquí porque se emitirá desde los subscriptions
  }

  stop(): void {
    this.audiusRequest.stopCurrentTrack();
  }

  next(): void {
    this.audiusRequest.playNextTrack();
  }

  previous(): void {
    this.audiusRequest.playPreviousTrack();
  }

  seekTo(position: number): void {
    this.audiusRequest.seekTo(position);
    this.emitMusicEvent('seek');
  }

  isPlaying(): Observable<boolean> {
    return this.audiusRequest.isPlaying$;
  }

  getCurrentTrackId(): Observable<string | null> {
    return this.audiusRequest.currentTrackId$;
  }

  getCurrentTime(): Observable<number> {
    return this.audiusRequest.currentTime$;
  }

  getDuration(): Observable<number> {
    return this.audiusRequest.duration$;
  }

  getCurrentPlaylist(): Observable<any[] | null> {
    return this.audiusRequest.currentPlaylist$;
  }

  getCurrentTrackIndex(): Observable<number> {
    return this.audiusRequest.currentTrackIndex$;
  }

  formatTime(time: number): string {
    return this.audiusRequest.formatTime(time);
  }

  // Nuevos métodos
  /**
   * Obtiene el estado actual de reproducción
   */
  getPlaybackState(): PlaybackState {
    return this.playbackStateSubject.getValue();
  }

  /**
   * Suscribe un callback a eventos musicales locales
   */
  onLocalMusicEvent(callback: (event: MusicEvent) => void) {
    return this.musicEvent$.subscribe(callback);
  }

  /**
   * Actualiza el estado de reproducción
   */
  private updatePlaybackState(partialState: Partial<PlaybackState>) {
    const currentState = this.playbackStateSubject.getValue();
    this.playbackStateSubject.next({
      ...currentState,
      ...partialState
    });
  }

  /**
   * Emite un evento musical
   */
  private emitMusicEvent(eventType: 'play' | 'pause' | 'seek') {
    const state = this.getPlaybackState();
    const metadata = this.currentMetadataSubject.getValue();
    
    this.musicEventSubject.next({
      eventType,
      trackId: state.trackId,
      position: state.position,
      timestamp: Date.now(),
      metadata: metadata || undefined
    });
  }

  /**
   * Obtiene y actualiza los metadatos de una pista
   */
  private fetchAndUpdateMetadata(trackId: string) {
    this.getTrackById(trackId).subscribe(response => {
      if (response && response.data) {
        const track = response.data;
        const metadata: TrackMetadata = {
          title: track.title || 'Unknown Title',
          artist: track.user?.name || 'Unknown Artist',
          artworkUrl: track.artwork?.large_url || '',
          duration: track.duration || 0
        };
        this.currentMetadataSubject.next(metadata);
      }
    });
  }
}