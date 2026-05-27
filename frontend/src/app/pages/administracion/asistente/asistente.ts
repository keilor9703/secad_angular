import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AsistenteService,
  AsistenteCategoria,
  AsistentePregunta,
  AsistenteCategoriaRequest,
  AsistentePreguntaRequest,
  TIPOS_RESPUESTA,
  parsearOpciones
} from '../../../core/services/operacion/asistente.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-asistente-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistente.html',
  styleUrls: ['./asistente.scss']
})
export class AsistenteAdminComponent implements OnInit {

  // ─── Estado general ──────────────────────────────────────────────────────────
  loading        = false;
  saving         = false;
  minimized      = false;

  // ─── Categorías ──────────────────────────────────────────────────────────────
  categorias:          AsistenteCategoria[]     = [];
  categoriaSeleccionada: AsistenteCategoria | null = null;
  editingCatId:        string | null            = null;

  formCat: AsistenteCategoriaRequest = {
    Codigo:      '',
    Descripcion: '',
    Icono:       'fa-circle-question',
    Orden:       0,
    Activo:      true,
  };

  // ─── Preguntas ────────────────────────────────────────────────────────────────
  preguntas:      AsistentePregunta[]     = [];
  loadingPreg     = false;
  editingPregId:  string | null           = null;

  formPreg: AsistentePreguntaRequest = {
    CategoriaId:   undefined,
    Pregunta:      '',
    Ayuda:         '',
    TipoRespuesta: 'TEXTO',
    Opciones:      undefined,
    Obligatoria:   false,
    Orden:         0,
    Activo:        true,
  };

  /** Opciones en texto plano (una por línea) — se convierte a JSON al guardar. */
  opcionesTexto = '';

  // ─── Catálogos ───────────────────────────────────────────────────────────────
  readonly TIPOS_RESPUESTA = TIPOS_RESPUESTA;
  readonly parsearOpciones = parsearOpciones;

