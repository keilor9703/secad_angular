import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DtoSaveSliderRequest,
  DtoSliders,
  SliderService
} from '../../../core/services/administracion/slider.service';
import { ToastService } from '../../../core/services/toast.service';

type SliderForm = DtoSaveSliderRequest;

@Component({
  selector: 'app-sliders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sliders.html',
  styleUrls: ['./sliders.scss']
})
export class SlidersComponent implements OnInit {
  minimized = false;
  visible = true;
  loading = false;
  saving = false;
  uploadingImage = false;

  sliders: DtoSliders[] = [];
  editingId: number | null = null;
  imagePreviewUrl = '';

  form: SliderForm = this.getDefaultForm();

  constructor(
    private sliderService: SliderService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSliders();
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }

  loadSliders(): void {
    this.loading = true;
    this.sliderService.getAdmin().subscribe({
      next: (data) => {
        this.sliders = (data ?? []).slice().sort((a, b) => a.orden - b.orden);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(
          'Sliders',
          err?.error?.message ?? 'No fue posible cargar los sliders.'
        );
      }
    });
  }

  nuevo(): void {
    this.editingId = null;
    this.form = this.getDefaultForm();
    this.imagePreviewUrl = '';
  }

  editar(item: DtoSliders): void {
    this.editingId = item.idSlider;
    this.form = {
      idSlider: item.idSlider,
      titulo: (item.titulo ?? '').trim(),
      subtitulo: (item.subtitulo ?? '').trim(),
      urlImagen: (item.urlImagen ?? '').trim(),
      urlDestino: (item.urlDestino ?? '').trim(),
      orden: item.orden || 1,
      vigente: item.vigente || 0,
      fechaInicio: this.normalizeDateTime(item.fechaInicio),
      fechaFin: this.normalizeDateTime(item.fechaFin)
    };
    this.imagePreviewUrl = this.form.urlImagen || '';
  }

  guardar(): void {
    if (!this.form.titulo.trim()) {
      this.toast.warning('Sliders', 'El título es obligatorio.');
      return;
    }

    if (!this.form.urlImagen.trim()) {
      this.toast.warning('Sliders', 'La URL de imagen es obligatoria.');
      return;
    }

    if (!this.form.orden || this.form.orden < 1) {
      this.toast.warning('Sliders', 'El orden debe ser mayor a 0.');
      return;
    }

    if (!this.form.fechaInicio || !this.form.fechaFin) {
      this.toast.warning('Sliders', 'La fecha/hora de inicio y fin son obligatorias.');
      return;
    }

    if (new Date(this.form.fechaFin).getTime() < new Date(this.form.fechaInicio).getTime()) {
      this.toast.warning('Sliders', 'La vigencia fin no puede ser menor a la vigencia inicio.');
      return;
    }

    const payload: DtoSaveSliderRequest = {
      ...this.form,
      titulo: this.form.titulo.trim(),
      subtitulo: (this.form.subtitulo ?? '').trim() || null,
      urlImagen: this.form.urlImagen.trim(),
      urlDestino: (this.form.urlDestino ?? '').trim() || null,
      fechaInicio: (this.form.fechaInicio ?? '').trim() || null,
      fechaFin: (this.form.fechaFin ?? '').trim() || null
    };

    this.saving = true;
    this.sliderService.save(payload).subscribe({
      next: (resp) => {
        this.saving = false;
        if (!resp?.success) {
          this.toast.warning('Sliders', resp?.message || 'No fue posible guardar el slider.');
          return;
        }
        this.toast.success('Sliders', resp.message || 'Slider guardado correctamente.');
        this.nuevo();
        this.loadSliders();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(
          'Sliders',
          err?.error?.detail ?? err?.error?.message ?? 'Error guardando slider.'
        );
      }
    });
  }

  cambiarEstado(item: DtoSliders): void {
    const nuevoEstado = item.vigente === 1 ? 0 : 1;
    this.sliderService.setEstado({ idSlider: item.idSlider, vigente: nuevoEstado }).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Sliders', resp?.message || 'No fue posible actualizar estado.');
          return;
        }
        this.toast.success('Sliders', resp.message || 'Estado actualizado.');
        this.loadSliders();
      },
      error: (err) => {
        this.toast.error(
          'Sliders',
          err?.error?.detail ?? err?.error?.message ?? 'Error actualizando estado.'
        );
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toast.warning('Sliders', 'Formato inválido. Use JPG, PNG o WEBP.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.toast.warning('Sliders', 'La imagen excede 5MB.');
      input.value = '';
      return;
    }

    this.uploadingImage = true;
    this.sliderService.upload(file).subscribe({
      next: (resp) => {
        this.uploadingImage = false;
        if (!resp?.success || !resp?.url) {
          this.toast.warning('Sliders', resp?.message || 'No fue posible cargar la imagen.');
          return;
        }

        this.form.urlImagen = resp.url;
        this.imagePreviewUrl = resp.url;
        this.toast.success('Sliders', resp.message || 'Imagen cargada correctamente.');
      },
      error: (err) => {
        this.uploadingImage = false;
        this.toast.error(
          'Sliders',
          err?.error?.detail ?? err?.error?.message ?? 'Error cargando imagen.'
        );
      }
    });
  }

  private getDefaultForm(): SliderForm {
    const today = new Date();
    const plusSeven = new Date(today);
    plusSeven.setDate(today.getDate() + 7);

    return {
      idSlider: null,
      titulo: '',
      subtitulo: '',
      urlImagen: '',
      urlDestino: '',
      orden: 1,
      vigente: 1,
      fechaInicio: this.toInputDateTime(today),
      fechaFin: this.toInputDateTime(plusSeven)
    };
  }

  private normalizeDateTime(value?: string | null): string {
    if (!value) {
      return '';
    }
    const str = value.toString().trim();
    if (!str) {
      return '';
    }

    // Caso común: "YYYY-MM-DDTHH:mm:ss..." -> datetime-local "YYYY-MM-DDTHH:mm"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
      return str.slice(0, 16);
    }

    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return this.toInputDateTime(parsed);
  }

  private toInputDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}


