import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './asistente.html',
  styleUrls: ['./asistente.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AsistenteAdminComponent implements OnInit {
  private readonly svc   = inject(AsistenteService);
  private readonly toast = inject(ToastService);
  private readonly fb    = inject(FormBuilder);

  // ─── Estado general ──────────────────────────────────────────────────────────
  readonly loading   = signal(false);
  readonly saving    = signal(false);
  readonly minimized = signal(false);

  // ─── Categorías ──────────────────────────────────────────────────────────────
  readonly categorias             = signal<AsistenteCategoria[]>([]);
  readonly categoriaSeleccionada  = signal<AsistenteCategoria | null>(null);
  readonly editingCatId           = signal<string | null>(null);

  readonly formCat = this.fb.nonNullable.group({
    Codigo:      ['', [Validators.required]],
    Descripcion: ['', [Validators.required]],
    Icono:       ['fa-circle-question'],
    Orden:       [0],
    Activo:      [true]
  });

  // ─── Preguntas ────────────────────────────────────────────────────────────────
  readonly preguntas      = signal<AsistentePregunta[]>([]);
  readonly loadingPreg    = signal(false);
  readonly editingPregId  = signal<string | null>(null);

  readonly formPreg = this.fb.nonNullable.group({
    Pregunta:      ['', [Validators.required]],
    Ayuda:         [''],
    TipoRespuesta: ['TEXTO'],
    Obligatoria:   [false],
    Orden:         [0],
    Activo:        [true]
  });

  /** Opciones en texto plano (una por línea) — se convierte a JSON al guardar. */
  readonly opcionesTexto = signal('');

  // ─── Catálogos ───────────────────────────────────────────────────────────────
  readonly TIPOS_RESPUESTA = TIPOS_RESPUESTA;
  readonly parsearOpciones = parsearOpciones;

  ngOnInit(): void {
    this.cargarCategorias();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CATEGORÍAS
  // ════════════════════════════════════════════════════════════════════════════

  cargarCategorias(): void {
    this.loading.set(true);
    this.svc.getCategorias(false).subscribe({
      next: (r) => { this.categorias.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Asistente', 'Error cargando categorías'); }
    });
  }

  seleccionarCategoria(cat: AsistenteCategoria): void {
    if (this.categoriaSeleccionada()?.id === cat.id) return;
    this.categoriaSeleccionada.set(cat);
    this.nuevaPregunta();
    this.cargarPreguntas(cat.id);
  }

  nuevaCategoria(): void {
    this.editingCatId.set(null);
    this.formCat.reset({ Codigo: '', Descripcion: '', Icono: 'fa-circle-question', Orden: this.categorias().length, Activo: true });
  }

  editarCategoria(cat: AsistenteCategoria): void {
    this.editingCatId.set(cat.id);
    this.formCat.reset({
      Codigo:      cat.codigo,
      Descripcion: cat.descripcion,
      Icono:       cat.icono,
      Orden:       cat.orden,
      Activo:      cat.activo,
    });
  }

  guardarCategoria(): void {
    if (this.formCat.invalid) {
      this.formCat.markAllAsTouched();
      const v = this.formCat.getRawValue();
      if (!v.Codigo?.trim()) {
        this.toast.warning('Validación', 'El código es requerido');
      } else if (!v.Descripcion?.trim()) {
        this.toast.warning('Validación', 'La descripción es requerida');
      }
      return;
    }

    this.saving.set(true);

    const v = this.formCat.getRawValue();
    const req: AsistenteCategoriaRequest = {
      ...v,
      Codigo:      v.Codigo.trim().toUpperCase(),
      Descripcion: v.Descripcion.trim(),
      Icono:       v.Icono.trim() || 'fa-circle-question',
    };

    const editingId = this.editingCatId();
    const op$ = editingId
      ? this.svc.updateCategoria(editingId, req)
      : this.svc.createCategoria(req);

    op$.subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.success) { this.toast.success('Categoría', r.message); this.nuevaCategoria(); this.cargarCategorias(); }
        else            this.toast.warning('Categoría', r.message);
      },
      error: () => { this.saving.set(false); this.toast.error('Categoría', editingId ? 'Error al actualizar' : 'Error al crear'); }
    });
  }

  eliminarCategoria(cat: AsistenteCategoria): void {
    if (!confirm(`¿Eliminar la categoría "${cat.descripcion}" y todas sus preguntas?`)) return;
    this.svc.deleteCategoria(cat.id).subscribe({
      next: (r) => {
        if (r.success) {
          this.toast.success('Categoría', r.message);
          if (this.categoriaSeleccionada()?.id === cat.id) {
            this.categoriaSeleccionada.set(null);
            this.preguntas.set([]);
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
    this.loadingPreg.set(true);
    this.svc.getPreguntas(categoriaId, false).subscribe({
      next: (r) => { this.preguntas.set(r.data ?? []); this.loadingPreg.set(false); },
      error: () => { this.loadingPreg.set(false); this.toast.error('Asistente', 'Error cargando preguntas'); }
    });
  }

  nuevaPregunta(): void {
    this.editingPregId.set(null);
    this.opcionesTexto.set('');
    this.formPreg.reset({
      Pregunta:      '',
      Ayuda:         '',
      TipoRespuesta: 'TEXTO',
      Obligatoria:   false,
      Orden:         this.preguntas().length,
      Activo:        true,
    });
  }

  editarPregunta(p: AsistentePregunta): void {
    this.editingPregId.set(p.id);
    const ops = parsearOpciones(p.opciones);
    this.opcionesTexto.set(ops.join('\n'));
    this.formPreg.reset({
      Pregunta:      p.pregunta,
      Ayuda:         p.ayuda ?? '',
      TipoRespuesta: p.tipoRespuesta,
      Obligatoria:   p.obligatoria,
      Orden:         p.orden,
      Activo:        p.activo,
    });
  }

  guardarPregunta(): void {
    const v = this.formPreg.getRawValue();
    const categoria = this.categoriaSeleccionada();

    if (!v.Pregunta?.trim()) {
      this.toast.warning('Validación', 'El texto de la pregunta es requerido'); return;
    }
    if (!categoria) {
      this.toast.warning('Validación', 'Seleccione una categoría primero'); return;
    }
    const opcionesTexto = this.opcionesTexto();
    if (v.TipoRespuesta === 'SELECCION' && !opcionesTexto.trim()) {
      this.toast.warning('Validación', 'Ingrese al menos una opción'); return;
    }

    // Convertir opciones de texto plano → JSON array
    let opcionesJson: string | undefined = undefined;
    if (v.TipoRespuesta === 'SELECCION') {
      const arr = opcionesTexto
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      opcionesJson = JSON.stringify(arr);
    }

    this.saving.set(true);

    const req: AsistentePreguntaRequest = {
      CategoriaId:   categoria.id,
      Pregunta:      v.Pregunta.trim(),
      Ayuda:         v.Ayuda?.trim() || undefined,
      TipoRespuesta: v.TipoRespuesta,
      Opciones:      opcionesJson,
      Obligatoria:   v.Obligatoria,
      Orden:         v.Orden,
      Activo:        v.Activo,
    };

    const editingId = this.editingPregId();
    const op$ = editingId
      ? this.svc.updatePregunta(editingId, req)
      : this.svc.createPregunta(req);

    op$.subscribe({
      next: (r) => {
        this.saving.set(false);
        if (r.success) { this.toast.success('Pregunta', r.message); this.nuevaPregunta(); this.cargarPreguntas(categoria.id); }
        else            this.toast.warning('Pregunta', r.message);
      },
      error: () => { this.saving.set(false); this.toast.error('Pregunta', editingId ? 'Error al actualizar' : 'Error al crear'); }
    });
  }

  eliminarPregunta(p: AsistentePregunta): void {
    if (!confirm(`¿Eliminar la pregunta "${p.pregunta}"?`)) return;
    const categoria = this.categoriaSeleccionada();
    this.svc.deletePregunta(p.id).subscribe({
      next: (r) => {
        if (r.success) {
          this.toast.success('Pregunta', r.message);
          if (categoria) this.cargarPreguntas(categoria.id);
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

  toggleMinimize(): void { this.minimized.update(v => !v); }
}
