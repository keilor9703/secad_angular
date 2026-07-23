import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { POLICIA_MFA_CONFIG, PoliciaMfaConfig } from './mfa.config';
import { MfaStepResponse } from './mfa.models';

/**
 * Cliente del flujo de doble autenticación institucional (@policia/mfa).
 *
 * Consume los endpoints MFA del backend del propio sistema
 * (.../{controlador}/MfaVerify, MfaEnrollConfirm, MfaResetRequest,
 * MfaResetConfirm), que a su vez se integran con la API 2FA central de la
 * Policía. La URL y el controlador se toman de la configuración inyectada,
 * así la misma librería sirve para cualquier sistema.
 */
@Injectable({ providedIn: 'root' })
export class MfaService {

  private readonly base: string;
  private readonly deviceKey: string;

  constructor(
    private http: HttpClient,
    @Inject(POLICIA_MFA_CONFIG) private cfg: Required<PoliciaMfaConfig>,
  ) {
    this.base      = `${this.cfg.apiBaseUrl}/${this.cfg.controlador}`;
    this.deviceKey = this.cfg.deviceStorageKey;
  }

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
