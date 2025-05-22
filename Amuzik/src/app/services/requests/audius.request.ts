import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, tap, BehaviorSubject, switchMap } from 'rxjs';

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

  /**
   * Constructor de la clase
   * @param http 
   */
  constructor(private http: HttpClient) {
    setInterval(() => {
      if (this.currentAudio && !this.currentAudio.paused) {
        this.currentTimeSubject.next(this.currentAudio.currentTime);
      }
    }, 1000);
  }

  /**
   * Buscamos el contenido en la API de Audius
   * @param query 
   * @returns 
   */
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

  /**
   * Obtenemos las pistas de una lista de reproducción
   * @param playlistId 
   * @returns 
   */
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

  /**
   * Obtenemos los tracks más top del momento
   * @returns 
   */
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

  /**
   * Obtenemos las listas de reproducción más populares
   * @returns 
   */
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

  /**
   * Obtenemos la playlist por ID
   * @param playlistId 
   * @returns 
   */
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

  /**
   * Obtenemos el track por ID
   * @param trackId 
   * @returns 
   */
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

  /**
   * Obtenemos el url de stremaing del track que se trate
   * @param trackId 
   * @returns 
   */
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

  /**
   * Establecemos la lista de reproducción actual
   * @param playlist 
   * @param initialTrackId 
   * @returns 
   */
  setCurrentPlaylist(playlist: any[] | null, initialTrackId?: string) {
    if (!playlist || playlist.length === 0) {
      this.currentPlaylistSubject.next(null);
      this.currentTrackIndexSubject.next(-1);
      return;
    }
    const normalizedPlaylist = playlist.map(track => ({
      ...track,
      id: track.track_id || track.id 
    }));
    
    this.currentPlaylistSubject.next(normalizedPlaylist);
    
    if (initialTrackId) {
      const trackIndex = normalizedPlaylist.findIndex(track => 
        (track.id === initialTrackId || track.track_id === initialTrackId)
      );
      
      if (trackIndex !== -1) {
        console.log(`Estableciendo índice inicial: ${trackIndex} para track: ${initialTrackId}`);
        this.currentTrackIndexSubject.next(trackIndex);
      } else {
        console.warn(`No se encontró el track ${initialTrackId} en la playlist`);
        this.currentTrackIndexSubject.next(0);
      }
    } else if (normalizedPlaylist.length > 0) {
      this.currentTrackIndexSubject.next(0);
    }
  }

  /**
   * Reproducimos el track del que obtenemos su ID
   * @param trackId 
   * @returns 
   */
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
  
    if (this.currentAudio && this.currentTrackIdSubject.value) {
      this.trackPositions.set(
        this.currentTrackIdSubject.value, 
        this.currentAudio.currentTime
      );
    }
  
    if (!isCurrentTrack) {
      this.stopCurrentTrack(false);
  
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
    
    const currentPlaylist = this.currentPlaylistSubject.value;
    if (currentPlaylist) {
      const trackIndex = currentPlaylist.findIndex(track => 
        (track.track_id === trackId || track.id === trackId)
      );
      
      if (trackIndex !== -1) {
        console.log(`Actualizando índice actual a: ${trackIndex}`);
        this.currentTrackIndexSubject.next(trackIndex);
      } else {
        console.warn(`Track ${trackId} no encontrado en la playlist actual`);
      }
    }
  }


  /**
   * Cargamos los manejadores de Audio, entre ellos el intervalo, etc...
   * @param trackId 
   * @returns 
   */
  private setupAudioEventHandlers(trackId: string) {
    if (!this.currentAudio) return;

    this.durationSubject.next(0);

    this.currentAudio.onloadedmetadata = () => {
      if (this.currentAudio) {
        this.durationSubject.next(this.currentAudio.duration);
      }
    };

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
      
      this.playNextTrack();
    };

    this.currentAudio.onerror = () => {
      console.error('Error durante reproducción de audio');
      this.isPlayingSubject.next(false);
      clearInterval(updateInterval);
    };
  }

  /**
   * Pausa el track en reproducción
   */
  pauseTrack() {
    if (this.currentAudio) {
      this.currentAudio.pause();

      const currentTrackId = this.currentTrackIdSubject.value;
      if (currentTrackId) {
        this.trackPositions.set(currentTrackId, this.currentAudio.currentTime);
      }

      this.isPlayingSubject.next(false);
    }
  }

  /**
   * Detenemos el track en reproduccíon actual
   * @param resetPlaylist 
   */
  stopCurrentTrack(resetPlaylist: boolean = true) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  
    this.currentTrackIdSubject.next(null);
    this.isPlayingSubject.next(false);
    this.currentTimeSubject.next(0);
    this.durationSubject.next(0);
    
    if (resetPlaylist) {
      this.currentPlaylistSubject.next(null);
      this.currentTrackIndexSubject.next(-1);
    }
  }

  /**
   * Comprobamos si el track se encuentra en reproducción
   * @returns 
   */
  isPlaying(): boolean {
    return this.isPlayingSubject.value;
  }

  /**
   * Obtenemos el Id del track que esté sonando en el momento
   * @returns 
   */
  getCurrentTrackId(): string | null {
    return this.currentTrackIdSubject.value;
  }

  /**
   * Obtenemos el tiempo actual
   * @returns 
   */
  getCurrentTime(): number {
    return this.currentTimeSubject.value;
  }

  /**
   * Obtenemos la duración de la canción
   * @returns 
   */
  getDuration(): number {
    return this.durationSubject.value;
  }

  /**
   * Desplazamos hacia adelante o hacia atrás la canción pudiendo adelantarla o retrasarla
   * @param position 
   */
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
  
  /**
   * Cuando pulsamos el botón de siguiente nos reproduce la siguiente cancion.
   * si es en playslist de playlist, si es single a una aleatoria
   */
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
      // Si no hay playlist o estamos en el último track, intentamos encontrar uno similar
      this.findSimilarTrack(this.currentTrackIdSubject.value);
    }
  }
  
  /**
   * Encontrar tracks similares para cuando saltamos de single a otra cancion
   * @param currentTrackId 
   * @returns 
   */
  private findSimilarTrack(currentTrackId: string | null) {
    if (!currentTrackId) return;
    
    this.getTrackById(currentTrackId).pipe(
      switchMap(trackData => {
        if (!trackData?.data) return of(null);
        
        const genre = trackData.data.genre;
        
        if (genre) {
          return this.http.get(`${this.API_URL}/tracks/trending?genre=${encodeURIComponent(genre)}&app_name=${this.APP_NAME}`)
            .pipe(
              catchError(() => of({ data: [] }))
            );
        }
        
        return of(null);
      }),
      catchError(() => of({ data: [] }))
    ).subscribe((response: any) => {
      if (response?.data && response.data.length > 0) {
        // Filtrar el track actual
        const similarTracks = response.data.filter((t: any) => t.id !== currentTrackId);
        
        if (similarTracks.length > 0) {
          const randomIndex = Math.floor(Math.random() * similarTracks.length);
          const nextTrack = similarTracks[randomIndex];
          
          // Crear una nueva playlist con tracks similares
          this.setCurrentPlaylist(similarTracks, nextTrack.id);
          this.playTrack(nextTrack.id);
        } else {
          this.findRandomTrack();
        }
      } else {
        this.findRandomTrack();
      }
    });
  }
  
  /**
   * Encontramos un track aleatorio de entre los trending
   */
  private findRandomTrack() {
    this.http.get(`${this.API_URL}/tracks/trending?app_name=${this.APP_NAME}`)
      .pipe(
        catchError(() => of({ data: [] }))
      )
      .subscribe((response: any) => {
        if (response?.data && response.data.length > 0) {
          const randomIndex = Math.floor(Math.random() * response.data.length);
          const randomTrack = response.data[randomIndex];
          
          if (randomTrack?.id) {
            this.setCurrentPlaylist(response.data);
            this.playTrack(randomTrack.id);
          }
        }
      });
  }
  
  /**
   * Pulsando dos veces el botón de retrasar volvemos al track anterior si es que habia sino, no pasa nada porque estamos en el primer track
   * @returns 
   */
  playPreviousTrack() {
    const currentPlaylist = this.currentPlaylistSubject.value;
    const currentIndex = this.currentTrackIndexSubject.value;
    
    console.log(`Intentando reproducir track anterior. Índice actual: ${currentIndex}`);
    
    if (this.currentAudio && this.currentAudio.currentTime > 3) {
      console.log('Volviendo al inicio de la canción actual');
      this.seekTo(0);
      return;
    }
    
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

  /**
   * Formatemaos el tiempo
   * @param time 
   * @returns 
   */
  formatTime(time: number): string {
    if (isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
}