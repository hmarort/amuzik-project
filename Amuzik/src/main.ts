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
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  lockClosed,
  mail,
  logoGoogle,
  logoFacebook,
  eye,
} from 'ionicons/icons';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { AuthInterceptor } from './app/services/interceptors/auth.interceptor';
import { environment } from './environments/environment';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { Keyboard } from '@capacitor/keyboard';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// use hook after platform dom ready
GoogleAuth.initialize(environment.googleAuth);
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
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    importProvidersFrom(HttpClientModule),
  ],
}).then(() => {
  // ✅ Configura eventos del teclado
  Keyboard.addListener('keyboardWillShow', () => {
    document.body.classList.add('keyboard-is-open');
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.body.classList.remove('keyboard-is-open');
  });
});
