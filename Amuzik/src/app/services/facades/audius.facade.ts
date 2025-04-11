import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AudiusFacade {
  constructor(private audiusRequest: AudiusRequest) {}

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
}