import { Component, HostListener, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SuperAdminService, TenantPublico } from '../../core/services/super-admin.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-context-banner',
  templateUrl: './context-banner.html',
  styleUrls: ['./context-banner.scss'],
  standalone: true,
  imports: []
})
export class ContextBannerComponent implements OnInit {
  isSuperAdmin  = false;
  isCtxSwitched = false;
  nombreCad     = '';
  homeCodDane   = '';
  activeCodDane = '';
  tenants: TenantPublico[] = [];
  showDropdown  = false;
  switching     = false;

  constructor(
    private auth:         AuthService,
    private superService: SuperAdminService,
    private toast:        ToastService,
    private router:       Router
  ) {}

  ngOnInit(): void {
    const claims      = this.auth.getJwtClaims();
    this.isSuperAdmin  = claims.esSuperAdmin;
    this.isCtxSwitched = this.auth.isContextSwitched();
    this.nombreCad     = claims.nombreCad;
    this.homeCodDane   = claims.homeCodDane;
    this.activeCodDane = claims.codDane;

    if (this.isSuperAdmin) {
      this.superService.getTenants().subscribe({
        next: t => this.tenants = t.filter(x => x.activo),
        error: () => { /* silently ignore — show banner anyway */ }
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.ctx-selector')) {
      this.showDropdown = false;
    }
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  switchTo(codDane: string): void {
    if (codDane === this.activeCodDane || this.switching) return;
    this.switching = true;
    this.showDropdown = false;

    this.superService.switchContext(codDane).subscribe({
      next: result => {
        this.auth.setToken(result.token);
        this.nombreCad     = result.nombreCad;
        this.activeCodDane = result.codDane;
        this.isCtxSwitched = this.auth.isContextSwitched();
        this.switching     = false;
        this.toast.info('Contexto cambiado', `Administrando: ${result.nombreCad}`);
        // Reload to apply the new tenant context
        this.router.navigateByUrl('/administracion/inicio').then(() =>
          window.location.reload()
        );
      },
      error: () => {
        this.switching = false;
        this.toast.error('Error', 'No se pudo cambiar el contexto.');
      }
    });
  }

  returnToHome(): void {
    this.switchTo(this.homeCodDane);
  }
}
