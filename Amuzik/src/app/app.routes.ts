import { Routes } from '@angular/router';

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
    loadComponent: () => import('./pages/album/album.page').then(m => m.AlbumPage)
  },
  {
    path: 'conf',
    loadComponent: () => import('./pages/conf/conf.page').then(m => m.ConfPage)
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
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