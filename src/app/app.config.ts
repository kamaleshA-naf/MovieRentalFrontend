import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimations(),
    provideToastr({
      timeOut:           4000,
      positionClass:     'toast-top-right',
      preventDuplicates: true,
      countDuplicates:   false,
      progressBar:       true,
      closeButton:       true,
      newestOnTop:       true,
      tapToDismiss:      true,
      easing:            'ease-in',
      easeTime:          200,
      maxOpened:         3,
      autoDismiss:       true
    })
  ]
};