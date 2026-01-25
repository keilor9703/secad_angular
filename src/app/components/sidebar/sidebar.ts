import { Component, HostBinding, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarService } from '../../services/sidebar';

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
  expandedKey: string | null = null;


  submenuPos: { top: number; left: number } | null = null;

  private flyoutWidth = 240;
  private flyoutGap = 12;
  private flyoutMinViewportPadding = 10;

  constructor(public sidebarService: SidebarService) {}


  @HostBinding('class.expanded')
  get expanded() {
    return this.sidebarService.isOpen();
  }

  isOpen() {
    return this.sidebarService.isOpen();
  }

  isExpandedItem(item: MenuItem) {
    return this.expandedKey === item.label;
  }

  toggleItem(item: MenuItem, ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();

    const opening = !this.isExpandedItem(item);
    this.expandedKey = opening ? item.label : null;

    if (!opening) {
     this.submenuPos = null;
    return;
    }

    const target = ev.currentTarget as HTMLElement;
    const menuItemEl = target.closest('.menu-item') as HTMLElement | null;
    const menuLinkEl = menuItemEl?.querySelector('.menu-link') as HTMLElement | null;
    const sidebarEl = menuItemEl?.closest('aside.sidebar') as HTMLElement | null;

    if (!menuLinkEl || !sidebarEl) return;
    
    const linkRect = menuLinkEl.getBoundingClientRect();
    const sidebarRect = sidebarEl.getBoundingClientRect();
    
     const left = sidebarRect.right - this.flyoutGap;

  
    const top = linkRect.top;

    this.submenuPos = { top, left };

  }



  getSubmenuStyle() {
  if (!this.submenuPos) return {};
  return {
    top: `${this.submenuPos.top}px`,
    left: `${this.submenuPos.left}px`,
    width: `${this.flyoutWidth}px`,
  };
}
onItemTap(item: MenuItem, ev: MouseEvent) {
  if (item.submenu?.length) {
    ev.preventDefault();
    ev.stopPropagation();

    const opening = !this.isExpandedItem(item);
    this.expandedKey = opening ? item.label : null;

    if (!opening) {
      this.submenuPos = null;
      return;
    }

    const menuLinkEl = ev.currentTarget as HTMLElement;
    const menuItemEl = menuLinkEl.closest('.menu-item') as HTMLElement | null;
    const sidebarEl = menuItemEl?.closest('aside.sidebar') as HTMLElement | null;
    if (!sidebarEl) return;

    const linkRect = menuLinkEl.getBoundingClientRect();
    const sidebarRect = sidebarEl.getBoundingClientRect();

    const left = sidebarRect.right - this.flyoutGap;
    const top = linkRect.top;

    this.submenuPos = { top, left };
    return;
  }

  this.onNavigate();
}
  
  onNavigate() {
      this.sidebarService.closeSidebar();
      this.expandedKey = null;
      this.submenuPos = null;
  }

  closeSidebar() {
    this.sidebarService.closeSidebar();
    this.expandedKey = null;
    this.submenuPos = null;
    
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.sidebarService.isOpen()) this.sidebarService.closeSidebar();
  }

  menuItems: MenuItem[] = [
    { icon: 'fa-solid fa-house-user', label: 'Inicio', route: '/home' },
    { icon: 'fa-solid fa-cog', label: 'Administración', submenu: [{ label: 'Formularios', route: '/formularios' }] },
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