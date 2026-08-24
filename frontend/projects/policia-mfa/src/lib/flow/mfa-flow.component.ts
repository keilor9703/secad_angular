import {
  Component, EventEmitter, Inject, Input, Output, OnChanges, SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MfaService } from '../mfa.service';
import { MfaLoginChallenge, MfaStepResponse } from '../mfa.models';
import { POLICIA_MFA_CONFIG, PoliciaMfaConfig } from '../mfa.config';

type MfaModal = 'enroll' | 'verify' | 'reset' | 'blocked' | 'svcdown' | null;

/**
 * Componente reutilizable con las modales del flujo de doble autenticación
 * institucional (@policia/mfa): enrolamiento (QR + clave manual + botón otpauth
 * de un toque), verificación TOTP, reset por correo, bloqueo y servicio caído.
 *
 * Uso desde el login de un sistema:
 * ```html
 * <pmfa-flow [challenge]="mfaChallenge" [usuario]="usuario"
 *            (autenticado)="onMfaOk($event)" (cancelado)="mfaChallenge = null">
 * </pmfa-flow>
 * ```
 * El componente NO navega ni guarda el JWT: emite el token vía `autenticado`
 * para que el sistema consumidor decida qué hacer (guardar sesión, redirigir…).
 */
@Component({
  selector:      'pmfa-flow',
  standalone:    true,
  imports: [FormsModule],
  templateUrl:   './mfa-flow.component.html',
  styleUrls:     ['./mfa-flow.component.scss'],
  encapsulation: ViewEncapsulation.None,   // estilos globales como en el login original
})
export class PoliciaMfaFlowComponent implements OnChanges {

  /** Reto MFA recibido en el paso 1 del login. Al asignarse, abre la modal correcta. */
  @Input() challenge: MfaLoginChallenge | null = null;
  /** Usuario en sesión — se usa como etiqueta del enlace otpauth. */
  @Input() usuario = '';

  /** Emite el JWT definitivo cuando el 2FA se completa con éxito. */
  @Output() autenticado = new EventEmitter<string>();
  /** Emite cuando el usuario cancela / cierra el flujo. */
  @Output() cancelado = new EventEmitter<void>();

  // ── Estado ─────────────────────────────────────────────────────────────────
  mfaModal: MfaModal = null;
  mfaSessionToken = '';

  mfaQrBase64   = '';
  mfaManualKey  = '';
  mfaEnrollToken = '';
  mfaOtpauthUri: SafeUrl | null = null;

  mfaBloqueoHasta = '';
  mfaSvcMsg = '';

  otpDigits: string[] = ['', '', '', '', '', ''];
  mfaRememberDevice = false;

  mfaLoading = false;
  mfaError   = '';
  mfaInfo    = '';

  resetStep = 1;
  resetInfo = '';

