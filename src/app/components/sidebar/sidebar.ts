import { Component, HostBinding, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarService } from '../../services/sidebar';
import { MenuService, DbMenuItem } from '../../core/services/menu.service';
import { AuthService } from '../../core/auth/auth.service';

interface SubMenuItem {
  id: number;
  label: string;
  route: string;
}

interface MenuItem {
  id: number;
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
export class SidebarComponent implements OnInit {
  expandedKey: string | null = null;


  submenuPos: { top: number; left: number } | null = null;

  private flyoutWidth = 240;
  private flyoutGap = 12;
  private flyoutMinViewportPadding = 10;

  constructor(
    public sidebarService: SidebarService,
    private menuService: MenuService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMenuFromDb();
  }


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

  menuItems: MenuItem[] = [];

  private loadMenuFromDb(): void {
    this.menuService.getMyMenu().subscribe({
      next: (items) => {
        if (!items || items.length === 0) {
          this.loadMenuByUserFallback();
          return;
        }
        const mapped = this.mapDbMenu(items);
        this.menuItems = this.groupAdministrationItems(mapped);
      },
      error: () => {
        this.loadMenuByUserFallback();
      }
    });
  }

  private loadMenuByUserFallback(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.menuItems = [];
      return;
    }

    this.menuService.getByUser(userId).subscribe({
      next: (items) => {
        this.menuItems = this.groupAdministrationItems(this.mapDbMenu(items));
      },
      error: () => {
        this.menuItems = [];
      }
    });
  }

  private mapDbMenu(items: DbMenuItem[]): MenuItem[] {
    const normalized = (items ?? []).map((x: any) => ({
      idMenu: Number(x.idMenu ?? x.IdMenu ?? 0),
      descripcion: String(x.descripcion ?? x.Descripcion ?? ''),
      idPadre: Number(x.idPadre ?? x.IdPadre ?? 0),
      posicion: Number(x.posicion ?? x.Posicion ?? 0),
      icono: x.icono ?? x.Icono,
      detalle: x.detalle ?? x.Detalle,
      vigente: Number(x.vigente ?? x.Vigente ?? 1)
    }));

    const active = normalized.filter(x => !!x.descripcion && x.vigente === 1);
    const byId = new Map(active.map(x => [x.idMenu, x]));

    // Soporta 3 esquemas de raíz:
    // 1) idPadre=0
    // 2) padre no presente
    // 3) raíz técnica con autoreferencia (idPadre === idMenu), p.ej. RAIZ.
    const selfRootIds = new Set(
      active.filter(x => x.idPadre === x.idMenu).map(x => x.idMenu)
    );

    const parents = active
      .filter(x => {
        if (selfRootIds.size > 0) {
          // Si existe raíz técnica, los padres reales son sus hijos directos.
          return selfRootIds.has(x.idPadre) && !selfRootIds.has(x.idMenu);
        }
        return !x.idPadre || x.idPadre === 0 || !byId.has(x.idPadre);
      })
      .sort((a, b) => a.posicion - b.posicion);

    if (parents.length === 0) {
      return [];
    }

    const topLevel = parents.map(parent => {
      const directChildren = active
        .filter(child => child.idPadre === parent.idMenu)
        .sort((a, b) => a.posicion - b.posicion);

      const subs = directChildren
        .map(child => ({
          id: child.idMenu,
          label: child.descripcion,
          route: this.normalizeRoute(child.detalle)
        }))
        .filter(sub => !!sub.route);

      const route = this.normalizeRoute(parent.detalle);
      const icon = this.normalizeIcon(parent.icono);

      if (subs.length > 0) {
        return {
          id: parent.idMenu,
          icon,
          label: parent.descripcion,
          submenu: subs
        } as MenuItem;
      }

      // Si no hay hijos y no hay ruta, no se renderiza (nodo contenedor huérfano).
      if (!route) {
        return null;
      }

      return {
        id: parent.idMenu,
        icon,
        label: parent.descripcion,
        route
      } as MenuItem;
    });

    return topLevel.filter((x): x is MenuItem => x !== null);
  }

  private normalizeRoute(raw: unknown): string {
    const value = String(raw ?? '').trim();
    if (!value) {
      return '';
    }
    const normalized = value.startsWith('/') ? value : `/${value}`;
    if (normalized === '/formularios') {
      return '/administracion/formularios';
    }
    if (normalized === '/usuarios') {
      return '/administracion/usuarios';
    }
    return normalized;
  }

  private normalizeIcon(raw: unknown): string {
    const value = String(raw ?? '').trim();
    if (!value) {
      return 'fa-solid fa-folder';
    }
    return value.includes('fa-') ? value : `fa-solid ${value}`;
  }

  private groupAdministrationItems(items: MenuItem[]): MenuItem[] {
    const kept: MenuItem[] = [];
    const adminSubmenu: SubMenuItem[] = [];

    for (const item of items) {
      // Caso menú simple: item directo con ruta de administración.
      if (item.route && this.isAdministrationRoute(item.route)) {
        adminSubmenu.push({ id: item.id, label: item.label, route: item.route });
        continue;
      }

      // Caso menú con submenús: separa los de administración.
      if (item.submenu?.length) {
        const adminSubs = item.submenu.filter((sub) => this.isAdministrationRoute(sub.route));
        const normalSubs = item.submenu.filter((sub) => !this.isAdministrationRoute(sub.route));

        adminSubmenu.push(...adminSubs);

        if (normalSubs.length > 0) {
          kept.push({ ...item, submenu: normalSubs });
        } else if (item.route && !this.isAdministrationRoute(item.route)) {
          kept.push({ ...item, submenu: undefined });
        }
        continue;
      }

      kept.push(item);
    }

    const dedupedAdmin = adminSubmenu.filter(
      (sub, idx, arr) => arr.findIndex((x) => x.route === sub.route) === idx
    );

    if (dedupedAdmin.length > 0) {
      kept.unshift({
        id: 999001,
        icon: 'fa-solid fa-user-shield',
        label: 'Administración',
        submenu: dedupedAdmin.sort((a, b) => a.label.localeCompare(b.label))
      });
    }

    return kept;
  }

  private isAdministrationRoute(route: string): boolean {
    return (
      route.startsWith('/administracion/') ||
      route === '/formularios' ||
      route === '/usuarios'
    );
  }
  
}
