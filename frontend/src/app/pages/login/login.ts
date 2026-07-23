import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MfaLoginChallenge, PoliciaMfaFlowComponent } from '../../libs/policia-mfa/public-api';
import { LoginVisualPublicItem, LoginVisualService } from '../../core/services/administracion/login-visual.service';
import { BrandingService } from '../../core/services/administracion/branding.service';

@Component({
  selector:    'app-login',
  standalone:  true,
  imports:     [CommonModule, RouterModule, FormsModule, PoliciaMfaFlowComponent],
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

  // ── 2FA ─────────────────────────────────────────────────────────────────
  /**
   * Reto MFA recibido tras validar credenciales. Al asignarse, el componente
   * reutilizable <pmfa-flow> (@policia/mfa) abre la modal correspondiente. Toda
   * la lógica de enrolamiento/verificación/reset vive ahora en la librería.
   */
  mfaChallenge: MfaLoginChallenge | null = null;

  // ── Timers ────────────────────────────────────────────────────────────────
  private loginTimeoutHandle: any = null;
  private slideTimerHandle:   any = null;

  constructor(
    private authService:        AuthService,
    private router:             Router,
    private loginVisualService: LoginVisualService,
    private brandingService:    BrandingService
  ) {}

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

        // ── 2FA requerido: delegar en la librería @policia/mfa ─────────────
        if (resp?.requiresMfa) {
          this.mfaChallenge = resp as MfaLoginChallenge;
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
  // PASO 2 — RESULTADO DEL FLUJO 2FA (emitido por <pmfa-flow>)
  // ════════════════════════════════════════════════════════════════════════════

  /** El componente MFA completó el 2FA y devolvió el JWT: guardar sesión y navegar. */
  onMfaAutenticado(token: string): void {
    this.authService.storeLoginData(token, this.usuario);
    this.mfaChallenge = null;
    this.router.navigate(['/home']);
  }

  /** El usuario canceló / cerró el flujo 2FA: volver al formulario de credenciales. */
  onMfaCancelado(): void {
    this.mfaChallenge = null;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  togglePasswordVisibility(): void { this.showPassword = !this.showPassword; }
}
