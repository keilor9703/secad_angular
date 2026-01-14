import { Component, HostBinding, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface SubMenuItem {
  label: string;
  route: string;
}

interface MenuItem {
  icon: string;
  label: string;
  route?: string;
  submenu?: SubMenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent {
  @Output() hoverState = new EventEmitter<boolean>();
  @HostBinding('class.expanded') isExpanded = false;

  onMouseEnter() {
    this.isExpanded = true;
    this.hoverState.emit(true);
  }

  onMouseLeave() {
    this.isExpanded = false;
    this.hoverState.emit(false);
  }

 menuItems: MenuItem[] = [
  {
    icon: 'fa-solid fa-house-user',
    label: 'Inicio',
    route: '/home',          // <-- ruta directa
  },
  {
    icon: 'fa-solid fa-cog',
    label: 'Administración',
    submenu: [{ label: 'Formularios', route: '/formularios' }],
  },
  {
    icon: 'fa-solid fa-file-invoice-dollar',
    label: 'Facturación',
    submenu: [
      { label: 'Nueva Factura', route: '/factura/nueva' },
      { label: 'Historial', route: '/factura/historial' },
    ],
  },
];
}
