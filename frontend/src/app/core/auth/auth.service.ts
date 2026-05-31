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
  private readonly maxJwtLength = 8192;
  private readonly maxJwtPayloadB64Length = 4096;
  private readonly maxJwtPayloadJsonLength = 6144;

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
          sessionStorage.removeItem('modales_vistos');
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
    const token = this.getToken();
    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }

    return true;
  }

  /** Decode the stored JWT and return all relevant claims. */
  getJwtClaims(): {
    sitioGraba: number; acd: number; fuerzaId: number; canalId: number;
    codDane: string; homeCodDane: string; usuario: string; idUsuario: number;
    esAdmin: boolean; esSuperAdmin: boolean; nombreCad: string;
  } {
    const token = this.getToken();
    const empty = {
      sitioGraba: 0, acd: 0, fuerzaId: 0, canalId: 0,
      codDane: '', homeCodDane: '', usuario: '', idUsuario: 0,
      esAdmin: false, esSuperAdmin: false, nombreCad: ''
    };
    if (!token) return empty;
    const p = this.decodeJwtPayload(token);
    if (!p) return empty;
    const nameKey = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
    const codDane = String(p?.cod_dane ?? '');
    return {
      sitioGraba:   Number(p?.sitio_graba  ?? 0),
      acd:          Number(p?.acd           ?? 0),
      fuerzaId:     Number(p?.fuerza_id     ?? 0),
      canalId:      Number(p?.canal_id      ?? 0),
      codDane,
      homeCodDane:  String(p?.home_cod_dane ?? codDane),
      idUsuario:    Number(p?.id_usuario    ?? p?.nameid ?? 0),
      usuario:      String(p?.[nameKey] ?? p?.unique_name ?? p?.name ?? ''),
      esAdmin:      p?.es_admin        === 'true',
      esSuperAdmin: p?.es_super_admin  === 'true',
      nombreCad:    String(p?.nombre_cad ?? '')
    };
  }

  /** Returns true when the current JWT belongs to a SuperAdministrador. */
  esSuperAdmin(): boolean {
    return this.getJwtClaims().esSuperAdmin;
  }

  /** Returns true when the current JWT belongs to an Administrador or SuperAdministrador. */
  esAdmin(): boolean {
    return this.getJwtClaims().esAdmin;
  }

  /** Returns the user's home tenant cod_dane (never changes during context switching). */
  getHomeCodDane(): string {
    return this.getJwtClaims().homeCodDane;
  }

  /** Returns the currently active cod_dane (may differ from home when SuperAdmin is in a context). */
  getActiveCodDane(): string {
    return this.getJwtClaims().codDane;
  }

  /** Returns true when SuperAdmin is operating in a different tenant's context. */
  isContextSwitched(): boolean {
    const { esSuperAdmin, codDane, homeCodDane } = this.getJwtClaims();
    return esSuperAdmin && codDane !== homeCodDane && !!homeCodDane;
  }

  /** Replaces the stored JWT (used after a context switch returns a new token). */
  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    const userId = this.extractUserIdFromToken(token);
    if (userId !== null) localStorage.setItem(this.userIdKey, String(userId));
  }

  /**
   * Persiste el JWT y los metadatos de sesión tras completar 2FA.
   * Llamado por LoginComponent cuando el backend devuelve el token definitivo.
   */
  storeLoginData(token: string, usuario: string): void {
    localStorage.setItem(this.tokenKey, token);
    const userId = this.extractUserIdFromToken(token);
    if (userId !== null) localStorage.setItem(this.userIdKey, String(userId));
    localStorage.setItem(this.authKey, '1');
    localStorage.setItem(this.userKey, usuario);
    sessionStorage.removeItem('modales_vistos');
  }

  isLoginSuccessful(resp: LoginResponse | null | undefined): boolean {
    return !!resp && (resp.success === true || resp.Success === true || !!resp.token);
  }

  private extractUserIdFromToken(token: string): number | null {
    try {
      const parsed = this.decodeJwtPayload(token);
      if (!parsed) {
        return null;
      }

      const nameIdentifierClaim = 'http' + '://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
      const rawId =
        parsed?.id_usuario ??
        parsed?.nameid ??
        parsed?.sub ??
        parsed?.[nameIdentifierClaim];
      const userId = Number(rawId);
      return Number.isFinite(userId) ? userId : null;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parsed = this.decodeJwtPayload(token);
      if (!parsed) {
        return true;
      }

      const exp = Number(parsed?.exp);
      if (!Number.isFinite(exp) || exp <= 0) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      return exp <= now;
    } catch {
      return true;
    }
  }

  private decodeJwtPayload(token: string): any | null {
    const raw = String(token ?? '').trim();
    if (!raw || raw.length > this.maxJwtLength) {
      return null;
    }

    const parts = raw.split('.');
    if (parts.length < 2) {
      return null;
    }

    const payload = (parts[1] ?? '').trim();
    if (!payload || payload.length > this.maxJwtPayloadB64Length) {
      return null;
    }

    // Base64URL permitidos
    if (!/^[A-Za-z0-9\-_]+$/.test(payload)) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    if (!decoded || decoded.length > this.maxJwtPayloadJsonLength) {
      return null;
    }

    return JSON.parse(decoded);
  }
}
