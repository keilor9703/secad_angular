import { InjectionToken, Provider } from '@angular/core';

/**
 * Configuración de la librería de doble autenticación (@policia/mfa).
 *
 * Cada sistema que consuma la librería la provee con su propia URL de API.
 * La lógica y las modales de 2FA son idénticas en todos los sistemas; solo
 * cambia esta configuración.
 */
export interface PoliciaMfaConfig {
  /** Base URL de la API del sistema (ej. environment.apiBaseUrl → ".../api"). */
  apiBaseUrl: string;

  /**
   * Segmento del controlador del backend que expone los endpoints MFA
   * (MfaVerify, MfaEnrollConfirm, MfaResetRequest, MfaResetConfirm).
   * Por defecto "Cuenta" (como en SECAD).
   */
  controlador?: string;

  /**
   * Emisor mostrado en la app de autenticación y en el enlace otpauth://
   * al enrolar (ej. "SECAD"). Por defecto "SECAD".
   */
  issuer?: string;

  /**
   * Clave de localStorage donde se persiste el UUID del dispositivo (para
   * "recordar este equipo"). Por defecto "policia_mfa_device".
   * SECAD usa "secad_mfa_device" para no invalidar dispositivos ya recordados.
   */
  deviceStorageKey?: string;
}

/** Token de inyección con la configuración efectiva (defaults aplicados). */
export const POLICIA_MFA_CONFIG = new InjectionToken<Required<PoliciaMfaConfig>>('POLICIA_MFA_CONFIG');

/**
 * Registra la librería MFA en el sistema consumidor.
 *
 * Uso (en app.config.ts / providers de bootstrap):
 * ```ts
 * providePoliciaMfa({ apiBaseUrl: environment.apiBaseUrl })
 * ```
 */
export function providePoliciaMfa(config: PoliciaMfaConfig): Provider {
  const efectiva: Required<PoliciaMfaConfig> = {
    apiBaseUrl:       config.apiBaseUrl.replace(/\/+$/, ''),
    controlador:      config.controlador?.trim() || 'Cuenta',
    issuer:           config.issuer?.trim() || 'SECAD',
    deviceStorageKey: config.deviceStorageKey?.trim() || 'policia_mfa_device',
  };
  return { provide: POLICIA_MFA_CONFIG, useValue: efectiva };
}
