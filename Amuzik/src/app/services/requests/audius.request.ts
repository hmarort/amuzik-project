import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, tap, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AudiusRequest {
  private readonly API_URL = 'https://discoveryprovider.audius.co/v1';
  private readonly APP_NAME = 'amuzik';
  private currentAudio: HTMLAudioElement | null = null;
  private trackPositions: Map<string, number> = new Map();

  private currentTrackIdSubject = new BehaviorSubject<string | null>(null);
  public currentTrackId$ = this.currentTrackIdSubject.asObservable();

  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  public isPlaying$ = this.isPlayingSubject.asObservable();
  private cache = new Map<string, any>();

  constructor(private http: HttpClient) {}
  searchContent(query: string): Observable<any> {
    return this.http.get(`${this.API_URL}/tracks/search?query=${encodeURIComponent(query)}&app_name=${this.APP_NAME}`).pipe(
      tap(response => {
        console.log('Track search results:', response);
      }),
      catchError(error => {
        console.error('Error en la búsqueda de tracks:', error);
        return of({ data: [] });
      })
    );
  }
  getPlaylistTracks(playlistId: string): Observable<any> {
    const cacheKey = `playlist_${playlistId}`;
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey));
    }
    return this.http
      .get(`${this.API_URL}/playlists/${playlistId}/tracks?app_name=${this.APP_NAME}`)
      .pipe(
        tap((response) => {
          console.log('Tracks de la playlist recibidos:', response);
          this.cache.set(cacheKey, response);
        }),
        catchError((error) => {
          console.error('Error al obtener tracks de la playlist:', error);
          return of({ data: [] });
        })
      );
  }
  getTrendingTracks(): Observable<any> {
    return this.http
      .get(`${this.API_URL}/tracks/trending?app_name=${this.APP_NAME}`)
      .pipe(
        tap((response) => {
          console.log('Tracks recibidos:', response);
        }),
        catchError((error) => {
          console.error('Error al obtener tracks:', error);
          return of({ data: [] });
        })
      );
  }

  getPlaylists(): Observable<any> {
    return this.http
      .get(`${this.API_URL}/playlists/trending?app_name=${this.APP_NAME}`)
      .pipe(
        tap((response) => {
          console.log('Playlists recibidos:', response);
        }),
        catchError((error) => {
          console.error('Error al obtener playlists:', error);
          return of({ data: [] });
        })
      );
  }

  getPlaylistById(playlistId: string): Observable<any> {
    return this.http
      .get(`${this.API_URL}/playlists/${playlistId}?app_name=${this.APP_NAME}`)
      .pipe(
        tap((response) => {
          console.log('Playlist obtenida:', response);
        }),
        catchError((error) => {
          console.error('Error al obtener playlist:', error);
          return of(null);
        })
      );
  }

  getTrackById(trackId: string): Observable<any> {
    return this.http
      .get(`${this.API_URL}/tracks/${trackId}?app_name=${this.APP_NAME}`)
      .pipe(
        tap((response) => {
          console.log('Track obtenido:', response);
        }),
        catchError((error) => {
          console.error('Error al obtener track:', error);
          return of(null);
        })
      );
  }

  async getTrackStreamUrl(trackId: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.API_URL}/tracks/${trackId}/stream?app_name=${this.APP_NAME}`,
        {
          mode: 'cors',
        }
      );
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

    // If it's the same track that was previously playing/paused
    const isCurrentTrack = this.currentTrackIdSubject.value === trackId;

    if (isCurrentTrack && this.currentAudio) {
      // Resume playback from the stored position
      this.currentAudio.play().catch((error) => {
        console.error('Error al reanudar reproducción:', error);
      });
      this.isPlayingSubject.next(true);
      return;
    }

    // If it's a new track, prepare to play it
    if (!isCurrentTrack) {
      this.stopCurrentTrack();

      const streamUrl = await this.getTrackStreamUrl(trackId);
      if (!streamUrl) {
        console.error(
          `No se pudo obtener la URL de streaming para el track ID: ${trackId}`
        );
        return;
      }

      this.currentAudio = new Audio();
      this.currentAudio.src = streamUrl;

      // If we previously had a stored position for this track, restore it
      const savedPosition = this.trackPositions.get(trackId);
      if (savedPosition !== undefined) {
        this.currentAudio.currentTime = savedPosition;
      }

      // Set up event handlers
      this.setupAudioEventHandlers(trackId);
    }

    // Start playing and update state
    this.currentAudio?.play().catch((error) => {
      console.error('Error al intentar reproducir:', error);
    });

    this.currentTrackIdSubject.next(trackId);
    this.isPlayingSubject.next(true);
  }

  private setupAudioEventHandlers(trackId: string) {
    if (!this.currentAudio) return;

    // Store the current position periodically
    const updateInterval = setInterval(() => {
      if (this.currentAudio && !this.currentAudio.paused) {
        this.trackPositions.set(trackId, this.currentAudio.currentTime);
      }
    }, 5000);

    this.currentAudio.onended = () => {
      console.log('Track finalizado');
      this.isPlayingSubject.next(false);
      this.trackPositions.delete(trackId); // Clear saved position when track ends
      clearInterval(updateInterval);
      // You could add autoplay next track logic here
    };

    this.currentAudio.onerror = () => {
      console.error('Error durante reproducción de audio');
      this.isPlayingSubject.next(false);
      clearInterval(updateInterval);
    };
  }

  pauseTrack() {
    if (this.currentAudio) {
      this.currentAudio.pause();

      // Store current position
      const currentTrackId = this.currentTrackIdSubject.value;
      if (currentTrackId) {
        this.trackPositions.set(currentTrackId, this.currentAudio.currentTime);
      }

      this.isPlayingSubject.next(false);
    }
  }

  stopCurrentTrack() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Clear current track state
    this.currentTrackIdSubject.next(null);
    this.isPlayingSubject.next(false);
  }

  isPlaying(): boolean {
    return this.isPlayingSubject.value;
  }

  getCurrentTrackId(): string | null {
    return this.currentTrackIdSubject.value;
  }

  getCurrentTime(): number {
    return this.currentAudio ? this.currentAudio.currentTime : 0;
  }

  getDuration(): number {
    return this.currentAudio ? this.currentAudio.duration : 0;
  }

  seekTo(position: number) {
    if (this.currentAudio) {
      this.currentAudio.currentTime = position;

      // Update stored position
      const currentTrackId = this.currentTrackIdSubject.value;
      if (currentTrackId) {
        this.trackPositions.set(currentTrackId, position);
      }
    }
  }
}
