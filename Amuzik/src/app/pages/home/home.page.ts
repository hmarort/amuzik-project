import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonButton, IonThumbnail, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';
import { AudiusFacade } from 'src/app/services/facades/audius.facade';
import { addIcons } from 'ionicons';
import { playOutline, pauseOutline, musicalNotesOutline, stopOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonTitle, IonToolbar,
    IonItem, IonButton, IonThumbnail, IonIcon, IonCard, IonCardHeader, IonCardContent
],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  tracks: any[] = [];
  playlist: any = null;
  playlistTracks: any[] = [];
  currentTrack: any = null;
  isPlaying: boolean = false;

  constructor(private audiusFacade: AudiusFacade) {
    addIcons({playOutline, pauseOutline, musicalNotesOutline, stopOutline});
  }

  ngOnInit() {
    // Cargar tracks individuales
    this.audiusFacade.tracks().subscribe((response) => {
      if (response && response.data) {
        this.tracks = response.data;
        console.log('Tracks cargados:', this.tracks.length);
      }
    });

    // Cargar playlists
    this.audiusFacade.playlists().subscribe((response) => {
      if (response && response.data && response.data.length > 0) {
        // Tomamos la primera playlist como ejemplo
        this.playlist = response.data[0];
        console.log('Playlist cargada:', this.playlist);
        this.processPlaylistTracks();
      } else if (response && Object.keys(response).length > 0 && response['0']) {
        // Usa el formato del ejemplo que diste
        this.playlist = response['0'];
        console.log('Playlist cargada desde formato alternativo:', this.playlist);
        this.processPlaylistTracks();
      }
    });
  }

  processPlaylistTracks() {
    if (!this.playlist || !this.playlist.playlist_contents) {
      console.log('No hay tracks en la playlist o formato inválido');
      return;
    }
    
    // Convertir los IDs de tracks en la playlist a un arreglo de tracks completos
    // Como no tenemos un endpoint directo para obtener los tracks por ID, 
    // por ahora solo guardaremos los IDs y mostraremos información básica
    this.playlistTracks = this.playlist.playlist_contents.map((item: any) => {
      return {
        id: item.track_id,
        title: `Track ${item.track_id}`,
        user: { name: 'Artist' },
        // Usamos la portada de la playlist como fallback
        artwork: this.playlist.artwork
      };
    });
    
    console.log('Tracks de playlist procesados:', this.playlistTracks.length);
  }

  playTrack(trackId: string | undefined) {
    if (!trackId) {
      console.error('Error: trackId es undefined. No se puede reproducir.');
      return;
    }
    
    // Buscamos el track en nuestros datos para tener la información visual
    const foundTrack = this.findTrackById(trackId);
    
    if (foundTrack) {
      this.currentTrack = foundTrack;
      this.isPlaying = true;
      
      // Usar el servicio de facade para reproducir
      this.audiusFacade.play(trackId);
      this.updateMediaSession();
    }
  }

  findTrackById(trackId: string): any {
    // Buscar primero en tracks individuales
    let track = this.tracks.find(t => t.id === trackId);
    
    // Si no lo encontramos, buscar en la playlist
    if (!track && this.playlistTracks) {
      track = this.playlistTracks.find(t => t.id === trackId);
    }
    
    return track;
  }

  pauseTrack() {
    this.isPlaying = false;
    this.audiusFacade.pause();
  }

  stopTrack() {
    this.isPlaying = false;
    this.audiusFacade.stop();
    this.currentTrack = null;
  }

  updateMediaSession() {
    if ('mediaSession' in navigator && this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title || 'Unknown Title',
        artist: this.currentTrack.user?.name || 'Unknown Artist',
        album: this.playlist?.playlist_name || 'Audius',
        artwork: [
          {
            src: this.currentTrack.artwork?.['1000x1000'] || 
                 this.playlist?.artwork?.['1000x1000'] || 
                 'assets/default.jpg',
            sizes: '1000x1000',
            type: 'image/jpeg',
          },
        ],
      });
      
      navigator.mediaSession.setActionHandler('play', () => {
        this.playTrack(this.currentTrack.id);
      });
      
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pauseTrack();
      });
      
      navigator.mediaSession.setActionHandler('stop', () => {
        this.stopTrack();
      });
    }
  }
}