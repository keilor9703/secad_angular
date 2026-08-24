import { Component, HostListener, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SuperAdminService, TenantPublico } from '../../core/services/super-admin.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-context-banner',
  templateUrl: './context-banner.html',
  styleUrls: ['./context-banner.scss'],
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextBannerComponent implements OnInit {
  private readonly auth         = inject(AuthService);
  private readonly superService = inject(SuperAdminService);
  private readonly toast        = inject(ToastService);
  private readonly router       = inject(Router);

  readonly isSuperAdmin  = signal(false);
  readonly isCtxSwitched = signal(false);
  readonly nombreCad     = signal('');
  readonly activeCodDane = signal('');
  readonly tenants       = signal<TenantPublico[]>([]);
  readonly showDropdown  = signal(false);
  readonly switching     = signal(false);

  /** Solo se usa internamente (returnToHome) — nunca se lee en el template. */
  private homeCodDane = '';

  ngOnInit(): void {
    const claims = this.auth.getJwtClaims();
    this.isSuperAdmin.set(claims.esSuperAdmin);
    this.isCtxSwitched.set(this.auth.isContextSwitched());
    this.nombreCad.set(claims.nombreCad);
    this.homeCodDane = claims.homeCodDane;
    this.activeCodDane.set(claims.codDane);

    if (this.isSuperAdmin()) {
      this.superService.getTenants()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: t => this.tenants.set(t.filter(x => x.activo)),
          error: () => { /* silently ignore — show banner anyway */ }
        });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.ctx-selector')) {
      this.showDropdown.set(false);
    }
  }

  toggleDropdown(): void {
    this.showDropdown.update(v => !v);
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
  }

  switchTo(codDane: string): void {
    if (codDane === this.activeCodDane() || this.switching()) return;
    this.switching.set(true);
    this.showDropdown.set(false);

    this.superService.switchContext(codDane)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: result => {
          this.auth.setToken(result.token);
          this.nombreCad.set(result.nombreCad);
          this.activeCodDane.set(result.codDane);
          this.isCtxSwitched.set(this.auth.isContextSwitched());
          this.switching.set(false);
          this.toast.info('Contexto cambiado', `Administrando: ${result.nombreCad}`);
          // Reload to apply the new tenant context
          this.router.navigateByUrl('/administracion/inicio').then(() =>
            window.location.reload()
          );
        },
        error: () => {
          this.switching.set(false);
          this.toast.error('Error', 'No se pudo cambiar el contexto.');
        }
      });
  }

  returnToHome(): void {
    this.switchTo(this.homeCodDane);
  }
}
