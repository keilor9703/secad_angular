import { Component, HostBinding, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarService } from '../../services/sidebar';
import { MenuService, DbMenuItem } from '../../core/services/menu.service';
import { AuthService } from '../../core/auth/auth.service';
import { BrandingService } from '../../core/services/branding.service';

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
    private authService: AuthService,
    private brandingService: BrandingService
  ) {}

  ngOnInit(): void {
    this.loadBranding();
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
  systemName = 'OFTIC';
  logoUrl = '/imagenes/oftic-logo-app.png';

  private loadBranding(): void {
    this.brandingService.getPublicConfig().subscribe({
      next: (cfg) => {
        const name = (cfg?.systemName ?? '').trim();
        this.systemName = name || 'OFTIC';
        this.logoUrl = (cfg?.logoUrl ?? '').trim() || '/imagenes/oftic-logo-app.png';
      },
      error: () => {
        this.systemName = 'OFTIC';
        this.logoUrl = '/imagenes/oftic-logo-app.png';
      }
    });
  }

  private loadMenuFromDb(): void {
    this.menuService.getMyMenu().subscribe({
      next: (items) => {
        if (!items || items.length === 0) {
          this.loadMenuByUserFallback();
          return;
        }
        const mapped = this.mapDbMenu(items);
        this.menuItems = this.ensureInicioItem(this.groupAdministrationItems(mapped));
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
        this.menuItems = this.ensureInicioItem(this.groupAdministrationItems(this.mapDbMenu(items)));
      },
      error: () => {
        this.menuItems = this.ensureInicioItem([]);
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
          route: this.normalizeRoute(child.detalle),
          label: this.normalizeLabel(child.descripcion, this.normalizeRoute(child.detalle))
        }))
        .filter(sub => !!sub.route);

      const route = this.normalizeRoute(parent.detalle);
      const label = this.normalizeLabel(parent.descripcion, route);
      const icon = this.normalizeIcon(parent.icono);

      if (subs.length > 0) {
        return {
          id: parent.idMenu,
          icon,
          label,
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
        label,
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
    if (normalized === '/roles') {
      return '/administracion/roles';
    }
    if (normalized === '/video-unidad') {
      return '/administracion/admin-multimedia';
    }
    if (normalized === '/configuracion-imagen-sitio') {
      return '/administracion/admin-multimedia';
    }
    if (normalized === '/admin-multimedia') {
      return '/administracion/admin-multimedia';
    }
    return normalized;
  }

  private normalizeLabel(label: string, route: string): string {
    if (
      route === '/administracion/admin-multimedia' ||
      route === '/administracion/video-unidad' ||
      route === '/administracion/configuracion-imagen-sitio' ||
      route === '/video-unidad' ||
      route === '/configuracion-imagen-sitio' ||
      route === '/admin-multimedia'
    ) {
      return 'Configuración imagen del sitio';
    }
    return label;
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
      route === '/usuarios' ||
      route === '/roles' ||
      route === '/video-unidad' ||
      route === '/configuracion-imagen-sitio' ||
      route === '/admin-multimedia'
    );
  }

  private ensureInicioItem(items: MenuItem[]): MenuItem[] {
    if (!this.authService.isAuthenticated()) {
      return items;
    }

    const inicioIndex = items.findIndex((item) => item.route === '/home' || item.label.toLowerCase() === 'inicio');
    if (inicioIndex >= 0) {
      const inicio = {
        ...items[inicioIndex],
        route: '/home'
      };
      const rest = items.filter((_, idx) => idx !== inicioIndex);
      return [inicio, ...rest];
    }

    return [
      {
        id: 999000,
        icon: 'fa-solid fa-house',
        label: 'Inicio',
        route: '/home'
      },
      ...items
    ];
  }
  
}
