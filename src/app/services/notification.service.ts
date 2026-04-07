import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface NotificationItem {
  id:        number;
  userId:    number;
  title:     string;
  message:   string;
  type:      string;
  isRead:    boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly API = environment.apiBase;
  private http = inject(HttpClient);

  notifications = signal<NotificationItem[]>([]);

  unreadCount = () =>
    this.notifications().filter(n => !n.isRead).length;

  loadNotifications(userId: number): void {
    if (!userId || userId <= 0) {
      this.notifications.set([]);
      return;
    }
    this.http.get<NotificationItem[]>(
      `${this.API}/Notification/user/${userId}`
    ).pipe(catchError(() => of([])))
     .subscribe(data => this.notifications.set(data));
  }

  markAsRead(notificationId: number): Observable<any> {
    return this.http.put<any>(
      `${this.API}/Notification/${notificationId}/read`, {}
    ).pipe(
      tap(() => {
        this.notifications.update(list =>
          list.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
      }),
      catchError(() => of(null))
    );
  }

  deleteNotification(notificationId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.API}/Notification/${notificationId}`
    ).pipe(
      tap(() => {
        this.notifications.update(list =>
          list.filter(n => n.id !== notificationId)
        );
      }),
      catchError(() => of(null))
    );
  }
}