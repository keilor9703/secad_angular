import { Component, DestroyRef, OnInit, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  DtoModalActivo,
  ModalService,
} from '../../core/services/administracion/modal.service';
import { environment } from '../../../environments/environment';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-modal-visor',
  standalone: true,
  imports: [SafeUrlPipe],
  templateUrl: './modal-visor.html',
  styleUrls: ['./modal-visor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalVisorComponent implements OnInit {
  private readonly modalService = inject(ModalService);
  private readonly router       = inject(Router);

  readonly modal   = signal<DtoModalActivo | null>(null);
  readonly visible = signal(false);

  private static readonly SESSION_KEY = 'modales_vistos';
  private delay?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.delay));
  }

  readonly resourceUrl = computed(() => {
    let raw = (this.modal()?.rutaRecurso ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('http') || raw.startsWith('data:')) return raw;

    const baseUrl = environment.sliderMediaBaseUrl;
    if (raw.startsWith('/')) {
      return `${baseUrl}${raw}`;
    }
    // Si viene solo el nombre, intentamos la ruta estándar de modales
    return `${baseUrl}/uploads/modales/${raw}`;
  });

  readonly esImagen = computed(() => this.modal()?.tipoRecurso?.toUpperCase() === 'IMAGEN');
  readonly esVideo  = computed(() => this.modal()?.tipoRecurso?.toUpperCase() === 'VIDEO');

  readonly videoMimeType = computed(() => {
    const ruta = this.modal()?.rutaRecurso ?? '';
    if (ruta.endsWith('.webm')) return 'video/webm';
    if (ruta.endsWith('.mov'))  return 'video/quicktime';
    return 'video/mp4';
  });

  readonly requiereAceptar = computed(() => {
    const m = this.modal();
    return m?.tipoAccion === 'ACEPTAR' || m?.tipoAccion === 'CONFIRMAR';
  });

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((e: NavigationEnd) => {
        const url = e.urlAfterRedirects ?? e.url;
        if (url === '/home' || url === '/home;' || url.startsWith('/home?')) {
          this.intentarMostrar();
        }
      });

    const url = this.router.url;
    if (url === '/home' || url.startsWith('/home?') || url.startsWith('/home;')) {
      this.intentarMostrar();
    }
  }

  aceptar(): void {
    this.registrar('ACEPTAR');
    this.cerrarModal();
  }

  cerrar(): void {
    this.registrar('CERRAR');
    this.cerrarModal();
  }

  onVideoError(event: Event): void {
    console.error('Error cargando video del modal:', this.resourceUrl(), event);
  }

  private intentarMostrar(): void {
    if (sessionStorage.getItem(ModalVisorComponent.SESSION_KEY)) return;
    if (this.visible()) return;

    clearTimeout(this.delay);
    this.delay = setTimeout(() => this.cargar(), 2000);
  }

  private cargar(): void {
    this.modalService.getActivos().subscribe({
      next: (data) => {
        const activo = data?.[0] ?? null;
        if (activo) {
          this.modal.set(activo);
          this.visible.set(true);
          this.registrar('VISTA');
        }
      },
      error: (err) => console.error('[ModalVisor] error cargando activos:', err)
    });
  }

  private cerrarModal(): void {
    this.visible.set(false);
    this.modal.set(null);
    sessionStorage.setItem(ModalVisorComponent.SESSION_KEY, '1');
  }

  private registrar(accion: string): void {
    const m = this.modal();
    if (!m) return;
    this.modalService.registrarInteraccion({
      IdModal: m.idModal,
      TipoAccion: accion,
    }).subscribe({ error: () => {} });
  }
}
