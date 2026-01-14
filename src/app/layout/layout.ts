import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './../components/sidebar/sidebar';
import { HeaderComponent } from './../components/header/header';
import { FooterComponent } from './../components/footer/footer';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss'],
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    FooterComponent
  ]
})
export class LayoutComponent {
  isSidebarExpanded = false;

  onSidebarHover(isHovering: boolean): void {
    this.isSidebarExpanded = isHovering;
  }
}