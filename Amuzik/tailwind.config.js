/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,js}',  // Asegura que escanea tus archivos de Ionic/Angular
  ],
  theme: {
    extend: {
      colors: {
        ionic: {
          primary: 'var(--ion-color-primary)',
          secondary: 'var(--ion-color-secondary)',
          tertiary: 'var(--ion-color-tertiary)',
          success: 'var(--ion-color-success)',
          warning: 'var(--ion-color-warning)',
          danger: 'var(--ion-color-danger)',
          light: 'var(--ion-color-light)',
          medium: 'var(--ion-color-medium)',
          dark: 'var(--ion-color-dark)',
        },
      },
    },
  },
  plugins: [],
}

