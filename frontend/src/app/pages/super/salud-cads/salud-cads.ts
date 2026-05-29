import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService, TenantPublico, SaludHistorial } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-salud-cads',
  templateUrl: './salud-cads.html',
  styleUrls: ['./salud-cads.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SaludCadsComponent implements OnInit, OnDestroy {
  cads: TenantPublico[] = [];
  loading   = false;
  minimized = false;
  lastUpdated: Date | null = null;

  // Selected CAD for historial panel
  selectedCad: TenantPublico | null = null;
  historial: SaludHistorial[] = [];
  loadingHistorial = false;
  showHistorial    = false;

  // Filter
  filterNivel = 0;  // 0 = all
  filterText  = '';

  // Auto-refresh
  private refreshInterval: any;
  readonly REFRESH_SECONDS = 30;
  nextRefreshIn = this.REFRESH_SECONDS;
  paused        = false;

  constructor(
    private service: SuperAdminService,
    private toast:   ToastService
  ) {}

  ngOnInit(): void {
    this.load();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshInterval);
  }

  load(): void {
    this.loading = true;
    this.service.getSaludCads().subscribe({
      next: data => {
        this.cads        = data;
        this.loading     = false;
        this.lastUpdated = new Date();
        this.checkAlerts();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error', 'Error al cargar datos de salud.');
      }
    });
  }

  get filteredCads(): TenantPublico[] {
    return this.cads.filter(c => {
      const matchNivel = this.filterNivel === 0 || c.nivelOperacion === this.filterNivel;
      const matchText  = !this.filterText ||
        c.nombre.toLowerCase().includes(this.filterText.toLowerCase()) ||
        c.codDane.includes(this.filterText);
      return matchNivel && matchText;
    });
  }

  get totalNormal():    number { return this.cads.filter(c => c.nivelOperacion === 1).length; }
  get totalDegradado(): number { return this.cads.filter(c => c.nivelOperacion === 2).length; }
  get totalOffline():   number { return this.cads.filter(c => c.nivelOperacion === 3).length; }

  openHistorial(cad: TenantPublico): void {
    this.selectedCad     = cad;
    this.showHistorial   = true;
    this.historial       = [];
    this.loadingHistorial = true;

    this.service.getHistorial(cad.codDane, 48).subscribe({
      next: data => { this.historial = data; this.loadingHistorial = false; },
      error: ()   => { this.loadingHistorial = false; this.toast.error('Error', 'Error al cargar historial.'); }
    });
  }

  closeHistorial(): void {
    this.showHistorial = false;
    this.selectedCad   = null;
  }

  nivelLabel = (n: number) => this.service.nivelLabel(n);
  nivelClass = (n: number) => this.service.nivelClass(n);
  nivelIcon  = (n: number) => this.service.nivelIcon(n);

  latenciaClass(ms: number | undefined): string {
    if (!ms) return '';
    if (ms < 100) return 'latencia-ok';
    if (ms < 300) return 'latencia-warn';
    return 'latencia-bad';
  }

  formatSincro(dt: string | undefined): string {
    if (!dt) return 'Sin registro';
    const d = new Date(dt);
    const diff = (Date.now() - d.getTime()) / 60000;
    if (diff < 2)   return 'Hace menos de 2 min';
    if (diff < 60)  return `Hace ${Math.round(diff)} min`;
    if (diff < 1440) return `Hace ${Math.round(diff / 60)} h`;
    return `Hace ${Math.round(diff / 1440)} días`;
  }

  private checkAlerts(): void {
    const alertas = this.cads.filter(c => c.nivelOperacion >= 2);
    if (alertas.length > 0) {
      const names = alertas.map(c => c.nombre).join(', ');
      this.toast.warning(
        `${alertas.length} CAD(s) con alerta`,
        names
      );
    }
  }

  togglePause(): void {
    this.paused = !this.paused;

    if (this.paused) {
      // Detener el intervalo y congelar el contador
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    } else {
      // Reanudar: carga inmediata + reiniciar contador
      this.load();
      this.startAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.nextRefreshIn = this.REFRESH_SECONDS;
    this.refreshInterval = setInterval(() => {
      this.nextRefreshIn--;
      if (this.nextRefreshIn <= 0) {
        this.load();
        this.nextRefreshIn = this.REFRESH_SECONDS;
      }
    }, 1000);
  }
}
