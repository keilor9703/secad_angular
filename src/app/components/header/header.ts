import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, RouterModule,FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent {
  notifications: Notification[] = [
    { id: 1, icon: 'fa-bell', color: 'warning', count: 3, tooltip: 'Notificaciones' },
    { id: 2, icon: 'fa-envelope', color: 'info', count: 5, tooltip: 'Mensajes' },
    { id: 3, icon: 'fa-tasks', color: 'success', count: 2, tooltip: 'Tareas' },
    { id: 4, icon: 'fa-calendar-check', color: 'primary', count: 1, tooltip: 'Eventos' },
    { id: 5, icon: 'fa-chart-line', color: 'accent', count: 0, tooltip: 'Reportes' }
  ];

  searchQuery: string = '';
  userName: string = 'Usuario Oracle';
  userRole: string = 'OFTIC-GUSOF';

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
    console.log('Cerrando sesión');
  }
}