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

  private currentTimeSubject = new BehaviorSubject<number>(0);
  public currentTime$ = this.currentTimeSubject.asObservable();

  private durationSubject = new BehaviorSubject<number>(0);
  public duration$ = this.durationSubject.asObservable();

  private currentPlaylistSubject = new BehaviorSubject<any[] | null>(null);
  public currentPlaylist$ = this.currentPlaylistSubject.asObservable();

  private currentTrackIndexSubject = new BehaviorSubject<number>(-1);
  public currentTrackIndex$ = this.currentTrackIndexSubject.asObservable();

  private cache = new Map<string, any>();

  constructor(private http: HttpClient) {
    // Actualizar el tiempo de reproducción cada segundo
    setInterval(() => {
      if (this.currentAudio && !this.currentAudio.paused) {
        this.currentTimeSubject.next(this.currentAudio.currentTime);
      }
    }, 1000);
  }

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

  setCurrentPlaylist(playlist: any[] | null, initialTrackId?: string) {
    // Normalizar los IDs de las canciones en la playlist
    if (playlist) {
      const normalizedPlaylist = playlist.map(track => ({
        ...track,
        id: track.track_id || track.id // Asegurar consistencia en IDs
      }));
      
      this.currentPlaylistSubject.next(normalizedPlaylist);
      
      if (initialTrackId) {
        const trackIndex = normalizedPlaylist.findIndex(track => 
          (track.id === initialTrackId)
        );
        
        if (trackIndex !== -1) {
          console.log(`Estableciendo índice inicial: ${trackIndex} para track: ${initialTrackId}`);
          this.currentTrackIndexSubject.next(trackIndex);
        } else {
          console.warn(`No se encontró el track ${initialTrackId} en la playlist`);
        }
      }
    } else {
      this.currentPlaylistSubject.next(null);
      this.currentTrackIndexSubject.next(-1);
    }
  }

  async playTrack(trackId: string | undefined) {
    if (!trackId) {
      console.error('Error: trackId es undefined. No se puede reproducir.');
      return;
    }
  
    console.log(`Intentando reproducir track: ${trackId}`);
    const isCurrentTrack = this.currentTrackIdSubject.value === trackId;
  
    if (isCurrentTrack && this.currentAudio) {
      this.currentAudio.play().catch((error) => {
        console.error('Error al reanudar reproducción:', error);
      });
      this.isPlayingSubject.next(true);
      return;
    }
  
    // Guardar el progreso del track actual antes de cambiarlo
    if (this.currentAudio && this.currentTrackIdSubject.value) {
      this.trackPositions.set(
        this.currentTrackIdSubject.value, 
        this.currentAudio.currentTime
      );
    }
  
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
  
      const savedPosition = this.trackPositions.get(trackId);
      if (savedPosition !== undefined) {
        this.currentAudio.currentTime = savedPosition;
      }
  
      this.setupAudioEventHandlers(trackId);
    }
  
    this.currentAudio?.play().catch((error) => {
      console.error('Error al intentar reproducir:', error);
    });
  
    this.currentTrackIdSubject.next(trackId);
    this.isPlayingSubject.next(true);
    
    // Actualizar índice en la playlist actual
    const currentPlaylist = this.currentPlaylistSubject.value;
    if (currentPlaylist) {
      const trackIndex = currentPlaylist.findIndex(track => 
        (track.track_id || track.id) === trackId
      );
      
      if (trackIndex !== -1) {
        console.log(`Actualizando índice actual a: ${trackIndex}`);
        this.currentTrackIndexSubject.next(trackIndex);
      } else {
        console.warn(`Track ${trackId} no encontrado en la playlist actual`);
      }
    }
  }

  private setupAudioEventHandlers(trackId: string) {
    if (!this.currentAudio) return;

    // Restablecer la duración inicial
    this.durationSubject.next(0);

    // Cuando se carga los metadatos, actualizar la duración
    this.currentAudio.onloadedmetadata = () => {
      if (this.currentAudio) {
        this.durationSubject.next(this.currentAudio.duration);
      }
    };

    // Almacenar la posición actual del track cada 5 segundos
    const updateInterval = setInterval(() => {
      if (this.currentAudio && !this.currentAudio.paused) {
        this.trackPositions.set(trackId, this.currentAudio.currentTime);
        this.currentTimeSubject.next(this.currentAudio.currentTime);
      }
    }, 5000);

    this.currentAudio.ontimeupdate = () => {
      if (this.currentAudio) {
        this.currentTimeSubject.next(this.currentAudio.currentTime);
      }
    };

    this.currentAudio.onended = () => {
      console.log('Track finalizado');
      this.isPlayingSubject.next(false);
      this.trackPositions.delete(trackId);
      clearInterval(updateInterval);
      
      // Reproducir siguiente track si está en una playlist
      this.playNextTrack();
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

      // Mantener la posición actual del track
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

    this.currentTrackIdSubject.next(null);
    this.isPlayingSubject.next(false);
    this.currentTimeSubject.next(0);
    this.durationSubject.next(0);
  }

  isPlaying(): boolean {
    return this.isPlayingSubject.value;
  }

  getCurrentTrackId(): string | null {
    return this.currentTrackIdSubject.value;
  }

  getCurrentTime(): number {
    return this.currentTimeSubject.value;
  }

  getDuration(): number {
    return this.durationSubject.value;
  }

  seekTo(position: number) {
    if (this.currentAudio) {
      this.currentAudio.currentTime = position;
      this.currentTimeSubject.next(position);

      const currentTrackId = this.currentTrackIdSubject.value;
      if (currentTrackId) {
        this.trackPositions.set(currentTrackId, position);
      }
    }
  } 
  
  playNextTrack() {
    const currentPlaylist = this.currentPlaylistSubject.value;
    const currentIndex = this.currentTrackIndexSubject.value;
    
    console.log(`Intentando reproducir siguiente track. Índice actual: ${currentIndex}, Playlist length: ${currentPlaylist?.length || 0}`);
    
    if (currentPlaylist && currentIndex !== -1 && currentIndex < currentPlaylist.length - 1) {
      const nextTrack = currentPlaylist[currentIndex + 1];
      const nextTrackId = nextTrack.track_id || nextTrack.id;
      if (nextTrackId) {
        console.log(`Reproduciendo siguiente track: ${nextTrackId}`);
        this.playTrack(nextTrackId);
      } else {
        console.warn('El siguiente track no tiene ID válido');
      }
    } else {
      console.log('No hay más tracks en la playlist o no hay playlist activa');
    }
  }
  
  playPreviousTrack() {
    const currentPlaylist = this.currentPlaylistSubject.value;
    const currentIndex = this.currentTrackIndexSubject.value;
    
    console.log(`Intentando reproducir track anterior. Índice actual: ${currentIndex}`);
    
    // Si la posición actual es mayor a 3 segundos, volver al inicio de la canción
    if (this.currentAudio && this.currentAudio.currentTime > 3) {
      console.log('Volviendo al inicio de la canción actual');
      this.seekTo(0);
      return;
    }
    
    // Si no, ir a la canción anterior
    if (currentPlaylist && currentIndex > 0) {
      const prevTrack = currentPlaylist[currentIndex - 1];
      const prevTrackId = prevTrack.track_id || prevTrack.id;
      if (prevTrackId) {
        console.log(`Reproduciendo track anterior: ${prevTrackId}`);
        this.playTrack(prevTrackId);
      } else {
        console.warn('El track anterior no tiene ID válido');
      }
    } else {
      console.log('Ya estás en el primer track o no hay playlist activa');
    }
  }

  formatTime(time: number): string {
    if (isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
}