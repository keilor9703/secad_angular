import { Component, ChangeDetectionStrategy, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService, TenantPublico, SaludHistorial } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-salud-cads',
  templateUrl: './salud-cads.html',
  styleUrls: ['./salud-cads.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaludCadsComponent implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly toast   = inject(ToastService);

  readonly cads        = signal<TenantPublico[]>([]);
  readonly loading     = signal(false);
  readonly minimized   = signal(false);
  readonly lastUpdated = signal<Date | null>(null);

  // Selected CAD for historial panel
  readonly selectedCad      = signal<TenantPublico | null>(null);
  readonly historial        = signal<SaludHistorial[]>([]);
  readonly loadingHistorial = signal(false);
  readonly showHistorial    = signal(false);

  // Filter
  readonly filterNivel = signal(0);  // 0 = all
  readonly filterText  = signal('');

  // Auto-refresh
  private refreshInterval: any;
  readonly REFRESH_SECONDS = 30;
  readonly nextRefreshIn = signal(this.REFRESH_SECONDS);
  readonly paused        = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.refreshInterval));
  }

  ngOnInit(): void {
    this.load();
    this.startAutoRefresh();
  }

  load(): void {
    this.loading.set(true);
    this.service.getSaludCads().subscribe({
      next: data => {
        this.cads.set(data);
        this.loading.set(false);
        this.lastUpdated.set(new Date());
        this.checkAlerts();
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'Error al cargar datos de salud.');
      }
    });
  }

  readonly filteredCads = computed(() => {
    const nivel = this.filterNivel();
    const text  = this.filterText().toLowerCase();
    return this.cads().filter(c => {
      const matchNivel = nivel === 0 || c.nivelOperacion === nivel;
      const matchText  = !text ||
        c.nombre.toLowerCase().includes(text) ||
        c.codDane.includes(this.filterText());
      return matchNivel && matchText;
    });
  });

  readonly totalNormal    = computed(() => this.cads().filter(c => c.nivelOperacion === 1).length);
  readonly totalDegradado = computed(() => this.cads().filter(c => c.nivelOperacion === 2).length);
  readonly totalOffline   = computed(() => this.cads().filter(c => c.nivelOperacion === 3).length);

  openHistorial(cad: TenantPublico): void {
    this.selectedCad.set(cad);
    this.showHistorial.set(true);
    this.historial.set([]);
    this.loadingHistorial.set(true);

    this.service.getHistorial(cad.codDane, 48).subscribe({
      next: data => { this.historial.set(data); this.loadingHistorial.set(false); },
      error: ()   => { this.loadingHistorial.set(false); this.toast.error('Error', 'Error al cargar historial.'); }
    });
  }

  closeHistorial(): void {
    this.showHistorial.set(false);
    this.selectedCad.set(null);
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
    const alertas = this.cads().filter(c => c.nivelOperacion >= 2);
    if (alertas.length > 0) {
      const names = alertas.map(c => c.nombre).join(', ');
      this.toast.warning(
        `${alertas.length} CAD(s) con alerta`,
        names
      );
    }
  }

  togglePause(): void {
    const nowPaused = !this.paused();
    this.paused.set(nowPaused);

    if (nowPaused) {
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
    this.nextRefreshIn.set(this.REFRESH_SECONDS);
    this.refreshInterval = setInterval(() => {
      this.nextRefreshIn.update(v => v - 1);
      if (this.nextRefreshIn() <= 0) {
        this.load();
        this.nextRefreshIn.set(this.REFRESH_SECONDS);
      }
    }, 1000);
  }
}
