import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService, DtoDominio, DtoDominioRequest } from '../../../core/services/administracion/dominio.service';

@Component({
  selector: 'app-dominio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dominio.html',
  styleUrls: ['./dominio.scss']
})
export class DominioAdminComponent implements OnInit {
  visible = true;
  minimized = false;

  loading = false;
  saving = false;

  listaDominios: DtoDominio[] = [];
  dominiosTree: { item: DtoDominio; children: { item: DtoDominio; children: DtoDominio[]; expanded: boolean }[]; expanded: boolean }[] = [];
  editingId: number | null = null;

  form: DtoDominioRequest = {
    Descripcion: '',
    IdPadre: 0,
    Vigente: 1,
    Abreviatura: '',
    Observacion: ''
  };

  dominioOptions: { id: string; descripcion: string }[] = [];

  constructor(
    private toast: ToastService,
    private dominioService: DominioService
  ) {}

  ngOnInit(): void {
    this.cargarDominios();
  }

  cargarDominios(): void {
    this.loading = true;
    this.dominioService.getAll().subscribe({
      next: (data) => {
        this.listaDominios = data ?? [];
        this.buildTree();
        this.actualizarOpcionesPadre();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error', 'No se pudieron cargar los dominios');
      }
    });
  }

  private actualizarOpcionesPadre(): void {
    this.dominioOptions = this.listaDominios
      .filter(d => d.idDominio !== 0 && d.idDominio !== (this.editingId ?? 0))
      .map(d => ({
        id: String(d.idDominio),
        descripcion: d.descripcion
      }));
  }

  private buildTree(): void {
    const noRaiz = this.listaDominios.filter(d => d.idDominio !== 0);
    const raiz = noRaiz.filter(d => !d.idPadre || d.idPadre === 0);
    console.log('Dominios completos:', noRaiz);
    this.dominiosTree = raiz.map(padre => {
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
    });
    console.log('Árbol construido:', this.dominiosTree);
  }

  toggleExpand(index: number): void {
    this.dominiosTree[index].expanded = !this.dominiosTree[index].expanded;
  }

  toggleChildExpand(padreIndex: number, childIndex: number): void {
    this.dominiosTree[padreIndex].children[childIndex].expanded = 
      !this.dominiosTree[padreIndex].children[childIndex].expanded;
  }

  nuevo(): void {
    this.editingId = null;
    this.form = {
      Descripcion: '',
      IdPadre: 0,
      Vigente: 1,
      Abreviatura: '',
      Observacion: ''
    };
  }

  editar(item: DtoDominio): void {
    this.editingId = item.idDominio;
    this.form = {
      Descripcion: item.descripcion,
      IdPadre: item.idPadre,
      Vigente: item.vigente,
      Abreviatura: item.abreviatura || '',
      Observacion: item.observacion || ''
    };
    this.actualizarOpcionesPadre();
  }

  guardar(): void {
    if (!this.form.Descripcion?.trim()) {
      this.toast.warning('Guardar', 'La descripción es requerida');
      return;
    }

    this.saving = true;

    const request: DtoDominioRequest = {
      Descripcion: this.form.Descripcion.trim(),
      IdPadre: this.form.IdPadre || 0,
      Vigente: this.form.Vigente,
      Abreviatura: this.form.Abreviatura?.trim() || '',
      Observacion: this.form.Observacion?.trim() || ''
    };

    if (this.editingId) {
      this.dominioService.update(this.editingId, request).subscribe({
        next: (resp) => {
          this.saving = false;
          if (resp.success) {
            this.toast.success('Guardar', resp.message);
            this.nuevo();
            this.cargarDominios();
          } else {
            this.toast.warning('Guardar', resp.message);
          }
        },
        error: () => {
          this.saving = false;
          this.toast.error('Guardar', 'Error al actualizar dominio');
        }
      });
    } else {
      this.dominioService.create(request).subscribe({
        next: (resp) => {
          this.saving = false;
          if (resp.success) {
            this.toast.success('Guardar', resp.message);
            this.nuevo();
            this.cargarDominios();
          } else {
            this.toast.warning('Guardar', resp.message);
          }
        },
        error: () => {
          this.saving = false;
          this.toast.error('Guardar', 'Error al crear dominio');
        }
      });
    }
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
    const padre = this.listaDominios.find(d => d.idDominio === Number(idPadre));
    return padre?.descripcion || 'Sin padre';
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }
}
