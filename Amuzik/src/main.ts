import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import {
  getAnalytics,
  provideAnalytics,
  ScreenTrackingService,
  UserTrackingService,
} from '@angular/fire/analytics';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  provideAppCheck,
} from '@angular/fire/app-check';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { getPerformance, providePerformance } from '@angular/fire/performance';
import { getStorage, provideStorage } from '@angular/fire/storage';
import {
  getRemoteConfig,
  provideRemoteConfig,
} from '@angular/fire/remote-config';
import { getVertexAI, provideVertexAI } from '@angular/fire/vertexai';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  lockClosed,
  mail,
  logoGoogle,
  logoFacebook,
  eye,
} from 'ionicons/icons';
import { HttpClientModule } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
addIcons({
  'lock-closed': lockClosed,
  mail: mail,
  'logo-google': logoGoogle,
  'logo-facebook': logoFacebook,
  eye: eye,
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    importProvidersFrom(HttpClientModule),
    provideFirebaseApp(() =>
      initializeApp({
        projectId: 'amuzik-38d5c',
        appId: '1:142614205335:web:919e66396d143fc658ead2',
        storageBucket: 'amuzik-38d5c.firebasestorage.app',
        apiKey: 'AIzaSyAxqDUI3mkgl9lRctgmqmIfPMv-HRMQ0BE',
        authDomain: 'amuzik-38d5c.firebaseapp.com',
        messagingSenderId: '142614205335',
        measurementId: 'G-YGSB2ZZGX4',
      })
    ),
    provideAuth(() => getAuth()),
    provideAnalytics(() => getAnalytics()),
    ScreenTrackingService,
    UserTrackingService,
    provideAppCheck(() => {
      const provider = new ReCaptchaEnterpriseProvider(
        '6LejIgUrAAAAAIXTlu4xLwSRS8cych1C5hOOPR7r'
      );
      return initializeAppCheck(undefined, {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
    }),
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()),
    provideFunctions(() => getFunctions()),
    provideMessaging(() => getMessaging()),
    providePerformance(() => getPerformance()),
    provideStorage(() => getStorage()),
    provideRemoteConfig(() => getRemoteConfig()),
    provideVertexAI(() => getVertexAI()),
  ],
});
