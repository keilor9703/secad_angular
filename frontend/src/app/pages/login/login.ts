import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MfaLoginChallenge, PoliciaMfaFlowComponent } from '@policia/mfa';
import { LoginVisualPublicItem, LoginVisualService } from '../../core/services/administracion/login-visual.service';
import { BrandingService } from '../../core/services/administracion/branding.service';

@Component({
  selector:    'app-login',
  standalone:  true,
  imports:     [CommonModule, RouterModule, ReactiveFormsModule, PoliciaMfaFlowComponent],
  templateUrl: './login.html',
  styleUrls:   ['./login.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly authService        = inject(AuthService);
  private readonly router             = inject(Router);
  private readonly loginVisualService = inject(LoginVisualService);
  private readonly brandingService    = inject(BrandingService);
  private readonly fb                 = inject(FormBuilder);

  // ── Branding ──────────────────────────────────────────────────────────────
  readonly systemName = signal('OFTIC');
  readonly logoUrl     = signal('/escudo.png');

  // ── Formulario de credenciales ───────────────────────────────────────────
  readonly credentialsForm = this.fb.nonNullable.group({
    usuario:    ['', [Validators.required]],
    contrasena: ['', [Validators.required]]
  });

  readonly showPassword = signal(false);
  readonly isLoading    = signal(false);
  readonly errorMessage = signal('');

  // ── Slideshow ─────────────────────────────────────────────────────────────
  readonly slides            = signal<LoginVisualPublicItem[]>([]);
  readonly currentSlideIndex = signal(0);

  // ── 2FA ─────────────────────────────────────────────────────────────────
  /**
   * Reto MFA recibido tras validar credenciales. Al asignarse, el componente
   * reutilizable <pmfa-flow> (@policia/mfa) abre la modal correspondiente. Toda
   * la lógica de enrolamiento/verificación/reset vive ahora en la librería.
   */
  readonly mfaChallenge = signal<MfaLoginChallenge | null>(null);

  // ── Timers ────────────────────────────────────────────────────────────────
  private loginTimeoutHandle: any = null;
  private slideTimerHandle:   any = null;

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
        this.systemName.set(sigla || 'SECAD');
        this.logoUrl.set((cfg?.logoUrl ?? '').trim() || '/escudo.png');
      },
      error: () => { this.systemName.set('SECAD'); this.logoUrl.set('/escudo.png'); }
    });
  }

  // ── Slideshow ─────────────────────────────────────────────────────────────

  loadLoginBackgrounds(): void {
    this.loginVisualService.getPublicConfig().subscribe({
      next: config => {
        const items = (config?.items ?? []).filter(x => !!x?.url).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (!items.length) { this.applyFallbackSlides(); return; }
        this.slides.set(items);
        this.currentSlideIndex.set(0);
        this.startSlideRotation(Number(config?.intervalMs ?? 6000));
      },
      error: () => this.applyFallbackSlides()
    });
  }

  private applyFallbackSlides(): void {
    this.slides.set([
      { fileName: 'banner1.jpg', url: '/background/banner1.jpg', order: 1 },
      { fileName: 'banner2.jpg', url: '/background/banner2.jpg', order: 2 },
      { fileName: 'banner3.jpg', url: '/background/banner3.jpg', order: 3 }
    ]);
    this.currentSlideIndex.set(0);
    this.startSlideRotation(6000);
  }

  private startSlideRotation(intervalMs: number): void {
    if (this.slideTimerHandle) { clearInterval(this.slideTimerHandle); this.slideTimerHandle = null; }
    const total = this.slides().length;
    if (total <= 1) return;
    const safe = Number.isFinite(intervalMs) && intervalMs >= 1500 ? intervalMs : 6000;
    this.slideTimerHandle = setInterval(() => {
      this.currentSlideIndex.update(i => (i + 1) % this.slides().length);
    }, safe);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 1 — CREDENCIALES
  // ════════════════════════════════════════════════════════════════════════════

  onSubmit(): void {
    this.errorMessage.set('');
    if (this.credentialsForm.invalid) {
      this.credentialsForm.markAllAsTouched();
      this.errorMessage.set('Debe diligenciar usuario y contraseña.');
      return;
    }

    const { usuario, contrasena } = this.credentialsForm.getRawValue();
    const usuarioTrim = usuario.trim();
    if (!usuarioTrim || !contrasena.trim()) {
      this.errorMessage.set('Debe diligenciar usuario y contraseña.');
      return;
    }

    this.isLoading.set(true);
    this.loginTimeoutHandle = setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
        this.errorMessage.set('La autenticación está tardando demasiado. Intente nuevamente.');
      }
    }, 35000);

    this.authService.login(usuarioTrim, contrasena).subscribe({
      next: (resp: any) => {
        clearTimeout(this.loginTimeoutHandle);
        this.isLoading.set(false);

        // ── 2FA requerido: delegar en la librería @policia/mfa ─────────────
        if (resp?.requiresMfa) {
          this.mfaChallenge.set(resp as MfaLoginChallenge);
          return;
        }

        // ── Login directo (sin 2FA) ────────────────────────────────────────
        if (this.authService.isLoginSuccessful(resp)) {
          this.router.navigate(['/home']);
          return;
        }

        this.errorMessage.set(resp?.mensaje ?? resp?.message ?? 'No fue posible iniciar sesión.');
      },
      error: err => {
        clearTimeout(this.loginTimeoutHandle);
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.mensaje ?? err?.error?.message ?? 'Error de conexión con el servicio de autenticación.');
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 2 — RESULTADO DEL FLUJO 2FA (emitido por <pmfa-flow>)
  // ════════════════════════════════════════════════════════════════════════════

  /** El componente MFA completó el 2FA y devolvió el JWT: guardar sesión y navegar. */
  onMfaAutenticado(token: string): void {
    this.authService.storeLoginData(token, this.credentialsForm.getRawValue().usuario);
    this.mfaChallenge.set(null);
    this.router.navigate(['/home']);
  }

  /** El usuario canceló / cerró el flujo 2FA: volver al formulario de credenciales. */
  onMfaCancelado(): void {
    this.mfaChallenge.set(null);
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  togglePasswordVisibility(): void { this.showPassword.update(v => !v); }
}
