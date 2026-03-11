import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarService } from '../../services/sidebar.js';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { BrandingService } from '../../core/services/branding.service';

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
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent implements OnInit {
  isUserDropdownOpen = false;
  userPhotoUrl: string | null = null;
  profileModalOpen = false;
  profileLoading = false;
  perfil: MiPerfilDto | null = null;

  constructor(
    private SidebarService: SidebarService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private brandingService: BrandingService
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getUsuario();
    this.loadBranding();
    this.loadMyPhoto();
  }

  toggleMenu() {
    this.SidebarService.toggleSidebar();
  }

  toggleUserDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }

  closeUserDropdown(): void {
    this.isUserDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isUserDropdownOpen) {
      const target = event.target as HTMLElement;
      if (!target.closest('.header-user')) {
        this.closeUserDropdown();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserDropdown();
  }

  notifications: Notification[] = [
    { id: 1, icon: 'fa-bell', color: 'warning', count: 3, tooltip: 'Notificaciones' },
    { id: 2, icon: 'fa-envelope', color: 'info', count: 5, tooltip: 'Mensajes' },
    { id: 3, icon: 'fa-tasks', color: 'success', count: 2, tooltip: 'Tareas' },
    { id: 4, icon: 'fa-calendar-check', color: 'primary', count: 1, tooltip: 'Eventos' },
    { id: 5, icon: 'fa-chart-line', color: 'accent', count: 0, tooltip: 'Reportes' }
  ];

  searchQuery: string = '';
  userName: string = 'Usuario';
  userRole: string = 'SISGE';

  private loadBranding(): void {
    this.brandingService.getPublicConfig().subscribe({
      next: (cfg) => {
        const sigla = (cfg?.sistema ?? cfg?.systemName ?? '').trim();
        this.userRole = sigla || 'SISGE';
      },
      error: () => {
        this.userRole = 'SISGE';
      }
    });
  }

  onSearch(): void {
    console.log('Buscando:', this.searchQuery);
  }

  onNotificationClick(notification: Notification): void {
    console.log('Notificación clickeada:', notification);
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
          this.userPhotoUrl = this.normalizePhoto(raw);
        },
        error: () => {
          this.userPhotoUrl = null;
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
    this.profileModalOpen = true;
    this.closeUserDropdown();

    if (this.perfil) {
      return;
    }

    this.profileLoading = true;
    this.http.get<MiPerfilDto>(`${environment.apiBaseUrl}/Usuario/MiPerfil`).subscribe({
      next: (data) => {
        this.perfil = data ?? {};
        this.profileLoading = false;
      },
      error: () => {
        this.perfil = null;
        this.profileLoading = false;
      }
    });
  }

  closeProfileModal(): void {
    this.profileModalOpen = false;
  }
}
