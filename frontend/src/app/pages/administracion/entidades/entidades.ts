import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import {
  FuerzaService,
  DtoFuerza, DtoFuerzaRequest,
  DtoCanalFuerza, DtoCanalRequest,
  DtoUsuarioEnFuerza
} from '../../../core/services/administracion/fuerza.service';

@Component({
  selector: 'app-entidades',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './entidades.html',
  styleUrls: ['./entidades.scss']
})
export class EntidadesComponent implements OnInit {

  // ── Estado general ─────────────────────────────────────────────────────────
  loading = false;
  saving  = false;

  // ── Lista de fuerzas ───────────────────────────────────────────────────────
  fuerzas: DtoFuerza[] = [];
  fuerzaSeleccionada: DtoFuerza | null = null;

  // ── Formulario de fuerza ───────────────────────────────────────────────────
  modoFuerza: 'ninguno' | 'nueva' | 'editando' = 'ninguno';
  formFuerza: DtoFuerzaRequest = { id: 0, descripcion: '', abreviatura: '', vigente: 'S' };

  // ── Canales ────────────────────────────────────────────────────────────────
  canales: DtoCanalFuerza[] = [];
  loadingCanales = false;
  modoCanal: 'ninguno' | 'nuevo' | 'editando' = 'ninguno';
  editingCanalCodigo: number | null = null;
  formCanal: DtoCanalRequest = { descripcion: '', vigente: 'S' };

  // ── Usuarios en fuerza ─────────────────────────────────────────────────────
  usuariosEnFuerza: DtoUsuarioEnFuerza[] = [];
  loadingUsuarios = false;

  // ── Tab activa en el detalle ───────────────────────────────────────────────
  tabDetalle: 'canales' | 'usuarios' = 'canales';

  constructor(
    private fuerzaService: FuerzaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargarFuerzas();
  }

  // ── Fuerzas ────────────────────────────────────────────────────────────────

  cargarFuerzas(): void {
    this.loading = true;
    this.fuerzaService.getFuerzas().subscribe({
      next: (r) => {
        this.fuerzas = r.data ?? [];
        this.loading = false;
        // Si había una fuerza seleccionada, refrescarla
        if (this.fuerzaSeleccionada) {
          const updated = this.fuerzas.find(f => f.id === this.fuerzaSeleccionada!.id);
          if (updated) this.fuerzaSeleccionada = updated;
        }
      },
      error: () => {
        this.loading = false;
        this.toast.error('Entidades', 'No se pudieron cargar las fuerzas.');
      }
    });
  }

  seleccionarFuerza(fuerza: DtoFuerza): void {
    this.fuerzaSeleccionada = fuerza;
    this.modoFuerza = 'ninguno';
    this.modoCanal  = 'ninguno';
    this.tabDetalle = 'canales';
    this.cargarCanales(fuerza.id);
    this.cargarUsuarios(fuerza.id);
  }

  nuevaFuerza(): void {
    this.fuerzaSeleccionada = null;
    this.modoFuerza = 'nueva';
    this.formFuerza = { id: 0, descripcion: '', abreviatura: '', vigente: 'S' };
    this.modoCanal  = 'ninguno';
  }

  editarFuerza(fuerza: DtoFuerza, event: Event): void {
    event.stopPropagation();
    this.fuerzaSeleccionada = fuerza;
    this.modoFuerza = 'editando';
    this.formFuerza = {
      id: fuerza.id,          // id fijo en edición (no editable)
      descripcion: fuerza.descripcion,
      abreviatura: fuerza.abreviatura ?? '',
      vigente: fuerza.vigente
    };
  }

  cancelarFuerza(): void {
    this.modoFuerza = 'ninguno';
    this.formFuerza = { id: 0, descripcion: '', abreviatura: '', vigente: 'S' };
  }

  guardarFuerza(): void {
    if (this.modoFuerza === 'nueva' && (!this.formFuerza.id || this.formFuerza.id <= 0)) {
      this.toast.warning('Guardar', 'El código de la fuerza es requerido y debe ser mayor que 0.');
      return;
    }
    if (!this.formFuerza.descripcion?.trim()) {
      this.toast.warning('Guardar', 'La descripción de la fuerza es requerida.');
      return;
    }
    this.saving = true;
    const req = { ...this.formFuerza, descripcion: this.formFuerza.descripcion.trim() };

    const op = this.modoFuerza === 'editando' && this.fuerzaSeleccionada
      ? this.fuerzaService.updateFuerza(this.fuerzaSeleccionada.id, req)
      : this.fuerzaService.createFuerza(req);

    op.subscribe({
      next: (r) => {
        this.saving = false;
        if (r.success) {
          this.toast.success('Fuerza', r.message);
          this.modoFuerza = 'ninguno';
          this.cargarFuerzas();
        } else {
          this.toast.warning('Fuerza', r.message);
        }
      },
      error: () => {
        this.saving = false;
        this.toast.error('Fuerza', 'Error al guardar la fuerza.');
      }
    });
  }

