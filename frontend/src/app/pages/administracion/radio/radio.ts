import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DtoRadioEmisora,
  DtoRadioEmisoraRequest,
  RadioService
} from '../../../core/services/administracion/radio.service';
import { ToastService } from '../../../core/services/toast.service';

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

@Component({
  selector: 'app-radio-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './radio.html',
  styleUrls: ['./radio.scss']
})
export class RadioAdminComponent implements OnInit, OnDestroy {
  loading = false;
  saving = false;
  uploadingLogo = false;
  visible = true;
  minimized = false;
  showForm = false;
  editingId: number | null = null;
  emisoras: DtoRadioEmisora[] = [];
  formTestStatus: TestStatus = 'idle';
  rowTestStatus: Partial<Record<number, TestStatus>> = {};

  form: DtoRadioEmisoraRequest = this.defaultForm();

  private formValidationTimer: ReturnType<typeof setTimeout> | null = null;
  private previewAudio = new Audio();
  private playingForm = false;
  private playingRowId: number | null = null;

  constructor(
    private radioService: RadioService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargarEmisoras();
  }

  ngOnDestroy(): void {
    this.clearFormValidationTimer();
    this.stopAudio();
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
    this.formTestStatus = 'idle';
    this.clearFormValidationTimer();
  }

  abrirFormularioCreacion(): void {
    this.editingId = null;
    this.form = this.defaultForm();
    this.showForm = true;
    this.formTestStatus = 'idle';
    this.triggerFormValidation(this.form.streamUrl ?? '');
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
    this.formTestStatus = this.rowTestStatus[item.idEmisora] ?? 'idle';
    this.triggerFormValidation(this.form.streamUrl ?? '');
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

  onFormStreamChange(url: string): void {
    this.triggerFormValidation(url);
  }

  togglePlayForm(): void {
    const url = (this.form.streamUrl ?? '').trim();
    if (!url) {
      this.toast.warning('Radio', 'Ingrese una URL de stream.');
      return;
    }

    this.togglePlayback(url, null);
  }

  togglePlayFila(item: DtoRadioEmisora): void {
    const url = (item.streamUrl ?? '').trim();
    if (!url) {
      this.toast.warning('Radio', 'La emisora no tiene URL de stream.');
      return;
    }

    this.togglePlayback(url, item.idEmisora);
  }

  isFormPlaying(): boolean {
    return this.playingForm;
  }

  isRowPlaying(id: number): boolean {
    return this.playingRowId === id;
  }

  getStatusLabel(status: TestStatus): string {
    if (status === 'testing') return 'Probando';
    if (status === 'ok') return 'Activa';
    if (status === 'error') return 'Sin señal';
    return 'Sin prueba';
  }

  private triggerFormValidation(url: string): void {
    const normalized = (url ?? '').trim();
    this.clearFormValidationTimer();

    if (!normalized) {
      this.formTestStatus = 'idle';
      return;
    }

    this.formTestStatus = 'testing';
    this.formValidationTimer = setTimeout(() => {
      this.validarStream(normalized, null, false);
    }, 700);
  }

  private validarEstadosTabla(): void {
    this.emisoras.forEach((item, index) => {
      this.rowTestStatus[item.idEmisora] = 'testing';
      const delay = Math.min(index * 150, 1200);
      setTimeout(() => this.validarStream(item.streamUrl ?? '', item.idEmisora, false), delay);
    });
  }

  private validarStream(url: string, rowId: number | null, notify: boolean): void {
    const normalized = (url ?? '').trim();
    if (!normalized) {
      if (rowId !== null) {
        this.rowTestStatus[rowId] = 'idle';
      } else {
        this.formTestStatus = 'idle';
      }
      return;
    }

    if (rowId !== null) {
      this.rowTestStatus[rowId] = 'testing';
    } else {
      this.formTestStatus = 'testing';
    }

    this.radioService.validarStream(normalized).subscribe({
      next: (resp) => {
        const ok = !!resp?.active;
        if (rowId !== null) {
          this.rowTestStatus[rowId] = ok ? 'ok' : 'error';
        } else {
          this.formTestStatus = ok ? 'ok' : 'error';
        }

        if (notify) {
          const msg = resp?.message || (ok ? 'Se detectó señal de audio.' : 'Sin señal.');
          if (ok) {
            this.toast.success('Radio', msg);
          } else {
            this.toast.warning('Radio', msg);
          }
        }
      },
      error: (err) => {
        if (rowId !== null) {
          this.rowTestStatus[rowId] = 'error';
        } else {
          this.formTestStatus = 'error';
        }
        if (notify) {
          this.toast.error('Radio', err?.error?.message ?? 'No fue posible validar la emisora.');
        }
      }
    });
  }

  private togglePlayback(url: string, rowId: number | null): void {
    const sameTarget = (rowId === null && this.playingForm) || (rowId !== null && this.playingRowId === rowId);
    if (sameTarget) {
      this.stopAudio();
      return;
    }

    this.stopAudio();

    this.previewAudio = new Audio(url);
    this.previewAudio.preload = 'none';
    this.previewAudio.onended = () => this.clearPlayingFlags();
    this.previewAudio.onerror = () => {
      this.clearPlayingFlags();
      this.toast.warning('Radio', 'No fue posible reproducir esta emisora.');
    };

    if (rowId === null) {
      this.playingForm = true;
      this.playingRowId = null;
    } else {
      this.playingForm = false;
      this.playingRowId = rowId;
    }

    this.previewAudio.play().catch(() => {
      this.clearPlayingFlags();
      this.toast.warning('Radio', 'El navegador bloqueó la reproducción.');
    });
  }

  private stopAudio(): void {
    try {
      this.previewAudio.pause();
      this.previewAudio.src = '';
      this.previewAudio.load();
    } catch {
      // no-op
    }
    this.clearPlayingFlags();
  }

  private clearPlayingFlags(): void {
    this.playingForm = false;
    this.playingRowId = null;
  }

  private clearFormValidationTimer(): void {
    if (this.formValidationTimer) {
      clearTimeout(this.formValidationTimer);
      this.formValidationTimer = null;
    }
  }

  private cargarEmisoras(): void {
    this.loading = true;
    this.radioService.getAdmin().subscribe({
      next: (data) => {
        this.emisoras = (data ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        this.loading = false;
        this.validarEstadosTabla();
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