  constructor(
    private svc:   AsistenteService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.cargarCategorias();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CATEGORÍAS
  // ════════════════════════════════════════════════════════════════════════════

  cargarCategorias(): void {
    this.loading = true;
    this.svc.getCategorias(false).subscribe({
      next: (r) => { this.categorias = r.data ?? []; this.loading = false; },
      error: () => { this.loading = false; this.toast.error('Asistente', 'Error cargando categorías'); }
    });
  }

  seleccionarCategoria(cat: AsistenteCategoria): void {
    if (this.categoriaSeleccionada?.id === cat.id) return;
    this.categoriaSeleccionada = cat;
    this.nuevaPregunta();
    this.cargarPreguntas(cat.id);
  }

  nuevaCategoria(): void {
    this.editingCatId = null;
    this.formCat = { Codigo: '', Descripcion: '', Icono: 'fa-circle-question', Orden: this.categorias.length, Activo: true };
  }

  editarCategoria(cat: AsistenteCategoria): void {
    this.editingCatId = cat.id;
    this.formCat = {
      Codigo:      cat.codigo,
      Descripcion: cat.descripcion,
      Icono:       cat.icono,
      Orden:       cat.orden,
      Activo:      cat.activo,
    };
  }

  guardarCategoria(): void {
    if (!this.formCat.Codigo?.trim()) {
      this.toast.warning('Validación', 'El código es requerido'); return;
    }
    if (!this.formCat.Descripcion?.trim()) {
      this.toast.warning('Validación', 'La descripción es requerida'); return;
    }

    this.saving = true;

    const req: AsistenteCategoriaRequest = {
      ...this.formCat,
      Codigo:      this.formCat.Codigo.trim().toUpperCase(),
      Descripcion: this.formCat.Descripcion.trim(),
      Icono:       this.formCat.Icono.trim() || 'fa-circle-question',
    };

    if (this.editingCatId) {
      this.svc.updateCategoria(this.editingCatId, req).subscribe({
        next: (r) => {
          this.saving = false;
          if (r.success) { this.toast.success('Categoría', r.message); this.nuevaCategoria(); this.cargarCategorias(); }
          else            this.toast.warning('Categoría', r.message);
        },
        error: () => { this.saving = false; this.toast.error('Categoría', 'Error al actualizar'); }
      });
    } else {
      this.svc.createCategoria(req).subscribe({
        next: (r) => {
          this.saving = false;
          if (r.success) { this.toast.success('Categoría', r.message); this.nuevaCategoria(); this.cargarCategorias(); }
          else            this.toast.warning('Categoría', r.message);
        },
        error: () => { this.saving = false; this.toast.error('Categoría', 'Error al crear'); }
      });
    }
  }

  eliminarCategoria(cat: AsistenteCategoria): void {
    if (!confirm(`¿Eliminar la categoría "${cat.descripcion}" y todas sus preguntas?`)) return;
    this.svc.deleteCategoria(cat.id).subscribe({
      next: (r) => {
        if (r.success) {
          this.toast.success('Categoría', r.message);
          if (this.categoriaSeleccionada?.id === cat.id) {
            this.categoriaSeleccionada = null;
            this.preguntas = [];
          }
          this.cargarCategorias();
        } else {
          this.toast.warning('Categoría', r.message);
        }
      },
      error: () => this.toast.error('Categoría', 'Error al eliminar')
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PREGUNTAS
  // ════════════════════════════════════════════════════════════════════════════

  cargarPreguntas(categoriaId: string): void {
    this.loadingPreg = true;
    this.svc.getPreguntas(categoriaId, false).subscribe({
      next: (r) => { this.preguntas = r.data ?? []; this.loadingPreg = false; },
      error: () => { this.loadingPreg = false; this.toast.error('Asistente', 'Error cargando preguntas'); }
    });
  }

  nuevaPregunta(): void {
    this.editingPregId = null;
    this.opcionesTexto = '';
    this.formPreg = {
      CategoriaId:   this.categoriaSeleccionada?.id,
      Pregunta:      '',
      Ayuda:         '',
      TipoRespuesta: 'TEXTO',
      Opciones:      undefined,
      Obligatoria:   false,
      Orden:         this.preguntas.length,
      Activo:        true,
    };
  }

  editarPregunta(p: AsistentePregunta): void {
    this.editingPregId = p.id;
    const ops = parsearOpciones(p.opciones);
    this.opcionesTexto = ops.join('\n');
    this.formPreg = {
      CategoriaId:   p.categoriaId,
      Pregunta:      p.pregunta,
      Ayuda:         p.ayuda ?? '',
      TipoRespuesta: p.tipoRespuesta,
      Opciones:      p.opciones ?? undefined,
      Obligatoria:   p.obligatoria,
      Orden:         p.orden,
      Activo:        p.activo,
    };
  }

  guardarPregunta(): void {
    if (!this.formPreg.Pregunta?.trim()) {
      this.toast.warning('Validación', 'El texto de la pregunta es requerido'); return;
    }
    if (!this.categoriaSeleccionada) {
      this.toast.warning('Validación', 'Seleccione una categoría primero'); return;
    }
    if (this.formPreg.TipoRespuesta === 'SELECCION' && !this.opcionesTexto.trim()) {
      this.toast.warning('Validación', 'Ingrese al menos una opción'); return;
    }

    // Convertir opciones de texto plano → JSON array
    let opcionesJson: string | undefined = undefined;
    if (this.formPreg.TipoRespuesta === 'SELECCION') {
      const arr = this.opcionesTexto
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      opcionesJson = JSON.stringify(arr);
    }

    this.saving = true;

    const req: AsistentePreguntaRequest = {
      CategoriaId:   this.categoriaSeleccionada.id,
      Pregunta:      this.formPreg.Pregunta.trim(),
      Ayuda:         this.formPreg.Ayuda?.trim() || undefined,
      TipoRespuesta: this.formPreg.TipoRespuesta,
      Opciones:      opcionesJson,
      Obligatoria:   this.formPreg.Obligatoria,
      Orden:         this.formPreg.Orden,
      Activo:        this.formPreg.Activo,
    };

    if (this.editingPregId) {
      this.svc.updatePregunta(this.editingPregId, req).subscribe({
        next: (r) => {
          this.saving = false;
          if (r.success) { this.toast.success('Pregunta', r.message); this.nuevaPregunta(); this.cargarPreguntas(this.categoriaSeleccionada!.id); }
          else            this.toast.warning('Pregunta', r.message);
        },
        error: () => { this.saving = false; this.toast.error('Pregunta', 'Error al actualizar'); }
      });
    } else {
      this.svc.createPregunta(req).subscribe({
        next: (r) => {
          this.saving = false;
          if (r.success) { this.toast.success('Pregunta', r.message); this.nuevaPregunta(); this.cargarPreguntas(this.categoriaSeleccionada!.id); }
          else            this.toast.warning('Pregunta', r.message);
        },
        error: () => { this.saving = false; this.toast.error('Pregunta', 'Error al crear'); }
      });
    }
  }

  eliminarPregunta(p: AsistentePregunta): void {
    if (!confirm(`¿Eliminar la pregunta "${p.pregunta}"?`)) return;
    this.svc.deletePregunta(p.id).subscribe({
      next: (r) => {
        if (r.success) {
          this.toast.success('Pregunta', r.message);
          this.cargarPreguntas(this.categoriaSeleccionada!.id);
          this.cargarCategorias(); // Actualiza conteo
        } else {
          this.toast.warning('Pregunta', r.message);
        }
      },
      error: () => this.toast.error('Pregunta', 'Error al eliminar')
    });
  }

  // ─── Helpers de vista ────────────────────────────────────────────────────────

  getTipoLabel(tipo: string): string {
    return TIPOS_RESPUESTA.find(t => t.valor === tipo)?.label ?? tipo;
  }

  getTipoIcono(tipo: string): string {
    return TIPOS_RESPUESTA.find(t => t.valor === tipo)?.icono ?? 'fa-circle-question';
  }

  toggleMinimize(): void { this.minimized = !this.minimized; }
}
