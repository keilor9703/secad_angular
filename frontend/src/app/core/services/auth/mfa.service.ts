import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── Respuesta del primer paso (POST /api/Cuenta/Token cuando requiere MFA) ──

export interface MfaLoginChallenge {
  success:         false;
  requiresMfa:     true;
  /** 'enroll' | 'verify' | 'blocked' | 'svcdown' */
  mfaMode:         string;
  mfaSessionToken?: string;
  mfaQrBase64?:    string;
  mfaManualKey?:   string;
  mfaEnrollToken?: string;
  bloqueoHasta?:   string;
  message?:        string;
}

// ─── Respuesta de los pasos MFA intermedios ───────────────────────────────────

export interface MfaStepResponse {
  success:      boolean;
  message:      string;
  /** JWT definitivo — presente solo cuando success=true y el 2FA quedó completo. */
  token?:       string;
  bloqueoHasta?: string;
  isInfo?:      boolean;
  /** QR para abrir modal de enrolamiento tras un reset exitoso. */
  qrBase64?:    string;
  manualKey?:   string;
  enrollToken?: string;
}

@Injectable({ providedIn: 'root' })
export class MfaService {

  private readonly base      = `${environment.apiBaseUrl}/Cuenta`;
  private readonly deviceKey = 'secad_mfa_device';

  constructor(private http: HttpClient) {}

  // ── Gestión del deviceId ──────────────────────────────────────────────────

  /** Obtiene (o genera y persiste) el UUID del dispositivo actual. */
  getDeviceId(): string {
    let id = localStorage.getItem(this.deviceKey);
    if (!id) {
      id = this.uuid();
      localStorage.setItem(this.deviceKey, id);
    }
    return id;
  }

  private uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ── Llamadas a la API ─────────────────────────────────────────────────────

  /** Verificar código TOTP. Puede recibir deviceId para recordar el equipo. */
  verify(mfaSessionToken: string, code: string, rememberDevice: boolean): Observable<MfaStepResponse> {
    return this.http.post<MfaStepResponse>(`${this.base}/MfaVerify`, {
      mfaSessionToken,
      code,
      rememberDevice,
      deviceId: rememberDevice ? this.getDeviceId() : null,
    }, { withCredentials: true });
  }

  /** Confirmar el primer enrolamiento (usuario escaneó QR y escribió el código). */
  enrollConfirm(mfaSessionToken: string, code: string, enrollToken: string): Observable<MfaStepResponse> {
    return this.http.post<MfaStepResponse>(`${this.base}/MfaEnrollConfirm`, {
      mfaSessionToken,
      code,
      enrollToken,
    }, { withCredentials: true });
  }

  /** Solicitar código de reset al correo institucional. */
  resetRequest(mfaSessionToken: string): Observable<MfaStepResponse> {
    return this.http.post<MfaStepResponse>(`${this.base}/MfaResetRequest`, {
      mfaSessionToken,
    }, { withCredentials: true });
  }

  /** Confirmar código de correo → resetea MFA → devuelve nuevo QR para enrolar. */
  resetConfirm(mfaSessionToken: string, code: string): Observable<MfaStepResponse> {
    return this.http.post<MfaStepResponse>(`${this.base}/MfaResetConfirm`, {
      mfaSessionToken,
      code,
    }, { withCredentials: true });
  }
}