  toggleFuerza(fuerza: DtoFuerza, event: Event): void {
    event.stopPropagation();
    this.fuerzaService.toggleFuerza(fuerza.id).subscribe({
      next: (r) => {
        if (r.success) {
          this.toast.success('Estado', r.message);
          this.cargarFuerzas();
        } else {
          this.toast.warning('Estado', r.message);
        }
      },
      error: () => this.toast.error('Estado', 'Error al cambiar estado de la fuerza.')
    });
  }

  // ── Canales ────────────────────────────────────────────────────────────────

  cargarCanales(fuerzaId: number): void {
    this.loadingCanales = true;
    this.fuerzaService.getCanales(fuerzaId).subscribe({
      next: (r) => { this.canales = r.data ?? []; this.loadingCanales = false; },
      error: () => { this.loadingCanales = false; this.toast.error('Canales', 'Error al cargar canales.'); }
    });
  }

  nuevoCanal(): void {
    this.modoCanal = 'nuevo';
    this.editingCanalCodigo = null;
    this.formCanal = { descripcion: '', vigente: 'S' };
  }

  editarCanal(canal: DtoCanalFuerza): void {
    this.modoCanal = 'editando';
    this.editingCanalCodigo = canal.codigo;
    this.formCanal = { descripcion: canal.descripcion, vigente: canal.vigente };
  }

  cancelarCanal(): void {
    this.modoCanal = 'ninguno';
    this.editingCanalCodigo = null;
    this.formCanal = { descripcion: '', vigente: 'S' };
  }

  guardarCanal(): void {
    if (!this.fuerzaSeleccionada) return;
    if (!this.formCanal.descripcion?.trim()) {
      this.toast.warning('Canal', 'La descripción del canal es requerida.');
      return;
    }
    this.saving = true;
    const req = { ...this.formCanal, descripcion: this.formCanal.descripcion.trim() };
    const fuerzaId = this.fuerzaSeleccionada.id;

    const op = this.modoCanal === 'editando' && this.editingCanalCodigo !== null
      ? this.fuerzaService.updateCanal(fuerzaId, this.editingCanalCodigo, req)
      : this.fuerzaService.createCanal(fuerzaId, req);

    op.subscribe({
      next: (r) => {
        this.saving = false;
        if (r.success) {
          this.toast.success('Canal', r.message);
          this.cancelarCanal();
          this.cargarCanales(fuerzaId);
          this.cargarFuerzas();
        } else {
          this.toast.warning('Canal', r.message);
        }
      },
      error: () => {
        this.saving = false;
        this.toast.error('Canal', 'Error al guardar el canal.');
      }
    });
  }

  toggleCanal(canal: DtoCanalFuerza): void {
    if (!this.fuerzaSeleccionada) return;
    this.fuerzaService.toggleCanal(this.fuerzaSeleccionada.id, canal.codigo).subscribe({
      next: (r) => {
        if (r.success) {
          this.toast.success('Canal', r.message);
          this.cargarCanales(this.fuerzaSeleccionada!.id);
        } else {
          this.toast.warning('Canal', r.message);
        }
      },
      error: () => this.toast.error('Canal', 'Error al cambiar estado del canal.')
    });
  }

  // ── Usuarios ───────────────────────────────────────────────────────────────

  cargarUsuarios(fuerzaId: number): void {
    this.loadingUsuarios = true;
    this.fuerzaService.getUsuariosByFuerza(fuerzaId).subscribe({
      next: (r) => { this.usuariosEnFuerza = r.data ?? []; this.loadingUsuarios = false; },
      error: () => { this.loadingUsuarios = false; this.toast.error('Usuarios', 'Error al cargar usuarios.'); }
    });
  }

  setTab(tab: 'canales' | 'usuarios'): void {
    this.tabDetalle = tab;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  estaSeleccionada(fuerza: DtoFuerza): boolean {
    return this.fuerzaSeleccionada?.id === fuerza.id;
  }

  get conteoVigentes(): number { return this.fuerzas.filter(f => f.vigente === 'S').length; }
  get conteoTotal(): number    { return this.fuerzas.length; }
}
