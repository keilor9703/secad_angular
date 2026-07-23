import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { environment } from '../environments/environment';
import { providePoliciaMfa } from './libs/policia-mfa/public-api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN'
      })
    ),
    // Librería de doble autenticación institucional (@policia/mfa).
    // Se conserva 'secad_mfa_device' para no invalidar dispositivos ya recordados.
    providePoliciaMfa({
      apiBaseUrl:       environment.apiBaseUrl,
      issuer:           'SECAD',
      deviceStorageKey: 'secad_mfa_device',
    })
  ]
};
