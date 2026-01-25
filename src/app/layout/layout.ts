import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../components/sidebar/sidebar';
import { HeaderComponent } from '../components/header/header';
import { FooterComponent } from '../components/footer/footer';
import { SidebarService } from '../services/sidebar';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, FooterComponent],
})
export class LayoutComponent {
  constructor(private sidebarService: SidebarService) {}

  isMenuOpen() {
    return this.sidebarService.isOpen();
  }

  closeMenu() {
    this.sidebarService.closeSidebar();
  }
}
