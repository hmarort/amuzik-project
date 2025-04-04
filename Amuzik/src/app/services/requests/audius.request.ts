import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AudiusRequest {
  private readonly API_URL = 'https://discoveryprovider.audius.co/v1';
  private readonly APP_NAME = 'amuzik';
  private currentAudio: HTMLAudioElement | null = null;
  
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
  
  getPlaylists(): Observable<any> {
    return this.http.get(`${this.API_URL}/playlists/trending?app_name=${this.APP_NAME}`).pipe(
      tap(response => {
        console.log('Playlists recibidos:', response);
      }),
      catchError(error => {
        console.error('Error al obtener playlists:', error);
        return of({ data: [] });
      })
    );
  }
  
  // Nuevo método para obtener una playlist específica por ID
  getPlaylistById(playlistId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/playlists/${playlistId}?app_name=${this.APP_NAME}`).pipe(
      tap(response => {
        console.log('Playlist obtenida:', response);
      }),
      catchError(error => {
        console.error('Error al obtener playlist:', error);
        return of(null);
      })
    );
  }
  
  // Nuevo método para obtener detalles de un track específico
  getTrackById(trackId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/tracks/${trackId}?app_name=${this.APP_NAME}`).pipe(
      tap(response => {
        console.log('Track obtenido:', response);
      }),
      catchError(error => {
        console.error('Error al obtener track:', error);
        return of(null);
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
    // Agregar evento para actualizar la UI cuando termine la canción
    this.currentAudio.onended = () => {
      // Aquí puedes emitir un evento o manejar la finalización
      console.log('Track finalizado');
      // También podrías implementar un sistema de cola para reproducir la siguiente canción
    };
    
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
  
  // Método para obtener el estado actual de reproducción
  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }
  
  // Método para obtener la posición actual de reproducción
  getCurrentTime(): number {
    return this.currentAudio ? this.currentAudio.currentTime : 0;
  }
  
  // Método para obtener la duración total
  getDuration(): number {
    console.log('Duración total:', this.currentAudio ? this.currentAudio.duration : 0);
    return this.currentAudio ? this.currentAudio.duration : 0;
  }
}