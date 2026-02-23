import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

interface LoginRequest {
  Usuario: string;
  Contrasena: string;
}

interface LoginResponse {
  success: boolean;
  Success?: boolean;
  token?: string;
  mensaje?: string;
  message?: string;
  usuario?: string;
  funcionario?: string;
  identificacion?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'sisge_token';
  private readonly userKey = 'sisge_usuario';
  private readonly authKey = 'sisge_auth';
  private readonly userIdKey = 'sisge_user_id';
  private readonly loginUrl = `${environment.apiBaseUrl}/Cuenta/Token`;

  constructor(private http: HttpClient) {}

  login(usuario: string, contrasena: string): Observable<LoginResponse> {
    const payload: LoginRequest = {
      Usuario: usuario,
      Contrasena: contrasena
    };

    return this.http.post<LoginResponse>(this.loginUrl, payload, { withCredentials: true }).pipe(
      timeout(30000),
      tap((resp) => {
        if (this.isLoginSuccessful(resp)) {
          if (resp.token) {
            localStorage.setItem(this.tokenKey, resp.token);
            const userId = this.extractUserIdFromToken(resp.token);
            if (userId !== null) {
              localStorage.setItem(this.userIdKey, String(userId));
            }
          }
          localStorage.setItem(this.authKey, '1');
          localStorage.setItem(this.userKey, resp.usuario ?? usuario);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.authKey);
    localStorage.removeItem(this.userIdKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUsuario(): string {
    return localStorage.getItem(this.userKey) ?? 'Usuario';
  }

  getUserId(): number | null {
    const raw = localStorage.getItem(this.userIdKey);
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  isAuthenticated(): boolean {
    return localStorage.getItem(this.authKey) === '1' || !!localStorage.getItem(this.tokenKey);
  }

  isLoginSuccessful(resp: LoginResponse | null | undefined): boolean {
    return !!resp && (resp.success === true || resp.Success === true || !!resp.token);
  }

  private extractUserIdFromToken(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const parsed = JSON.parse(atob(padded));

      const rawId =
        parsed?.id_usuario ??
        parsed?.nameid ??
        parsed?.sub ??
        parsed?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
      const userId = Number(rawId);
      return Number.isFinite(userId) ? userId : null;
    } catch {
      return null;
    }
  }
}
