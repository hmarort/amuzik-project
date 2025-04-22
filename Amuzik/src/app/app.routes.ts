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
    path: 'conf',
    loadComponent: () => import('./pages/conf/conf.page').then(m => m.ConfPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'apariencia',
    loadComponent: () => import('./pages/apariencia/apariencia.page').then(m => m.AparienciaPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage),
    canActivate: [AuthGuard]
  },
  {
    path: '',
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
        redirectTo: '/home',
        pathMatch: 'full'
      }
    ]
  }
];