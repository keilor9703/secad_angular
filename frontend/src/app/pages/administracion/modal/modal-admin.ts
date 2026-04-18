import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import {
  ModalService,
  DtoModal,
  DtoModalRequest,
  DtoModalInteraccion,
} from '../../../core/services/administracion/modal.service';

@Component({
  selector: 'app-modal-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-admin.html',
  styleUrls: ['./modal-admin.scss'],
})
export class ModalAdminComponent implements OnInit {
  minimized = false;
  loading = false;
  saving = false;

  lista: DtoModal[] = [];
  editingId: number | null = null;

  form: DtoModalRequest = this.formVacio();

  // Upload de recurso
  uploadingRecurso = false;
  recursoPreviewUrl = '';

  // Panel de auditoría
  auditoria: DtoModalInteraccion[] = [];
  auditoriaTitulo = '';
  loadingAuditoria = false;
  mostrarAuditoria = false;

  readonly tiposRecurso = ['TEXTO', 'IMAGEN', 'VIDEO'];
  readonly tiposAccion = ['INFO', 'ACEPTAR', 'CONFIRMAR'];

  constructor(
    private toast: ToastService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.modalService.getAll().subscribe({
      next: (data) => {
        this.lista = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error', 'No se pudieron cargar los modales');
      },
    });
  }

  nuevo(): void {
    this.editingId = null;
    this.form = this.formVacio();
    this.recursoPreviewUrl = '';
  }

  editar(item: DtoModal): void {
    this.editingId = item.idModal;
    this.form = {
      Titulo: item.titulo,
      Descripcion: item.descripcion,
      TipoRecurso: item.tipoRecurso,
      RutaRecurso: item.rutaRecurso,
      TipoAccion: item.tipoAccion,
      FechaInicio: item.fechaInicio?.substring(0, 16) ?? '',
      FechaFin: item.fechaFin?.substring(0, 16) ?? '',
      Unidad: item.unidad,
      Orden: item.orden,
      Vigente: item.vigente,
    };
    this.recursoPreviewUrl = item.rutaRecurso ?? '';
  }

  guardar(): void {
    if (!this.form.Titulo?.trim()) {
      this.toast.warning('Guardar', 'El título es requerido');
      return;
    }
    if (!this.form.FechaInicio || !this.form.FechaFin) {
      this.toast.warning('Guardar', 'Las fechas de vigencia son requeridas');
      return;
    }
    if (this.form.FechaFin < this.form.FechaInicio) {
      this.toast.warning('Guardar', 'La fecha fin no puede ser menor a la fecha inicio');
      return;
    }

    this.saving = true;
    const payload = {
      ...this.form,
      FechaInicio: this.normalizarFecha(this.form.FechaInicio),
      FechaFin:    this.normalizarFecha(this.form.FechaFin),
    };
    const op$ = this.editingId
      ? this.modalService.update(this.editingId, payload)
      : this.modalService.create(payload);

    op$.subscribe({
      next: (resp) => {
        this.saving = false;
        if (resp.success) {
          this.toast.success('Guardar', resp.message);
          this.nuevo();
          this.cargar();
        } else {
          this.toast.warning('Guardar', resp.message);
        }
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.message ?? err?.message ?? 'Error al guardar el modal';
        this.toast.error('Guardar', msg);
      },
    });
  }

  cambiarEstado(item: DtoModal): void {
    const nuevoEstado = item.vigente === 1 ? 0 : 1;
    this.modalService.toggleVigente(item.idModal, nuevoEstado).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toast.success('Estado', resp.message);
          this.cargar();
        } else {
          this.toast.warning('Estado', resp.message);
        }
      },
      error: () => this.toast.error('Estado', 'Error al cambiar estado'),
    });
  }

  eliminar(item: DtoModal): void {
    if (!confirm(`¿Está seguro de eliminar el modal "${item.titulo}"?`)) return;

    this.modalService.delete(item.idModal).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toast.success('Eliminar', resp.message);
          this.cargar();
        } else {
          this.toast.warning('Eliminar', resp.message);
        }
      },
      error: () => this.toast.error('Eliminar', 'Error al eliminar el modal'),
    });
  }

  onRecursoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime'];
    const esImagen = allowedImages.includes(file.type);
    const esVideo  = allowedVideos.includes(file.type);

    if (!esImagen && !esVideo) {
      this.toast.warning('Recurso', 'Formato no permitido. Use JPG, PNG, WEBP, MP4, WEBM o MOV.');
      input.value = '';
      return;
    }
    if (esImagen && file.size > 5 * 1024 * 1024) {
      this.toast.warning('Recurso', 'La imagen no puede exceder 5MB.');
      input.value = '';
      return;
    }
    if (esVideo && file.size > 150 * 1024 * 1024) {
      this.toast.warning('Recurso', 'El video no puede exceder 150MB.');
      input.value = '';
      return;
    }

    this.uploadingRecurso = true;
    this.modalService.uploadRecurso(file).subscribe({
      next: (resp) => {
        this.uploadingRecurso = false;
        if (!resp?.success) {
          this.toast.warning('Recurso', resp?.message ?? 'No fue posible cargar el archivo.');
          return;
        }
        this.form.RutaRecurso = resp.url;
        this.form.TipoRecurso = esImagen ? 'IMAGEN' : 'VIDEO';
        this.recursoPreviewUrl = resp.url;
        this.toast.success('Recurso', resp.message);
      },
      error: () => {
        this.uploadingRecurso = false;
        this.toast.error('Recurso', 'Error al cargar el archivo.');
      },
    });
  }

  verAuditoria(item: DtoModal): void {
    this.auditoriaTitulo = item.titulo;
    this.auditoria = [];
    this.loadingAuditoria = true;
    this.mostrarAuditoria = true;

    this.modalService.getInteracciones(item.idModal).subscribe({
      next: (data) => {
        this.auditoria = data ?? [];
        this.loadingAuditoria = false;
      },
      error: () => {
        this.loadingAuditoria = false;
        this.toast.error('Auditoría', 'Error al cargar las interacciones');
      },
    });
  }

  cerrarAuditoria(): void {
    this.mostrarAuditoria = false;
    this.auditoria = [];
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  iconoTipoAccion(tipo: string): string {
    const map: Record<string, string> = {
      VISTA: 'fa-eye',
      ACEPTAR: 'fa-check',
      CERRAR: 'fa-xmark',
    };
    return map[tipo] ?? 'fa-circle';
  }

  private formVacio(): DtoModalRequest {
    const inicio = new Date();
    const fin = new Date();
    fin.setDate(fin.getDate() + 5);
    fin.setHours(0, 0, 0, 0);
    return {
      Titulo: '',
      Descripcion: '',
      TipoRecurso: 'TEXTO',
      RutaRecurso: '',
      TipoAccion: 'INFO',
      FechaInicio: this.toDateTimeLocal(inicio),
      FechaFin: this.toDateTimeLocal(fin),
      Unidad: '',
      Orden: 1,
      Vigente: 1,
    };
  }

  private toDateTimeLocal(date: Date): string {
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  }

  private normalizarFecha(valor: string): string {
    if (!valor) return valor;
    // datetime-local devuelve "YYYY-MM-DDTHH:mm" — .NET necesita segundos
    return valor.length === 16 ? `${valor}:00` : valor;
  }
}
