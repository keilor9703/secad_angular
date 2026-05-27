import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  AnotacionTurnoService,
  AnotacionTurno,
  AnotacionTurnoRequest,
  TIPOS_ANOTACION
} from '../../../core/services/operacion/anotacion-turno.service';

@Component({
  selector: 'app-anotaciones-turno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anotaciones-turno.html',
  styleUrls: ['./anotaciones-turno.scss']
})
export class AnotacionesTurnoComponent implements OnInit {

  private svc   = inject(AnotacionTurnoService);
  private auth  = inject(AuthService);
  private toast = inject(ToastService);

  // ─── Estado de la lista ──────────────────────────────────────────────────
  anotaciones:     AnotacionTurno[] = [];
  cargando         = false;
  errorCarga       = '';

  // ─── Filtros ─────────────────────────────────────────────────────────────
  filtroTipo   = '';
  filtroDesde  = this.hoyISO();
  filtroHasta  = this.hoyISO();

  // ─── Formulario ──────────────────────────────────────────────────────────
  modoEdicion         = false;
  editandoId: number | null = null;
  guardando           = false;

  form: AnotacionTurnoRequest = this.formVacio();

  // ─── JWT claims ──────────────────────────────────────────────────────────
  canalCodigo = 0;
  sitioGraba  = 0;
  fuerzaId    = 0;

  // ─── Catálogo de tipos ───────────────────────────────────────────────────
  readonly tipos = TIPOS_ANOTACION;

  // ─── Modal de confirmación de borrado ────────────────────────────────────
  itemAEliminar: AnotacionTurno | null = null;
  eliminando = false;

  // ─── Paginación ──────────────────────────────────────────────────────────
  p        = 1;
  pageSize = 15;

  get anotacionesFiltradas(): AnotacionTurno[] {
    if (!this.filtroTipo) return this.anotaciones;
    return this.anotaciones.filter(a => a.tipo === this.filtroTipo);
  }

  get paginadas(): AnotacionTurno[] {
    const start = (this.p - 1) * this.pageSize;
    return this.anotacionesFiltradas.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.anotacionesFiltradas.length / this.pageSize));
  }

  nextPage() { if (this.p < this.totalPages) this.p++; }
  prevPage() { if (this.p > 1) this.p--; }

  // ────────────────────────────────────────────────────────────────────────
  //  INIT
  // ────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const claims    = this.auth.getJwtClaims();
    this.canalCodigo = claims.canalId    ?? 0;
    this.sitioGraba  = claims.sitioGraba ?? 0;
    this.fuerzaId    = claims.fuerzaId   ?? 0;
    this.cargar();
  }

  // ────────────────────────────────────────────────────────────────────────
  //  CARGAR
  // ────────────────────────────────────────────────────────────────────────

  cargar(): void {
    this.cargando  = true;
    this.errorCarga = '';
    this.p = 1;

    this.svc.getList({
      canal: this.canalCodigo || undefined,
      sitio: this.sitioGraba  || undefined,
      desde: this.filtroDesde || undefined,
      hasta: this.filtroHasta || undefined,
    }).subscribe({
      next: (r) => {
        this.anotaciones = r.data ?? [];
        this.cargando    = false;
      },
      error: () => {
        this.cargando  = false;
        this.errorCarga = 'No se pudo cargar la bitácora.';
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  //  GUARDAR (crear / actualizar)
  // ────────────────────────────────────────────────────────────────────────

  guardar(): void {
    if (!this.form.descripcion?.trim()) {
      this.toast.warning('Campo requerido', 'Ingresa la descripción de la anotación.');
      return;
    }
    this.guardando = true;

    const req: AnotacionTurnoRequest = {
      ...this.form,
      canalCodigo: this.canalCodigo || undefined,
      fuerzaId:    this.fuerzaId    || undefined,
      sitioGraba:  this.sitioGraba  || undefined,
    };

    const op$ = this.modoEdicion && this.editandoId
      ? this.svc.update(this.editandoId, req)
      : this.svc.create(req);

    op$.subscribe({
      next: (r) => {
        this.guardando = false;
        if (r.success) {
          this.toast.success(
            this.modoEdicion ? 'Actualizada' : 'Registrada',
            r.message ?? 'Anotación guardada.'
          );
          this.cancelar();
          this.cargar();
        } else {
          this.toast.error('Error', r.message ?? 'No se pudo guardar.');
        }
      },
      error: (e) => {
        this.guardando = false;
        this.toast.error('Error', e.error?.message ?? 'No se pudo guardar la anotación.');
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  //  EDITAR
  // ────────────────────────────────────────────────────────────────────────

  editar(item: AnotacionTurno): void {
    this.modoEdicion = true;
    this.editandoId  = item.id;
    this.form = {
      tipo:        item.tipo,
      titulo:      item.titulo ?? '',
      descripcion: item.descripcion,
    };
    // Scroll al formulario
    setTimeout(() => {
      document.getElementById('formAnotacion')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  cancelar(): void {
    this.modoEdicion = false;
    this.editandoId  = null;
    this.form        = this.formVacio();
  }

  // ────────────────────────────────────────────────────────────────────────
  //  ELIMINAR
  // ────────────────────────────────────────────────────────────────────────

  solicitarEliminar(item: AnotacionTurno): void {
    this.itemAEliminar = item;
  }

  cancelarEliminar(): void {
    this.itemAEliminar = null;
  }

  confirmarEliminar(): void {
    if (!this.itemAEliminar || this.eliminando) return;
    this.eliminando = true;

    this.svc.delete(this.itemAEliminar.id).subscribe({
      next: (r) => {
        this.eliminando    = false;
        this.itemAEliminar = null;
        if (r.success) {
          this.toast.success('Eliminada', 'La anotación fue eliminada.');
          this.cargar();
        } else {
          this.toast.error('Error', r.message ?? 'No se pudo eliminar.');
        }
      },
      error: () => {
        this.eliminando = false;
        this.toast.error('Error', 'No se pudo eliminar la anotación.');
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  //  HELPERS
  // ────────────────────────────────────────────────────────────────────────

  getTipoInfo(tipo: string) { return this.svc.getTipoInfo(tipo); }

  private formVacio(): AnotacionTurnoRequest {
    return { tipo: 'GENERAL', titulo: '', descripcion: '' };
  }

  private hoyISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  contarPorTipo(tipo: string): number {
    return this.anotaciones.filter(a => a.tipo === tipo).length;
  }
}
