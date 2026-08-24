import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { ToastService, ToastType } from './core/services/toast.service';
import { AlertService, AlertType } from './core/services/alert.service';
import { BrandingService } from './core/services/administracion/branding.service';
import { ModalVisorComponent } from './components/modal-visor/modal-visor';

interface ToastState {
  open: boolean;
  type: ToastType;
  title: string;
  message: string;
}

interface AlertState {
  open: boolean;
  type: AlertType;
  title: string;
  message: string;
  okText: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ModalVisorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnDestroy {

  private toastService = inject(ToastService);
  private alertService = inject(AlertService);
  private brandingService = inject(BrandingService);

  // ===== TOAST =====
  readonly toast = signal<ToastState>({
    open: false,
    type: 'success',
    title: '',
    message: ''
  });

  private toastTimer?: ReturnType<typeof setTimeout>;
  private toastSub: Subscription;

  // ===== ALERT MODAL =====
  readonly alert = signal<AlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    okText: 'OK'
  });

  private alertSub: Subscription;

  constructor() {
    // Escucha TOAST global
    this.toastSub = this.toastService.toast$.subscribe(t => {
      this.toast.set({
        open: true,
        type: t.type,
        title: t.title,
        message: t.message
      });

      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.hideToast(), t.duration ?? 3500);
    });

    // Escucha ALERT MODAL global
    this.alertSub = this.alertService.alert$.subscribe(a => {
      this.alert.set({
        open: true,
        type: a.type,
        title: a.title,
        message: a.message,
        okText: a.okText ?? 'OK'
      });

      // Bloquear scroll del fondo mientras esté la alerta
      document.body.classList.add('ui-modal-open');
    });

    this.brandingService.getPublicConfig().subscribe({
      next: (cfg) => {
        this.applyFavicon(cfg?.faviconUrl ?? null);
        this.applyDocumentTitle(cfg?.sistema ?? cfg?.systemName ?? null);
      },
      error: () => {}
    });
  }

  private applyDocumentTitle(sigla: string | null): void {
    const title = (sigla ?? '').trim();
    document.title = title || 'SECAD';
  }

  private applyFavicon(faviconUrl: string | null): void {
    if (!faviconUrl) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel=\"icon\"]');
    if (link) {
      link.href = faviconUrl;
      return;
    }

    const newLink = document.createElement('link');
    newLink.rel = 'icon';
    newLink.href = faviconUrl;
    document.head.appendChild(newLink);
  }

  // ===== TOAST API =====
  hideToast(): void {
    this.toast.update(t => ({ ...t, open: false }));
  }

  // ===== ALERT API =====
  closeAlert(): void {
    this.alert.update(a => ({ ...a, open: false }));
    document.body.classList.remove('ui-modal-open');
  }

  // Cerrar con ESC (prioridad: alerta)
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.alert().open) this.closeAlert();
  }

  ngOnDestroy(): void {
    this.toastSub.unsubscribe();
    this.alertSub.unsubscribe();

    clearTimeout(this.toastTimer);
    document.body.classList.remove('ui-modal-open');
  }
}
