import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DtoRadioEmisora,
  DtoRadioEmisoraRequest,
  RadioService
} from '../../../core/services/administracion/radio.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-radio-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './radio.html',
  styleUrls: ['./radio.scss']
})
export class RadioAdminComponent implements OnInit {
  loading = false;
  saving = false;
  uploadingLogo = false;
  visible = true;
  minimized = false;
  showForm = false;
  editingId: number | null = null;
  emisoras: DtoRadioEmisora[] = [];

  form: DtoRadioEmisoraRequest = this.defaultForm();

  constructor(
    private radioService: RadioService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargarEmisoras();
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }

  nuevo(): void {
    this.editingId = null;
    this.form = this.defaultForm();
    this.showForm = false;
  }

  abrirFormularioCreacion(): void {
    this.editingId = null;
    this.form = this.defaultForm();
    this.showForm = true;
  }

  editar(item: DtoRadioEmisora): void {
    this.editingId = item.idEmisora;
    this.showForm = true;
    this.form = {
      nombre: item.nombre ?? '',
      streamUrl: item.streamUrl ?? '',
      logoUrl: item.logoUrl ?? '',
      orden: item.orden ?? 1,
      activo: item.activo ?? 1
    };
  }

  guardar(): void {
    const nombre = (this.form.nombre ?? '').trim();
    const streamUrl = (this.form.streamUrl ?? '').trim();
    const logoUrl = (this.form.logoUrl ?? '').trim();
    const orden = Number(this.form.orden ?? 0);
    const activo = this.form.activo === 0 ? 0 : 1;

    if (!nombre) {
      this.toast.warning('Radio', 'El nombre es obligatorio.');
      return;
    }

    if (!streamUrl) {
      this.toast.warning('Radio', 'La URL del stream es obligatoria.');
      return;
    }

    if (orden < 0) {
      this.toast.warning('Radio', 'El orden no puede ser negativo.');
      return;
    }

    const payload: DtoRadioEmisoraRequest = {
      nombre,
      streamUrl,
      logoUrl: logoUrl || null,
      orden,
      activo
    };

    this.saving = true;

    const request$ = this.editingId
      ? this.radioService.update(this.editingId, payload)
      : this.radioService.create(payload);

    request$.subscribe({
      next: (resp) => {
        this.saving = false;
        if (!resp?.success) {
          this.toast.warning('Radio', resp?.message || 'No fue posible guardar la emisora.');
          return;
        }
        this.toast.success('Radio', resp.message || 'Emisora guardada correctamente.');
        this.nuevo();
        this.cargarEmisoras();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('Radio', err?.error?.message ?? 'Error guardando la emisora.');
      }
    });
  }

  eliminar(item: DtoRadioEmisora): void {
    if (!confirm(`¿Desea eliminar la emisora "${item.nombre}"?`)) {
      return;
    }

    this.radioService.remove(item.idEmisora).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Radio', resp?.message || 'No fue posible eliminar.');
          return;
        }
        this.toast.success('Radio', resp.message || 'Emisora eliminada.');
        this.cargarEmisoras();
        if (this.editingId === item.idEmisora) {
          this.nuevo();
        }
      },
      error: (err) => {
        this.toast.error('Radio', err?.error?.message ?? 'Error eliminando la emisora.');
      }
    });
  }

  cambiarEstado(item: DtoRadioEmisora): void {
    const nuevoEstado = item.activo === 1 ? 0 : 1;
    this.radioService.setActivo(item.idEmisora, nuevoEstado).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Radio', resp?.message || 'No fue posible actualizar estado.');
          return;
        }
        this.toast.success('Radio', resp.message || 'Estado actualizado.');
        this.cargarEmisoras();
      },
      error: (err) => {
        this.toast.error('Radio', err?.error?.message ?? 'Error actualizando estado.');
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }

    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const allowedExt = ['png', 'svg'];
    if (!allowedExt.includes(ext)) {
      this.toast.warning('Radio', 'Solo se permite logo en formato PNG o SVG.');
      input.value = '';
      return;
    }

    if (file.size > 200 * 1024) {
      this.toast.warning('Radio', 'El logo no puede superar 200KB.');
      input.value = '';
      return;
    }

    this.uploadingLogo = true;
    this.radioService.uploadLogo(file).subscribe({
      next: (resp) => {
        this.uploadingLogo = false;
        if (!resp?.success || !resp?.url) {
          this.toast.warning('Radio', resp?.message || 'No fue posible cargar el logo.');
          return;
        }
        this.form.logoUrl = resp.url;
        this.toast.success('Radio', resp.message || 'Logo cargado correctamente.');
      },
      error: (err) => {
        this.uploadingLogo = false;
        this.toast.error('Radio', err?.error?.message ?? 'Error cargando el logo.');
      }
    });
  }

  private cargarEmisoras(): void {
    this.loading = true;
    this.radioService.getAdmin().subscribe({
      next: (data) => {
        this.emisoras = (data ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error('Radio', err?.error?.message ?? 'No fue posible cargar emisoras.');
      }
    });
  }

  private defaultForm(): DtoRadioEmisoraRequest {
    return {
      nombre: '',
      streamUrl: '',
      logoUrl: '',
      orden: 1,
      activo: 1
    };
  }
}
