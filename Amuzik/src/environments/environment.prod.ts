// environment.prod.ts
export const environment = {
  production: true,
  name: 'production',
  apiUrl: 'https://amuzikapi-3ff2.onrender.com/',
  googleAuth: {
    clientId: '142614205335-r748a0d0k3ofo4n3if7dprbql67hor8u.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true
  }
};