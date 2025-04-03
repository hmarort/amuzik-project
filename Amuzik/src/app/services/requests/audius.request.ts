import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, tap  } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class AudiusRequest {
  private readonly API_URL = 'https://discoveryprovider.audius.co/v1';
  private readonly APP_NAME = 'ExampleApp';
  private currentAudio: HTMLAudioElement | null = null; // Guardar la canción en reproducción

  constructor(private http: HttpClient) { }

  getTrendingTracks(): Observable<any> {
    return this.http.get(`${this.API_URL}/tracks/trending?app_name=${this.APP_NAME}`).pipe(
      tap(response => {
        console.log('Tracks recibidos:', response);
      }),
      catchError(error => {
        console.error('Error al obtener tracks:', error);
        return of({ data: [] });
      })
    );
  }


  async getTrackStreamUrl(trackId: string): Promise<string> {
    try {
      const response = await fetch(`${this.API_URL}/tracks/${trackId}/stream?app_name=${this.APP_NAME}`, {
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`Error al obtener el stream: ${response.statusText}`);
      }
      return response.url;
    } catch (error) {
      console.error('Error obteniendo la URL de streaming:', error);
      return '';
    }
  }


  async playTrack(trackId: string | undefined) {
    if (!trackId) {
      console.error('Error: trackId es undefined. No se puede reproducir.');
      return;
    }

    this.stopCurrentTrack();

    const streamUrl = await this.getTrackStreamUrl(trackId);
    if (!streamUrl) {
      console.error(`No se pudo obtener la URL de streaming para el track ID: ${trackId}`);
      return;
    }

    this.currentAudio = new Audio();
    this.currentAudio.src = streamUrl;
    // Removed the 'type' property as it does not exist on HTMLAudioElement
    this.currentAudio.play().catch(error => {
      console.error('Error al intentar reproducir:', error);
    });
  }


  pauseTrack() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  stopCurrentTrack() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
  }
}