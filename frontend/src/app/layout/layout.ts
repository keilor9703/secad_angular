import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../components/sidebar/sidebar';
import { HeaderComponent } from '../components/header/header';
import { FooterComponent } from '../components/footer/footer';
import { BreadcrumbComponent } from '../components/breadcrumb/breadcrumb';
import { AccessibilityMenuComponent, SocialDockGroup } from '../components/accessibility-menu/accessibility-menu';
import { SidebarService } from '../services/sidebar';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, FooterComponent, BreadcrumbComponent, AccessibilityMenuComponent],
})
export class LayoutComponent {
  socialGroups: SocialDockGroup[] = [];

  constructor(private sidebarService: SidebarService) {
    this.socialGroups = this.getFallbackSocialGroups();
  }

  isMenuOpen() {
    return this.sidebarService.isOpen();
  }

  closeMenu() {
    this.sidebarService.closeSidebar();
  }

  private getFallbackSocialGroups(): SocialDockGroup[] {
    return [
      {
        networkName: 'Facebook',
        icon: 'fa-facebook-f',
        color: '#1877F2',
        accounts: [{
          id: 1,
          networkName: 'Facebook',
          accountName: 'Policia Colombia',
          icon: 'fa-facebook-f',
          url: 'https://www.facebook.com/PoliciaColombia',
          color: '#1877F2'
        }]
      },
      {
        networkName: 'X',
        icon: 'fa-x-twitter',
        color: '#000000',
        accounts: [{
          id: 2,
          networkName: 'X',
          accountName: 'Policia Colombia',
          icon: 'fa-x-twitter',
          url: 'https://twitter.com/PoliciaColombia',
          color: '#000000'
        }]
      },
      {
        networkName: 'Instagram',
        icon: 'fa-instagram',
        color: '#E4405F',
        accounts: [{
          id: 3,
          networkName: 'Instagram',
          accountName: 'Policia Colombia',
          icon: 'fa-instagram',
          url: 'https://www.instagram.com/policiacolombia',
          color: '#E4405F'
        }]
      },
      {
        networkName: 'YouTube',
        icon: 'fa-youtube',
        color: '#FF0000',
        accounts: [{
          id: 4,
          networkName: 'YouTube',
          accountName: 'Policia Nacional Colombia',
          icon: 'fa-youtube',
          url: 'https://www.youtube.com/@PoliciaNacionalCol',
          color: '#FF0000'
        }]
      }
    ];
  }
}

