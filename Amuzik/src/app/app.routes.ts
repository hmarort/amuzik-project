import { Routes } from '@angular/router';
import { AuthGuard } from './services/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'signin',
    loadComponent: () => import('./pages/signin/signin.page').then(m => m.SigninPage)
  },
  {
    path: 'album',
    loadComponent: () => import('./pages/album/album.page').then(m => m.AlbumPage),
    canActivate: [AuthGuard] // Proteger esta ruta
  },
  {
    path: 'conf',
    loadComponent: () => import('./pages/conf/conf.page').then(m => m.ConfPage),
    canActivate: [AuthGuard] // Proteger esta ruta
  },
  {
    path: 'apariencia',
    loadComponent: () => import('./pages/apariencia/apariencia.page').then(m => m.AparienciaPage),
    canActivate: [AuthGuard] // Proteger esta ruta
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage),
    canActivate: [AuthGuard] // Proteger esta ruta
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [AuthGuard], // Proteger toda la sección de tabs
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'friends',
        loadComponent: () => import('./pages/friends/friends.page').then(m => m.FriendsPage)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  }
];