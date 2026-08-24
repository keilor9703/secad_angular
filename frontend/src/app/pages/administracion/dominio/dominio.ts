import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService, DtoDominio, DtoDominioRequest } from '../../../core/services/administracion/dominio.service';

interface DominioNodo { item: DtoDominio; children: DtoDominio[]; expanded: boolean; }
interface DominioRaiz { item: DtoDominio; children: DominioNodo[]; expanded: boolean; }

@Component({
  selector: 'app-dominio',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './dominio.html',
  styleUrls: ['./dominio.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DominioAdminComponent implements OnInit {
  private readonly toast          = inject(ToastService);
  private readonly dominioService = inject(DominioService);
  private readonly fb             = inject(FormBuilder);

  readonly visible   = signal(true);
  readonly minimized = signal(false);

  readonly loading = signal(false);
  readonly saving  = signal(false);

  readonly listaDominios = signal<DtoDominio[]>([]);
  readonly dominiosTree  = signal<DominioRaiz[]>([]);
  readonly editingId     = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    descripcion: ['', [Validators.required]],
    idPadre:     [0],
    vigente:     [1],
    abreviatura: [''],
    observacion: ['']
  });

  readonly dominioOptions = signal<{ id: number; descripcion: string }[]>([]);

  ngOnInit(): void {
    this.cargarDominios();
  }

  cargarDominios(): void {
    this.loading.set(true);
    this.dominioService.getAll().subscribe({
      next: (data) => {
        this.listaDominios.set((data ?? []).map((item) => this.normalizarDominio(item as any)));
        this.buildTree();
        this.actualizarOpcionesPadre();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudieron cargar los dominios');
      }
    });
  }

  private actualizarOpcionesPadre(): void {
    const editing = this.editingId() ?? 0;
    this.dominioOptions.set(
      this.listaDominios()
        .filter(d => d.idDominio !== 0 && d.idDominio !== editing && Number(d.idPadre) === 0)
        .map(d => ({ id: d.idDominio, descripcion: d.descripcion }))
    );
  }

  private normalizarDominio(item: any): DtoDominio {
    return {
      idDominio: Number(item?.idDominio ?? item?.IdDominio ?? item?.id_dominio ?? item?.ID_DOMINIO ?? 0),
      descripcion: String(item?.descripcion ?? item?.Descripcion ?? ''),
      idPadre: Number(item?.idPadre ?? item?.IdPadre ?? item?.id_padre ?? item?.ID_PADRE ?? 0),
      vigente: Number(item?.vigente ?? item?.Vigente ?? 0),
      abreviatura: String(item?.abreviatura ?? item?.Abreviatura ?? ''),
      observacion: String(item?.observacion ?? item?.Observacion ?? '')
    };
  }

  private buildTree(): void {
    const noRaiz = this.listaDominios().filter(d => d.idDominio !== 0);
    const raiz = noRaiz.filter(d => !d.idPadre || d.idPadre === 0);
    this.dominiosTree.set(raiz.map(padre => {
      const children = noRaiz.filter(hijo => hijo.idPadre === padre.idDominio);
      return {
        item: padre,
        children: children.map(hijo => ({
          item: hijo,
          children: noRaiz.filter(nieto => nieto.idPadre === hijo.idDominio),
          expanded: true
        })),
        expanded: true
      };
    }));
  }

  toggleExpand(index: number): void {
    this.dominiosTree.update(tree => {
      const next = [...tree];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      return next;
    });
  }

  toggleChildExpand(padreIndex: number, childIndex: number): void {
    this.dominiosTree.update(tree => {
      const next = [...tree];
      const children = [...next[padreIndex].children];
      children[childIndex] = { ...children[childIndex], expanded: !children[childIndex].expanded };
      next[padreIndex] = { ...next[padreIndex], children };
      return next;
    });
  }

  nuevo(): void {
    this.editingId.set(null);
    this.form.reset({ descripcion: '', idPadre: 0, vigente: 1, abreviatura: '', observacion: '' });
  }

  editar(item: DtoDominio): void {
    this.editingId.set(item.idDominio);
    this.form.reset({
      descripcion: item.descripcion,
      idPadre: item.idPadre,
      vigente: item.vigente,
      abreviatura: item.abreviatura || '',
      observacion: item.observacion || ''
    });
    this.actualizarOpcionesPadre();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Guardar', 'La descripción es requerida');
      return;
    }

    this.saving.set(true);

    const v = this.form.getRawValue();
    const request: DtoDominioRequest = {
      Descripcion: v.descripcion.trim(),
      IdPadre: v.idPadre || 0,
      Vigente: v.vigente,
      Abreviatura: v.abreviatura?.trim() || '',
      Observacion: v.observacion?.trim() || ''
    };

    const editingId = this.editingId();
    const request$ = editingId
      ? this.dominioService.update(editingId, request)
      : this.dominioService.create(request);

    request$.subscribe({
      next: (resp) => {
        this.saving.set(false);
        if (resp.success) {
          this.toast.success('Guardar', resp.message);
          this.nuevo();
          this.cargarDominios();
        } else {
          this.toast.warning('Guardar', resp.message);
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Guardar', `Error al ${editingId ? 'actualizar' : 'crear'} dominio`);
      }
    });
  }

  eliminar(item: DtoDominio): void {
    if (!confirm(`¿Está seguro de eliminar el dominio "${item.descripcion}"?`)) {
      return;
    }

    this.dominioService.delete(item.idDominio).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toast.success('Eliminar', resp.message);
          this.cargarDominios();
        } else {
          this.toast.warning('Eliminar', resp.message);
        }
      },
      error: () => {
        this.toast.error('Eliminar', 'Error al eliminar dominio');
      }
    });
  }

  cambiarEstado(item: DtoDominio): void {
    const nuevoEstado = item.vigente === 1 ? 0 : 1;
    const request: DtoDominioRequest = {
      Descripcion: item.descripcion,
      IdPadre: item.idPadre,
      Vigente: nuevoEstado,
      Abreviatura: item.abreviatura || '',
      Observacion: item.observacion || ''
    };

    this.dominioService.update(item.idDominio, request).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toast.success('Estado', resp.message);
          this.cargarDominios();
        } else {
          this.toast.warning('Estado', resp.message);
        }
      },
      error: () => {
        this.toast.error('Estado', 'Error al cambiar estado');
      }
    });
  }

  getNombrePadre(idPadre: number | string | null): string {
    if (!idPadre || idPadre === 0 || idPadre === '0' || idPadre === 'null') {
      return 'Raíz (sin padre)';
    }
    const padre = this.listaDominios().find(d => d.idDominio === Number(idPadre));
    return padre?.descripcion || 'Sin padre';
  }

  toggleMinimize(): void {
    this.minimized.update(v => !v);
  }

  closePanel(): void {
    this.visible.set(false);
  }
}
