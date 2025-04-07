import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudiusFacade {
  constructor(private request: AudiusRequest) { }
  
  public tracks(): Observable<any> {
    return this.request.getTrendingTracks();
  }
  searchMusic(query: string): Observable<any> {
    return this.request.searchMusic(query);
  }
  public playlists(): Observable<any> {
    return this.request.getPlaylists();
  }
  
  public getPlaylistById(playlistId: string): Observable<any> {
    return this.request.getPlaylistById(playlistId);
  }
  
  public getTrackById(trackId: string): Observable<any> {
    return this.request.getTrackById(trackId);
  }
  
  public trackUrl(trackId: string): Promise<string> {
    return this.request.getTrackStreamUrl(trackId);
  }
  
  public play(trackId: string | undefined) {
    return this.request.playTrack(trackId);
  }
  
  public stop() {
    return this.request.stopCurrentTrack();
  }
  
  public pause() {
    return this.request.pauseTrack();
  }
  
  public isPlaying(): Observable<boolean> {
    return this.request.isPlaying$;
  }
  
  public getCurrentTrackId(): Observable<string | null> {
    return this.request.currentTrackId$;
  }
  
  public getCurrentTime(): number {
    return this.request.getCurrentTime();
  }
  
  public getDuration(): number {
    return this.request.getDuration();
  }
  
  public seekTo(position: number) {
    return this.request.seekTo(position);
  }
}