import { Injectable } from '@angular/core';
import { AudiusRequest } from '../requests/audius.request';
import{ map, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AudiusFacade {

  constructor(private request:AudiusRequest) { }

  public getTrendingTracks(): Observable<any> {
    return this.request.getTrendingTracks();
  }
  public getTrackStreamUrl(trackId: string): Promise<string> {
    return this.request.getTrackStreamUrl(trackId);
  }
  public playTrack(trackId: string | undefined) { 
    return this.request.playTrack(trackId);
  }
  public stopCurrentTrack() {
    return this.request.stopCurrentTrack();
  }
  public pauseTrack() {
    return this.request.pauseTrack();
  }
}
