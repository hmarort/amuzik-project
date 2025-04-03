import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import{ map, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AudiusFacade {

  constructor(private request:AudiusRequest) { }

  public tracks(): Observable<any> {
    return this.request.getTrendingTracks();
  }
  public playlists(): Observable<any> {
    return this.request.getPlaylists();
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
}
