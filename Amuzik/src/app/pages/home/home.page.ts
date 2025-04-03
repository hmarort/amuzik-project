import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonButton, IonThumbnail, IonIcon} from '@ionic/angular/standalone';
import { AudiusFacade } from 'src/app/services/facades/audius.facade';
import { addIcons } from 'ionicons';
import { playOutline, pauseOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonTitle, IonToolbar, 
    IonList, IonItem, IonLabel, IonButton, IonThumbnail, IonIcon
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  tracks: any[] = [];
  currentTrack: any = null;

  constructor(private audiusFacade: AudiusFacade) {
    addIcons({
      playOutline,
      pauseOutline,
    });
  }

  ngOnInit() {
    this.audiusFacade.tracks().subscribe((data) => {
      this.tracks = data.data;
    });
    this.audiusFacade.playlists().subscribe((data) => {
      console.log('Playlists:', data);
    }
    );
  }

  playTrack(trackId: string | undefined) {
    if (!trackId) {
      console.error('Error: trackId es undefined. No se puede reproducir.');
      return;
    }
    console.log('Reproduciendo track con ID:', trackId);
    this.audiusFacade.play(trackId);
  }

  pauseTrack() {
    this.audiusFacade.pause();
  }

  updateMediaSession() {
    if ('mediaSession' in navigator && this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title || 'Unknown Title',
        artist: this.currentTrack.user?.name || 'Unknown Artist',
        album: 'Audius',
        artwork: [
          {
            src:
              this.currentTrack.artwork?.['1000x1000'] || 'assets/default.jpg',
            sizes: '1000x1000',
            type: 'image/jpeg',
          },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        this.playTrack(this.currentTrack);
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.pauseTrack();
      });
    }
  }
}