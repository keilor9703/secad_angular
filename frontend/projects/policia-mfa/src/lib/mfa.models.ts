// ─── DTOs del flujo de doble autenticación (@policia/mfa) ─────────────────────

/**
 * Respuesta del primer paso del login cuando el backend exige MFA
 * (POST .../{controlador}/Token con RequiresMfa=true).
 */
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

/** Respuesta de los pasos MFA intermedios (verify, enroll-confirm, reset*). */
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
