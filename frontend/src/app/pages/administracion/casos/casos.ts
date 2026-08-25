import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import ExcelJS from 'exceljs';
import { CasoService, DtoCaso, DtoCasoRequest, DtoImportarCasosResult } from '../../../core/services/administracion/caso.service';
import { AsistenteService, AsistenteCategoria } from '../../../core/services/operacion/asistente.service';
import { ToastService } from '../../../core/services/toast.service';

type ModalMode = 'create' | 'edit';

@Component({
  selector:    'app-casos',
  standalone:  true,
  imports:     [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './casos.html',
  styleUrls:   ['./casos.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CasosComponent implements OnInit {
  private readonly svc       = inject(CasoService);
  private readonly asisSvc   = inject(AsistenteService);
  private readonly toast     = inject(ToastService);
  private readonly fb        = inject(FormBuilder);

  readonly casos      = signal<DtoCaso[]>([]);
  readonly categorias = signal<AsistenteCategoria[]>([]);
  readonly loading    = signal(false);
  readonly saving     = signal(false);
  readonly busqueda    = signal('');

  readonly showModal = signal(false);
  readonly modalMode = signal<ModalMode>('create');
  readonly editCodigo = signal('');

  readonly importando       = signal(false);
  readonly resultadoImport  = signal<DtoImportarCasosResult | null>(null);

  readonly form = this.fb.nonNullable.group({
    codigo:              ['', [Validators.required]],
    descripcion:         ['', [Validators.required]],
    vigente:             [true],
    idCategoriaAsistente: ['']
  });

  ngOnInit(): void {
    this.load();
    this.asisSvc.getCategorias(false).subscribe({
      next: (r) => this.categorias.set(r.data ?? []),
      error: () => this.categorias.set([])
    });
  }

  load(): void {
    this.loading.set(true);
    this.svc.getAll(this.busqueda().trim() || undefined).subscribe({
      next: (r) => {
        this.casos.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Códigos de caso', 'No se pudo cargar el catálogo.');
      }
    });
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.load();
  }

  openCreate(): void {
    this.modalMode.set('create');
    this.editCodigo.set('');
    this.form.reset({ codigo: '', descripcion: '', vigente: true, idCategoriaAsistente: '' });
    this.showModal.set(true);
  }

  openEdit(item: DtoCaso): void {
    this.modalMode.set('edit');
    this.editCodigo.set(item.codigo);
    this.form.reset({
      codigo:              item.codigo,
      descripcion:         item.descripcion,
      vigente:             item.vigente,
      idCategoriaAsistente: item.idCategoriaAsistente ?? ''
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Códigos de caso', 'Código y descripción son obligatorios.');
      return;
    }

    const v = this.form.getRawValue();
    const request: DtoCasoRequest = {
      codigo:              v.codigo.trim(),
      descripcion:         v.descripcion.trim(),
      vigente:             v.vigente,
      idCategoriaAsistente: v.idCategoriaAsistente || null
    };

    this.saving.set(true);
    const editCodigo = this.editCodigo();
    const request$ = this.modalMode() === 'edit'
      ? this.svc.update(editCodigo, request)
      : this.svc.create(request);

    request$.subscribe({
      next: (resp) => {
        this.saving.set(false);
        if (!resp.success) {
          this.toast.warning('Códigos de caso', resp.message);
          return;
        }
        this.toast.success('Códigos de caso', resp.message);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Códigos de caso', err?.error?.message ?? 'Error al guardar.');
      }
    });
  }

  toggleEstado(item: DtoCaso): void {
    this.svc.setEstado(item.codigo, !item.vigente).subscribe({
      next: (resp) => {
        if (!resp.success) {
          this.toast.warning('Códigos de caso', resp.message);
          return;
        }
        this.toast.success('Códigos de caso', resp.message);
        this.load();
      },
      error: () => this.toast.error('Códigos de caso', 'Error al cambiar el estado.')
    });
  }

  // ─── Importación masiva desde Excel ────────────────────────────────────────

  async onArchivoSeleccionado(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importando.set(true);
    this.resultadoImport.set(null);

    try {
      const items = await this.leerExcel(file);
      if (items.length === 0) {
        this.toast.warning('Importar', 'El archivo no tiene filas para importar.');
        this.importando.set(false);
        input.value = '';
        return;
      }

      this.svc.importar(items).subscribe({
        next: (resp) => {
          this.importando.set(false);
          this.resultadoImport.set(resp);
          if (resp.success) {
            this.toast.success('Importar', resp.message);
            this.load();
          } else {
            this.toast.warning('Importar', resp.message);
          }
        },
        error: (err) => {
          this.importando.set(false);
          this.toast.error('Importar', err?.error?.message ?? 'Error al importar el archivo.');
        }
      });
    } catch {
      this.importando.set(false);
      this.toast.error('Importar', 'No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) válido.');
    } finally {
      input.value = '';
    }
  }

  /** Lee la primera hoja: columna A = código, columna B = descripción, fila 1 = encabezado. */
  private async leerExcel(file: File): Promise<{ codigo: string; descripcion: string }[]> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const hoja = workbook.worksheets[0];
    const items: { codigo: string; descripcion: string }[] = [];
    if (!hoja) return items;

    hoja.eachRow((row, numeroFila) => {
      if (numeroFila === 1) return; // encabezado
      const codigo = String(row.getCell(1).value ?? '').trim();
      const descripcion = String(row.getCell(2).value ?? '').trim();
      if (codigo || descripcion) items.push({ codigo, descripcion });
    });

    return items;
  }

  async descargarPlantilla(): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet('Códigos de caso');
    hoja.columns = [
      { header: 'Código', key: 'codigo', width: 20 },
      { header: 'Descripción', key: 'descripcion', width: 50 }
    ];
    hoja.addRow({ codigo: '904', descripcion: 'Hurto calificado' });
    hoja.addRow({ codigo: '934', descripcion: 'Riña' });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_codigos_caso.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
