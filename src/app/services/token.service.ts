import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly KEY = 'moviebox_token';

  save(token: string): void {
    sessionStorage.setItem(this.KEY, token);
  }

  get(): string | null {
    return sessionStorage.getItem(this.KEY);
  }

  remove(): void {
    sessionStorage.removeItem(this.KEY);
  }

  isValid(): boolean {
    const token = this.get();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Date.now() / 1000;
    } catch { return false; }
  }

  getRole(): string {
    const token = this.get();
    if (!token) return '';
    try {
      const d = JSON.parse(atob(token.split('.')[1]));
      return d['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
          ?? d['role'] ?? '';
    } catch { return ''; }
  }

  getName(): string {
    const token = this.get();
    if (!token) return '';
    try {
      const d = JSON.parse(atob(token.split('.')[1]));
      return d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
          ?? d['name'] ?? '';
    } catch { return ''; }
  }

  getUserId(): number {
    const token = this.get();
    if (!token) return 0;
    try {
      const d = JSON.parse(atob(token.split('.')[1]));
      const raw =
        d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
        ?? d['sub'] ?? '0';
      return parseInt(String(raw), 10) || 0;
    } catch { return 0; }
  }

  getEmail(): string {
    const token = this.get();
    if (!token) return '';
    try {
      const d = JSON.parse(atob(token.split('.')[1]));
      return d['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
          ?? d['email'] ?? '';
    } catch { return ''; }
  }
}