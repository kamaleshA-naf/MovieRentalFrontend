import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { throwError, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { environment } from '@env/environment';
import { SKIP_ERROR_INTERCEPTOR } from '../services/movie.service';

/** Requests that should NOT be retried (mutations) */
const NO_RETRY_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/** Map HTTP status → user-friendly message */
function friendlyMessage(err: HttpErrorResponse): string {
  if (!navigator.onLine) return 'No internet connection. Please check your network.';

  switch (err.status) {
    case 0:    return 'Cannot reach the server. Please try again later.';
    case 400:  return err.error?.message ?? err.error?.Message ?? 'Invalid request.';
    case 401:  return 'Session expired. Please log in again.';
    case 403:  return 'You do not have permission to perform this action.';
    case 404:  return 'The requested resource was not found.';
    case 409:  return err.error?.message ?? 'This item already exists.';
    case 422:  return err.error?.message ?? 'Validation failed.';
    case 429:  return 'Too many requests. Please slow down.';
    case 500:  return 'Service temporarily unavailable. Please try again later.';
    case 502:
    case 503:
    case 504:  return 'Server is temporarily down. Please try again later.';
    default:   return 'Something went wrong. Please try again.';
  }
}

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Skip this interceptor entirely for fire-and-forget calls
  if (req.context.get(SKIP_ERROR_INTERCEPTOR)) {
    return next(req);
  }

  const toastr = inject(ToastrService);
  const canRetry = !NO_RETRY_METHODS.has(req.method);

  // Log outgoing request
  console.log(`[HTTP] ${req.method} ${req.url}`);

  return next(req).pipe(
    // Timeout — abort if no response within limit
    timeout(environment.requestTimeoutMs),

    // Retry only safe (GET) requests
    retry({
      count: canRetry ? environment.retryCount : 0,
      delay: (_, attempt) => timer(attempt * 800)   // 800ms, 1600ms back-off
    }),

    catchError((err) => {
      // Timeout from RxJS throws a plain Error, not HttpErrorResponse
      if (err?.name === 'TimeoutError') {
        console.error(`[HTTP] TIMEOUT ${req.url}`);
        toastr.error('Request timed out. Please try again.', 'Timeout', { timeOut: 5000 });
        return throwError(() => err);
      }

      if (err instanceof HttpErrorResponse) {
        const msg = friendlyMessage(err);

        // Log full detail to console — never shown to user
        console.error(`[HTTP] ${err.status} ${req.url}`, {
          status:  err.status,
          message: err.message,
          body:    err.error
        });

        // 401 — silent (auth service handles redirect)
        // 404 on GET — silent (services return fallback data)
        // 409 — silent (components handle "already exists" with their own messages)
        // 400 — silent (components handle validation errors with custom messages)
        const silent =
          err.status === 401 ||
          err.status === 409 ||
          err.status === 400 ||
          (err.status === 404 && req.method === 'GET');

        if (!silent) {
          toastr.error(msg, 'Error', {
            timeOut:     6000,
            progressBar: true,
            closeButton: true
          });
        }
      }

      return throwError(() => err);
    })
  );
};
