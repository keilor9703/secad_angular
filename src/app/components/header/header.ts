import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarService } from '../../services/sidebar.js';
import { AuthService } from '../../core/auth/auth.service';

interface Notification {
  id: number;
  icon: string;
  color: string;
  count: number;
  tooltip: string;
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

  constructor(
    private SidebarService: SidebarService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userName = this.authService.getUsuario();
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

  onSearch(): void {
    console.log('Buscando:', this.searchQuery);
  }

  onNotificationClick(notification: Notification): void {
    console.log('Notificación clickeada:', notification);
  }

  onProfileClick(): void {
    console.log('Perfil clickeado');
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
