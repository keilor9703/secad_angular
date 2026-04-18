import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NoticiaService,
  DtoNoticia,
  DtoNoticiaRequest
} from '../../../core/services/administracion/noticia.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './noticias.html',
  styleUrls: ['./noticias.scss']
})
export class NoticiasAdminComponent implements OnInit {
  loading = false;
  saving = false;
  deleting = false;
  uploading = false;

  noticias: DtoNoticia[] = [];
  noticiaActual: DtoNoticia | null = null;
  isEditing = false;

  form: DtoNoticiaRequest = {
    unidad: '',
    titulo: '',
    seccion: '',
    ciudad: '',
    imagenNoticia: '',
    subtitulo: '',
    contenido: ''
  };

  secciones = ['Comunicado', 'Servicio', 'Importante', 'Evento', 'Galería'];
  ciudades = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Nacional'];

  constructor(
    private service: NoticiaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (data) => {
        this.noticias = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error('Noticias', err?.error?.message ?? 'Error cargando noticias.');
      }
    });
  }

  nuevaNoticia(): void {
    this.noticiaActual = null;
    this.form = {
      unidad: '',
      titulo: '',
      seccion: '',
      ciudad: '',
      imagenNoticia: '',
      subtitulo: '',
      contenido: ''
    };
    this.isEditing = true;
  }

  editarNoticia(noticia: DtoNoticia): void {
    this.noticiaActual = noticia;
    this.form = {
      unidad: noticia.unidad,
      titulo: noticia.titulo,
      seccion: noticia.seccion,
      ciudad: noticia.ciudad,
      imagenNoticia: noticia.imagenNoticia ?? '',
      subtitulo: noticia.subtitulo ?? '',
      contenido: noticia.contenido ?? ''
    };
    this.isEditing = true;
  }

  cancelar(): void {
    this.isEditing = false;
    this.noticiaActual = null;
  }

  guardar(): void {
    const titulo = (this.form.titulo ?? '').trim();
    const seccion = (this.form.seccion ?? '').trim();
    const ciudad = (this.form.ciudad ?? '').trim();
    const unidad = (this.form.unidad ?? '').trim();

    if (!titulo) {
      this.toast.warning('Noticias', 'El título es obligatorio.');
      return;
    }
    if (!seccion) {
      this.toast.warning('Noticias', 'La sección es obligatoria.');
      return;
    }
    if (!ciudad) {
      this.toast.warning('Noticias', 'La ciudad es obligatoria.');
      return;
    }
    if (!unidad) {
      this.toast.warning('Noticias', 'La unidad es obligatoria.');
      return;
    }

    const payload: DtoNoticiaRequest = {
      titulo,
      seccion,
      ciudad,
      unidad,
      imagenNoticia: (this.form.imagenNoticia ?? '').trim() || null,
      subtitulo: (this.form.subtitulo ?? '').trim() || null,
      contenido: (this.form.contenido ?? '').trim() || null
    };

    this.saving = true;

    const request$ = this.noticiaActual
      ? this.service.update(this.noticiaActual.idNoticia, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: (resp) => {
        this.saving = false;
        if (!resp.success) {
          this.toast.warning('Noticias', resp.message ?? 'No fue posible guardar.');
          return;
        }
        this.toast.success('Noticias', resp.message ?? 'Guardado correctamente.');
        this.isEditing = false;
        this.noticiaActual = null;
        this.cargar();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('Noticias', err?.error?.message ?? 'Error guardando noticia.');
      }
    });
  }

  eliminarNoticia(noticia: DtoNoticia): void {
    if (!confirm(`¿Está seguro de eliminar la noticia "${noticia.titulo}"?`)) {
      return;
    }

    this.deleting = true;
    this.service.delete(noticia.idNoticia).subscribe({
      next: (resp) => {
        this.deleting = false;
        if (!resp.success) {
          this.toast.warning('Noticias', resp.message ?? 'No fue posible eliminar.');
          return;
        }
        this.toast.success('Noticias', resp.message ?? 'Noticia eliminada correctamente.');
        this.cargar();
      },
      error: (err) => {
        this.deleting = false;
        this.toast.error('Noticias', err?.error?.message ?? 'Error eliminando noticia.');
      }
    });
  }

  getSeccionClass(seccion: string): string {
    switch (seccion.toLowerCase()) {
      case 'comunicado': return 'tag-comunicado';
      case 'servicio': return 'tag-servicio';
      case 'importante': return 'tag-importante';
      case 'evento': return 'tag-evento';
      case 'galería': return 'tag-galeria';
      default: return '';
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (file) {
      this.uploading = true;
      this.service.uploadImage(file).subscribe({
        next: (resp) => {
          this.uploading = false;
          if (resp.success) {
            this.form.imagenNoticia = resp.fileName;
            this.toast.success('Imagen', 'Imagen cargada correctamente.');
          } else {
            this.toast.warning('Imagen', resp.message || 'Error al cargar imagen.');
          }
        },
        error: (err) => {
          this.uploading = false;
          this.toast.error('Imagen', err?.error?.message || 'Error al cargar imagen.');
        }
      });
    }
  }
}