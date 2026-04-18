import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  DtoModalActivo,
  ModalService,
} from '../../core/services/administracion/modal.service';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-modal-visor',
  standalone: true,
  imports: [CommonModule, SafeUrlPipe],
  templateUrl: './modal-visor.html',
  styleUrls: ['./modal-visor.scss'],
})
export class ModalVisorComponent implements OnInit, OnDestroy {
  modales: DtoModalActivo[] = [];
  indiceActual = 0;
  visible = false;

  private static readonly SESSION_KEY = 'modales_vistos';
  private routerSub!: Subscription;
  private delay?: ReturnType<typeof setTimeout>;

  get modal(): DtoModalActivo | null {
    return this.modales[this.indiceActual] ?? null;
  }

  get esImagen(): boolean { return this.modal?.tipoRecurso?.toUpperCase() === 'IMAGEN'; }
  get esVideo(): boolean  { return this.modal?.tipoRecurso?.toUpperCase() === 'VIDEO';  }
  get videoMimeType(): string {
    const ruta = this.modal?.rutaRecurso ?? '';
    if (ruta.endsWith('.webm')) return 'video/webm';
    if (ruta.endsWith('.mov'))  return 'video/quicktime';
    return 'video/mp4';
  }
  get requiereAceptar(): boolean {
    return this.modal?.tipoAccion === 'ACEPTAR' || this.modal?.tipoAccion === 'CONFIRMAR';
  }

  constructor(private modalService: ModalService, private router: Router) {}

  ngOnInit(): void {
    // Escucha navegaciones y dispara solo cuando lleguemos al home
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const url = e.urlAfterRedirects ?? e.url;
        if (url === '/home' || url === '/home;' || url.startsWith('/home?')) {
          this.intentarMostrar();
        }
      });

    // También dispara si ya estamos en home al cargar el componente
    const url = this.router.url;
    if (url === '/home' || url.startsWith('/home?') || url.startsWith('/home;')) {
      this.intentarMostrar();
    }
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    clearTimeout(this.delay);
  }

  aceptar(): void {
    this.registrar('ACEPTAR');
    this.avanzar();
  }

  cerrar(): void {
    this.registrar('CERRAR');
    this.avanzar();
  }

  private intentarMostrar(): void {
    if (sessionStorage.getItem(ModalVisorComponent.SESSION_KEY)) return;
    if (this.visible) return;

    clearTimeout(this.delay);
    this.delay = setTimeout(() => this.cargar(), 2000);
  }

  private cargar(): void {
    this.modalService.getActivos().subscribe({
      next: (data) => {
        this.modales = data ?? [];
        console.log('[ModalVisor] modales activos:', this.modales);
        if (this.modales.length > 0) {
          this.indiceActual = 0;
          this.visible = true;
          this.registrar('VISTA');
        }
      },
      error: (err) => console.error('[ModalVisor] error cargando activos:', err)
    });
  }

  private avanzar(): void {
    if (this.indiceActual < this.modales.length - 1) {
      this.indiceActual++;
      this.registrar('VISTA');
    } else {
      this.visible = false;
      sessionStorage.setItem(ModalVisorComponent.SESSION_KEY, '1');
    }
  }

  onVideoError(event: Event): void {
    console.error('Error cargando video del modal:', this.modal?.rutaRecurso, event);
  }

  private registrar(accion: string): void {
    if (!this.modal) return;
    this.modalService.registrarInteraccion({
      IdModal: this.modal.idModal,
      TipoAccion: accion,
    }).subscribe({ error: () => {} });
  }
}
