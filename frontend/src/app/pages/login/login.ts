import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MfaService, MfaLoginChallenge, MfaStepResponse } from '../../core/services/auth/mfa.service';
import { LoginVisualPublicItem, LoginVisualService } from '../../core/services/administracion/login-visual.service';
import { BrandingService } from '../../core/services/administracion/branding.service';

// ── Tipos de modal MFA ────────────────────────────────────────────────────────
type MfaModal = 'enroll' | 'verify' | 'reset' | 'blocked' | 'svcdown' | null;

@Component({
  selector:    'app-login',
  standalone:  true,
  imports:     [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.html',
  styleUrls:   ['./login.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

  // ── Branding ──────────────────────────────────────────────────────────────
  systemName = 'OFTIC';
  logoUrl    = '/escudo.png';

  // ── Formulario de credenciales ───────────────────────────────────────────
  usuario    = '';
  contrasena = '';
  showPassword = false;
  isLoading    = false;
  errorMessage = '';

  // ── Slideshow ─────────────────────────────────────────────────────────────
  slides: LoginVisualPublicItem[] = [];
  currentSlideIndex = 0;

  // ══════════════════════════════════════════════════════════════════════════
  // ESTADO MFA
  // ══════════════════════════════════════════════════════════════════════════

  /** Modal activo. null = ninguno. */
  mfaModal: MfaModal = null;

  /** Token de sesión MFA (corta vida, firmado por el backend). */
  mfaSessionToken = '';

  // ── Enrolamiento ──────────────────────────────────────────────────────────
  mfaQrBase64   = '';
  mfaManualKey  = '';
  mfaEnrollToken = '';
  /**
   * Enlace otpauth:// para agregar la cuenta con un toque cuando SECAD se abre
   * en el mismo celular que tiene la app de autenticación (no se puede escanear
   * la propia pantalla). Se calcula al recibir la clave manual.
   */
  mfaOtpauthUri: SafeUrl | null = null;

  // ── Bloqueo ───────────────────────────────────────────────────────────────
  mfaBloqueoHasta = '';

  // ── Servicio caído ────────────────────────────────────────────────────────
  mfaSvcMsg = '';

  // ── OTP boxes (6 dígitos) ─────────────────────────────────────────────────
  otpDigits: string[] = ['', '', '', '', '', ''];

  // ── Recordar dispositivo ──────────────────────────────────────────────────
  mfaRememberDevice = false;

  // ── Estado de operación MFA ───────────────────────────────────────────────
  mfaLoading = false;
  mfaError   = '';
  mfaInfo    = '';

  // ── Reset: número de paso (1=pedir código, 2=validar código) ─────────────
  resetStep = 1;
  resetInfo = '';

  // ── Timers ────────────────────────────────────────────────────────────────
  private loginTimeoutHandle: any = null;
  private slideTimerHandle:   any = null;

  constructor(
    private authService:        AuthService,
    private mfaService:         MfaService,
    private router:             Router,
    private loginVisualService: LoginVisualService,
    private brandingService:    BrandingService,
    private sanitizer:          DomSanitizer
  ) {}

  /**
   * Construye el enlace estándar otpauth://totp/... a partir de la clave manual.
   * Al tocarlo en un celular, la app de autenticación (Google/Microsoft
   * Authenticator, Authy…) se abre y agrega la cuenta sin escanear el QR.
   */
  private buildOtpauthUri(): void {
    if (!this.mfaManualKey) { this.mfaOtpauthUri = null; return; }
    const secret = this.mfaManualKey.replace(/\s+/g, '').toUpperCase();
    const issuer = 'SECAD';
    const label  = encodeURIComponent(`${issuer}:${(this.usuario || 'usuario').trim()}`);
    const uri    = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
    // otpauth:// no está en la lista blanca de Angular → hay que marcarla como segura.
    this.mfaOtpauthUri = this.sanitizer.bypassSecurityTrustUrl(uri);
  }

  ngOnInit(): void {
    this.loadBranding();
    this.loadLoginBackgrounds();
  }

  ngOnDestroy(): void {
    if (this.loginTimeoutHandle) clearTimeout(this.loginTimeoutHandle);
    if (this.slideTimerHandle)   clearInterval(this.slideTimerHandle);
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  private loadBranding(): void {
    this.brandingService.getPublicConfig().subscribe({
      next: cfg => {
        const sigla = (cfg?.sistema ?? cfg?.systemName ?? '').trim();
        this.systemName = sigla || 'SISGE';
        this.logoUrl    = (cfg?.logoUrl ?? '').trim() || '/escudo.png';
      },
      error: () => { this.systemName = 'SISGE'; this.logoUrl = '/escudo.png'; }
    });
  }

  // ── Slideshow ─────────────────────────────────────────────────────────────

  loadLoginBackgrounds(): void {
    this.loginVisualService.getPublicConfig().subscribe({
      next: config => {
        const items = (config?.items ?? []).filter(x => !!x?.url).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (!items.length) { this.applyFallbackSlides(); return; }
        this.slides            = items;
        this.currentSlideIndex = 0;
        this.startSlideRotation(Number(config?.intervalMs ?? 6000));
      },
      error: () => this.applyFallbackSlides()
    });
  }

  private applyFallbackSlides(): void {
    this.slides = [
      { fileName: 'banner1.jpg', url: '/background/banner1.jpg', order: 1 },
      { fileName: 'banner2.jpg', url: '/background/banner2.jpg', order: 2 },
      { fileName: 'banner3.jpg', url: '/background/banner3.jpg', order: 3 }
    ];
    this.currentSlideIndex = 0;
    this.startSlideRotation(6000);
  }

  private startSlideRotation(intervalMs: number): void {
    if (this.slideTimerHandle) { clearInterval(this.slideTimerHandle); this.slideTimerHandle = null; }
    if (!this.slides || this.slides.length <= 1) return;
    const safe = Number.isFinite(intervalMs) && intervalMs >= 1500 ? intervalMs : 6000;
    this.slideTimerHandle = setInterval(() => {
      this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
    }, safe);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 1 — CREDENCIALES
  // ════════════════════════════════════════════════════════════════════════════

  onSubmit(): void {
    this.errorMessage = '';
    if (!this.usuario?.trim() || !this.contrasena?.trim()) {
      this.errorMessage = 'Debe diligenciar usuario y contraseña.';
      return;
    }

    this.isLoading = true;
    this.loginTimeoutHandle = setTimeout(() => {
      if (this.isLoading) { this.isLoading = false; this.errorMessage = 'La autenticación está tardando demasiado. Intente nuevamente.'; }
    }, 35000);

    this.authService.login(this.usuario.trim(), this.contrasena).subscribe({
      next: (resp: any) => {
        clearTimeout(this.loginTimeoutHandle);
        this.isLoading = false;

        // ── 2FA requerido ──────────────────────────────────────────────────
        if (resp?.requiresMfa) {
          this.handleMfaChallenge(resp as MfaLoginChallenge);
          return;
        }

        // ── Login directo (sin 2FA) ────────────────────────────────────────
        if (this.authService.isLoginSuccessful(resp)) {
          this.router.navigate(['/home']);
          return;
        }

        this.errorMessage = resp?.mensaje ?? resp?.message ?? 'No fue posible iniciar sesión.';
      },
      error: err => {
        clearTimeout(this.loginTimeoutHandle);
        this.isLoading    = false;
        this.errorMessage = err?.error?.mensaje ?? err?.error?.message ?? 'Error de conexión con el servicio de autenticación.';
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 2 — DECISIÓN DE MODAL MFA
  // ════════════════════════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE MODALES
  // ════════════════════════════════════════════════════════════════════════════

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
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OTP BOX LOGIC
  // ════════════════════════════════════════════════════════════════════════════

  clearOtp(): void { this.otpDigits = ['', '', '', '', '', '']; }

  get otpCode(): string { return this.otpDigits.join(''); }

  onOtpInput(idx: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val   = (input.value || '').replace(/\D/g, '').slice(-1);
    this.otpDigits[idx] = val;
    input.value = val;
    if (val && idx < 5) this.focusOtp(idx + 1);
    // Auto-submit cuando el último dígito es ingresado
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

  /** Callback cuando los 6 dígitos están completos — ejecuta la acción del modal activo. */
  private onOtpComplete(): void {
    if (this.mfaModal === 'verify')  this.submitVerify();
    if (this.mfaModal === 'enroll')  this.submitEnroll();
    if (this.mfaModal === 'reset' && this.resetStep === 2) this.submitResetConfirm();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACCIONES MFA
  // ════════════════════════════════════════════════════════════════════════════

  /** Modal VERIFY — el usuario ingresa su código TOTP. */
  submitVerify(): void {
    if (this.otpCode.length !== 6) { this.mfaError = 'Ingrese los 6 dígitos del código.'; return; }
    this.mfaLoading = true;
    this.mfaError   = '';

    this.mfaService.verify(this.mfaSessionToken, this.otpCode, this.mfaRememberDevice).subscribe({
      next: r => this.handleStepResponse(r),
      error: () => { this.mfaLoading = false; this.mfaError = 'Error de comunicación. Intente nuevamente.'; }
    });
  }

  /** Modal ENROLL — el usuario confirmó el QR con su primer código TOTP. */
  submitEnroll(): void {
    if (this.otpCode.length !== 6) { this.mfaError = 'Ingrese los 6 dígitos del código.'; return; }
    this.mfaLoading = true;
    this.mfaError   = '';

    this.mfaService.enrollConfirm(this.mfaSessionToken, this.otpCode, this.mfaEnrollToken).subscribe({
      next: r => this.handleStepResponse(r),
      error: () => { this.mfaLoading = false; this.mfaError = 'Error de comunicación. Intente nuevamente.'; }
    });
  }

  /** Modal RESET — paso 1: solicitar código al correo. */
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

  /** Modal RESET — paso 2: confirmar código del correo. */
  submitResetConfirm(): void {
    if (this.otpCode.length !== 6) { this.mfaError = 'Ingrese los 6 dígitos del código.'; return; }
    this.mfaLoading = true;
    this.mfaError   = '';

    this.mfaService.resetConfirm(this.mfaSessionToken, this.otpCode).subscribe({
      next: r => {
        this.mfaLoading = false;
        if (!r.success) { this.mfaError = r.message; this.clearOtp(); return; }

        // El reset fue exitoso: el backend devolvió QR para re-enrolar
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

  // ── Resultado final de cada acción MFA ───────────────────────────────────

  private handleStepResponse(r: MfaStepResponse): void {
    this.mfaLoading = false;

    // Bloqueado
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

    // ✅ Éxito — guardar JWT y navegar al home
    if (r.token) {
      this.authService.storeLoginData(r.token, this.usuario);
      this.closeModal();
      this.router.navigate(['/home']);
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }

  trackByIdx(idx: number): number { return idx; }
}
