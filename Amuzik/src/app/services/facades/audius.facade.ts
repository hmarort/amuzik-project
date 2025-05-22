// AudiusFacade.ts
import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import { Observable, Subject, BehaviorSubject } from 'rxjs';


export interface PlaybackState {
  trackId: string | null;
  isPlaying: boolean;
  position: number;
}

export interface MusicEvent {
  eventType: 'play' | 'pause' | 'seek';
  trackId: string | null;
  position: number;
  timestamp: number;
  metadata?: TrackMetadata;
}

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
    position: 0
  });
  public playbackState$ = this.playbackStateSubject.asObservable();

  private currentMetadataSubject = new BehaviorSubject<TrackMetadata | null>(null);
  public currentMetadata$ = this.currentMetadataSubject.asObservable();

  constructor(private audiusRequest: AudiusRequest) {
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
        if (this.getPlaybackState().trackId) {
          this.emitMusicEvent('pause');
        }
      }
    });

    this.audiusRequest.currentTime$.subscribe(position => {
      this.updatePlaybackState({ position });
    });
  }

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
  }

  pause(): void {
    this.audiusRequest.pauseTrack();
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

  getPlaybackState(): PlaybackState {
    return this.playbackStateSubject.getValue();
  }

  onLocalMusicEvent(callback: (event: MusicEvent) => void) {
    return this.musicEvent$.subscribe(callback);
  }

  private updatePlaybackState(partialState: Partial<PlaybackState>) {
    const currentState = this.playbackStateSubject.getValue();
    this.playbackStateSubject.next({
      ...currentState,
      ...partialState
    });
  }

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