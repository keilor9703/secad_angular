import { Injectable, signal } from '@angular/core';


@Injectable({ providedIn: 'root' })
export class SidebarService {
  private _open = signal(false);
  private _closeTick = signal(0);

  isOpen() {
    return this._open();
  }
 closeTick() { return this._closeTick(); }
  openSidebar() {
    this._open.set(true);
    document.body.classList.add('no-scroll');
  }

  closeSidebar() {
      this._open.set(false);
      this._closeTick.update(v => v + 1); 
      document.body.classList.remove('no-scroll');
  }

  toggleSidebar() {
    this.isOpen() ? this.closeSidebar() : this.openSidebar();
  }

  
 
}

