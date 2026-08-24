import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SidebarComponent } from '../components/sidebar/sidebar';
import { HeaderComponent } from '../components/header/header';
import { FooterComponent } from '../components/footer/footer';
import { BreadcrumbComponent } from '../components/breadcrumb/breadcrumb';
import { AccessibilityMenuComponent } from '../components/accessibility-menu/accessibility-menu';
import { ContextBannerComponent } from '../components/context-banner/context-banner';
import { SidebarService } from '../services/sidebar';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, FooterComponent, BreadcrumbComponent, AccessibilityMenuComponent, ContextBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent {
  private readonly sidebarService = inject(SidebarService);

  isMenuOpen() {
    return this.sidebarService.isOpen();
  }

  closeMenu() {
    this.sidebarService.closeSidebar();
  }
}
