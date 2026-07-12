import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

interface BreadcrumbItem {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="breadcrumb-nav" *ngIf="items.length > 0">
      <ol class="breadcrumb-list">
        <li class="breadcrumb-item" *ngFor="let item of items; let last = last">
          <ng-container *ngIf="!last && item.route">
            <a [routerLink]="item.route" class="breadcrumb-link">{{ item.label }}</a>
            <i class="fa-solid fa-chevron-right breadcrumb-separator"></i>
          </ng-container>
          <ng-container *ngIf="last">
            <span class="breadcrumb-current">{{ item.label }}</span>
          </ng-container>
          <ng-container *ngIf="!last && !item.route">
            <span class="breadcrumb-link">{{ item.label }}</span>
            <i class="fa-solid fa-chevron-right breadcrumb-separator"></i>
          </ng-container>
        </li>
      </ol>
    </nav>
  `,
  styles: [`
    .breadcrumb-nav {
      padding: 12px 20px;
      background: var(--ui-bg, rgba(21, 27, 59, 0.03));
      border-bottom: 1px solid var(--ui-border, rgba(21, 27, 59, 0.08));
    }
    .breadcrumb-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .breadcrumb-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .breadcrumb-link {
      color: var(--ui-muted, #002a66);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: color 0.2s;
    }
    .breadcrumb-link:hover {
      color: var(--policia-cielo, #0a1929);
      text-decoration: underline;
    }
    .breadcrumb-current {
      color: var(--ui-text, rgba(21, 27, 59, 0.7));
      font-size: 13px;
      font-weight: 600;
    }
    .breadcrumb-separator {
      font-size: 10px;
      color: var(--ui-muted, rgba(21, 27, 59, 0.4));
      margin: 0 2px;
    }
  `]
})
export class BreadcrumbComponent {
  items: BreadcrumbItem[] = [];

  private routeLabels: Record<string, string> = {
    '/home': 'Inicio',
    '/administracion': 'Administración',
    '/administracion/usuarios': 'Usuarios',
    '/administracion/roles': 'Roles',
    '/administracion/formularios': 'Formularios',
    '/administracion/sliders': 'Sliders',
    '/administracion/radio': 'Radio',
    '/administracion/dominio': 'Dominios',
    '/administracion/menu': 'Menú',
    '/administracion/configuracion-sistema': 'Configuración Sistema',
    '/administracion/admin-multimedia': 'Configuración Sistema',
    '/administracion/video-unidad': 'Configuración Sistema',
    '/administracion/configuracion-imagen-sitio': 'Configuración Sistema',
    '/noticias': 'Noticias'
  };

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.buildBreadcrumb());
    
    this.buildBreadcrumb();
  }

  private buildBreadcrumb(): void {
    const url = this.router.url;
    const segments = url.split('/').filter(Boolean);
    this.items = [];

    // Always add Home as first item
    this.items.push({
      label: 'Inicio',
      route: '/home'
    });

    let currentPath = '';
    
    for (let i = 0; i < segments.length; i++) {
      currentPath += '/' + segments[i];
      const label = this.routeLabels[currentPath] || this.formatLabel(segments[i]);
      
      const isLast = i === segments.length - 1;
      
      // Skip adding if it's home (already added)
      if (currentPath === '/home') {
        continue;
      }
      
      this.items.push({
        label,
        route: isLast ? undefined : currentPath
      });
    }
  }

  private formatLabel(segment: string): string {
    return segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