  constructor(
    private mfaService: MfaService,
    private sanitizer:  DomSanitizer,
    @Inject(POLICIA_MFA_CONFIG) private cfg: Required<PoliciaMfaConfig>,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['challenge'] && this.challenge) {
      this.handleMfaChallenge(this.challenge);
    }
  }

  // ── otpauth:// (un toque) ──────────────────────────────────────────────────

  private buildOtpauthUri(): void {
    if (!this.mfaManualKey) { this.mfaOtpauthUri = null; return; }
    const secret = this.mfaManualKey.replace(/\s+/g, '').toUpperCase();
    const issuer = this.cfg.issuer;
    const label  = encodeURIComponent(`${issuer}:${(this.usuario || 'usuario').trim()}`);
    const uri    = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
    this.mfaOtpauthUri = this.sanitizer.bypassSecurityTrustUrl(uri);
  }

  // ── Decisión de modal ──────────────────────────────────────────────────────

  private handleMfaChallenge(challenge: MfaLoginChallenge): void {
    this.mfaSessionToken = challenge.mfaSessionToken ?? '';
    this.clearOtp();
    this.mfaError = '';
    this.mfaInfo  = '';

    const mode = (challenge.mfaMode ?? '').toLowerCase();
    if (mode === 'enroll') {
      this.mfaQrBase64    = challenge.mfaQrBase64    ?? '';
      this.mfaManualKey   = challenge.mfaManualKey   ?? '';
      this.mfaEnrollToken = challenge.mfaEnrollToken ?? '';
      this.buildOtpauthUri();
      this.openModal('enroll');
    } else if (mode === 'verify') {
      this.openModal('verify');
    } else if (mode === 'blocked') {
      this.mfaBloqueoHasta = challenge.bloqueoHasta ?? '';
      this.openModal('blocked');
    } else if (mode === 'svcdown') {
      this.mfaSvcMsg = challenge.message ?? 'El servicio de doble autenticación no está disponible.';
      this.openModal('svcdown');
    }
  }

  // ── Modales ────────────────────────────────────────────────────────────────

  openModal(m: MfaModal): void  { this.mfaModal = m; }
  closeModal(): void            { this.mfaModal = null; }

  openResetModal(): void {
    this.resetStep = 1;
    this.resetInfo = '';
    this.mfaError  = '';
    this.clearOtp();
    this.openModal('reset');
  }

  cancelMfa(): void {
    this.mfaModal        = null;
    this.mfaSessionToken = '';
    this.mfaError        = '';
    this.mfaInfo         = '';
    this.clearOtp();
    this.cancelado.emit();
  }

  // ── OTP boxes ──────────────────────────────────────────────────────────────

  clearOtp(): void { this.otpDigits = ['', '', '', '', '', '']; }
  get otpCode(): string { return this.otpDigits.join(''); }

  onOtpInput(idx: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val   = (input.value || '').replace(/\D/g, '').slice(-1);
    this.otpDigits[idx] = val;
    input.value = val;
    if (val && idx < 5) this.focusOtp(idx + 1);
    if (this.otpCode.length === 6) this.onOtpComplete();
  }

  onOtpKeydown(idx: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (!this.otpDigits[idx] && idx > 0) {
        this.otpDigits[idx - 1] = '';
        this.focusOtp(idx - 1);
      } else {
        this.otpDigits[idx] = '';
      }
    }
    if (event.key === 'ArrowLeft'  && idx > 0) this.focusOtp(idx - 1);
    if (event.key === 'ArrowRight' && idx < 5) this.focusOtp(idx + 1);
  }

  onOtpPaste(event: ClipboardEvent): void {
    const text   = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    digits.split('').forEach((d, i) => { if (i < 6) this.otpDigits[i] = d; });
    this.focusOtp(Math.min(digits.length, 5));
    if (this.otpCode.length === 6) this.onOtpComplete();
  }

  private focusOtp(idx: number): void {
    const boxes = document.querySelectorAll<HTMLInputElement>('.mfa-otp-box:not([disabled])');
    if (boxes[idx]) boxes[idx].focus();
  }

  private onOtpComplete(): void {
    if (this.mfaModal === 'verify')  this.submitVerify();
    if (this.mfaModal === 'enroll')  this.submitEnroll();
    if (this.mfaModal === 'reset' && this.resetStep === 2) this.submitResetConfirm();
  }

  // ── Acciones MFA ───────────────────────────────────────────────────────────

  submitVerify(): void {
    if (this.otpCode.length !== 6) { this.mfaError = 'Ingrese los 6 dígitos del código.'; return; }
    this.mfaLoading = true;
    this.mfaError   = '';
    this.mfaService.verify(this.mfaSessionToken, this.otpCode, this.mfaRememberDevice).subscribe({
      next: r => this.handleStepResponse(r),
      error: () => { this.mfaLoading = false; this.mfaError = 'Error de comunicación. Intente nuevamente.'; }
    });
  }

  submitEnroll(): void {
    if (this.otpCode.length !== 6) { this.mfaError = 'Ingrese los 6 dígitos del código.'; return; }
    this.mfaLoading = true;
    this.mfaError   = '';
    this.mfaService.enrollConfirm(this.mfaSessionToken, this.otpCode, this.mfaEnrollToken).subscribe({
      next: r => this.handleStepResponse(r),
      error: () => { this.mfaLoading = false; this.mfaError = 'Error de comunicación. Intente nuevamente.'; }
    });
  }

  submitResetRequest(): void {
    this.mfaLoading = true;
    this.mfaError   = '';
    this.resetInfo  = '';
    this.mfaService.resetRequest(this.mfaSessionToken).subscribe({
      next: r => {
        this.mfaLoading = false;
        if (r.isInfo || r.success) {
          this.resetInfo = r.message;
          this.resetStep = 2;
          this.clearOtp();
        } else {
          this.mfaError = r.message || 'No fue posible enviar el código. Intente nuevamente.';
        }
      },
      error: () => { this.mfaLoading = false; this.mfaError = 'Error de comunicación.'; }
    });
  }

  submitResetConfirm(): void {
    if (this.otpCode.length !== 6) { this.mfaError = 'Ingrese los 6 dígitos del código.'; return; }
    this.mfaLoading = true;
    this.mfaError   = '';
    this.mfaService.resetConfirm(this.mfaSessionToken, this.otpCode).subscribe({
      next: r => {
        this.mfaLoading = false;
        if (!r.success) { this.mfaError = r.message; this.clearOtp(); return; }
        this.mfaQrBase64    = r.qrBase64    ?? '';
        this.mfaManualKey   = r.manualKey   ?? '';
        this.mfaEnrollToken = r.enrollToken ?? '';
        this.buildOtpauthUri();
        this.clearOtp();
        this.mfaError  = '';
        this.mfaInfo   = 'MFA restablecido. Escanee el nuevo QR para activar su autenticador.';
        this.openModal('enroll');
      },
      error: () => { this.mfaLoading = false; this.mfaError = 'Error de comunicación.'; }
    });
  }

  // ── Resultado final ────────────────────────────────────────────────────────

  private handleStepResponse(r: MfaStepResponse): void {
    this.mfaLoading = false;

    if (r.bloqueoHasta) {
      this.mfaBloqueoHasta = r.bloqueoHasta;
      this.openModal('blocked');
      return;
    }
    if (!r.success) {
      this.mfaError = r.message || 'Operación no exitosa.';
      this.clearOtp();
      return;
    }
    if (r.token) {
      this.closeModal();
      this.autenticado.emit(r.token);   // el sistema consumidor guarda sesión y navega
    }
  }

  trackByIdx(idx: number): number { return idx; }
}
