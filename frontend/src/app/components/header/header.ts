import { Component, HostListener, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarService } from '../../services/sidebar';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { BrandingService } from '../../core/services/administracion/branding.service';
import { EventoService } from '../../core/services/administracion/evento.service';

interface Notification {
  id: number;
  icon: string;
  color: string;
  count: number;
  tooltip: string;
}

interface MiPerfilDto {
  identificacion?: string;
  grado?: string;
  nombreCompleto?: string;
  cargo?: string;
  situacionLaboral?: string;
  tiempoServicio?: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit {
  private readonly sidebarService  = inject(SidebarService);
  private readonly authService     = inject(AuthService);
  private readonly http            = inject(HttpClient);
  private readonly router          = inject(Router);
  private readonly brandingService = inject(BrandingService);
  private readonly eventoService   = inject(EventoService);

  readonly isUserDropdownOpen     = signal(false);
  readonly userPhotoUrl           = signal<string | null>(null);
  readonly profileModalOpen       = signal(false);
  readonly profileLoading         = signal(false);
  readonly perfil                 = signal<MiPerfilDto | null>(null);

  // Próximos eventos
  readonly proximosEventos        = signal<any[]>([]);
  readonly isCalendarDropdownOpen = signal(false);
  readonly selectedEvento         = signal<any | null>(null);
  readonly isEventoModalOpen      = signal(false);

  readonly notifications = signal<Notification[]>([
    { id: 4, icon: 'fa-calendar-check', color: 'primary', count: 0, tooltip: 'Eventos' }
  ]);

  searchQuery: string = '';
  readonly userRole = signal('OFTIC');
  /** Se resuelve una sola vez, de forma síncrona, en ngOnInit — antes del primer render. */
  userName: string = 'Usuario';

  ngOnInit(): void {
    this.userName = this.authService.getUsuario();
    this.loadBranding();
    this.loadMyPhoto();
    this.loadEventosCount();
  }

  toggleMenu() {
    this.sidebarService.toggleSidebar();
  }

  toggleUserDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isUserDropdownOpen.update(v => !v);
  }

  closeUserDropdown(): void {
    this.isUserDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    // Cierre de dropdown de usuario
    if (this.isUserDropdownOpen()) {
      if (!target.closest('.header-user')) {
        this.closeUserDropdown();
      }
    }

    // Cierre de dropdown de calendario
    if (this.isCalendarDropdownOpen()) {
      if (!target.closest('.notification-wrapper')) {
        this.isCalendarDropdownOpen.set(false);
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserDropdown();
    this.isCalendarDropdownOpen.set(false);
  }

  private loadBranding(): void {
    this.brandingService.getPublicConfig().subscribe({
      next: (cfg) => {
        const sigla = (cfg?.sistema ?? cfg?.systemName ?? '').trim();
        this.userRole.set(sigla || 'OFTIC');
      },
      error: () => {
        this.userRole.set('OFTIC');
      }
    });
  }

  private loadEventosCount(): void {
    this.eventoService.getAll().subscribe({
      next: (items) => {
        const today = new Date();
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const limit = new Date(todayZero);
        limit.setDate(todayZero.getDate() + 5);

        const filtered = (items ?? []).filter(e => {
          // Validar vigencia
          const v = e.vigente !== undefined ? e.vigente : (e as any).VIGENTE;
          if (v == null || String(v) !== '1') return false;

          // Validar fecha de inicio dentro de los próximos 5 días
          const startStr = (e.fechaInicio || '').toString().split('T')[0];
          const parts = startStr.split('-');
          if (parts.length !== 3) return false;

          const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

          return startDate.getTime() >= todayZero.getTime() && startDate.getTime() <= limit.getTime();
        });

        this.proximosEventos.set(filtered);
        this.notifications.update(notifs =>
          notifs.map(n => n.id === 4 ? { ...n, count: filtered.length } : n)
        );
      }
    });
  }

  onSearch(): void {
  }

  onNotificationClick(notification: Notification): void {
    if (notification.id === 4) {
      this.isCalendarDropdownOpen.update(v => !v);
    }
  }

  openEventoDetail(evento: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedEvento.set(evento);
    this.isEventoModalOpen.set(true);
    this.isCalendarDropdownOpen.set(false);
  }

  closeEventoModal(): void {
    this.isEventoModalOpen.set(false);
    this.selectedEvento.set(null);
  }

  getEventoImageUrl(raw: string | null | undefined): string {
    const value = (raw ?? '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) return value;
    if (value.startsWith('/')) return value;

    // Usar el host externo para imágenes de eventos
    return `${environment.eventoMediaBaseUrl}/api/Evento/Image/${value}`;
  }

  getEventoFechaRango(evento: any): string {
    const fmt = (dStr: string) => {
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const fi = fmt(evento.fechaInicio);
    const ff = fmt(evento.fechaFin);
    if (!fi && !ff) return 'Sin fecha';
    return fi === ff ? fi : `${fi} - ${ff}`;
  }

  onProfileClick(): void {
    this.openProfileModal();
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private loadMyPhoto(): void {
    this.http
      .get(`${environment.apiBaseUrl}/Usuario/MiFoto`, { responseType: 'text' })
      .subscribe({
        next: (raw) => {
          this.userPhotoUrl.set(this.normalizePhoto(raw));
        },
        error: () => {
          this.userPhotoUrl.set(null);
        }
      });
  }

  private normalizePhoto(raw: string | null): string | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    let decoded = trimmed;
    try {
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        decoded = JSON.parse(trimmed);
      }
    } catch {
      decoded = trimmed;
    }

    if (!decoded || decoded.length < 20) {
      return null;
    }

    if (decoded.startsWith('data:image/')) {
      return decoded;
    }

    return `data:image/jpeg;base64,${decoded}`;
  }

  openProfileModal(): void {
    this.profileModalOpen.set(true);
    this.closeUserDropdown();

    if (this.perfil()) {
      return;
    }

    this.profileLoading.set(true);
    this.http.get<MiPerfilDto>(`${environment.apiBaseUrl}/Usuario/MiPerfil`).subscribe({
      next: (data) => {
        this.perfil.set(data ?? {});
        this.profileLoading.set(false);
      },
      error: () => {
        this.perfil.set(null);
        this.profileLoading.set(false);
      }
    });
  }

  closeProfileModal(): void {
    this.profileModalOpen.set(false);
  }
}
