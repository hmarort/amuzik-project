// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// environment.ts (entorno de desarrollo)
export const environment = {
  production: false,
  name: 'development',
  apiUrl: 'https://amuzikapi-3ff2.onrender.com/',
  googleAuth: {
    clientId: '142614205335-r748a0d0k3ofo4n3if7dprbql67hor8u.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true
  }
};
/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
