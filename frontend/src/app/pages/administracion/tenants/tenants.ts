import { Component, ChangeDetectionStrategy, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SuperAdminService, TenantPublico, TenantRequest } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-tenants',
  templateUrl: './tenants.html',
  styleUrls: ['./tenants.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TenantsComponent implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly toast   = inject(ToastService);
  private readonly fb      = inject(FormBuilder);

  readonly tenants = signal<TenantPublico[]>([]);
  readonly loading = signal(false);
  readonly saving  = signal(false);

  readonly showModal = signal(false);
  readonly modalMode = signal<ModalMode>('create');
  readonly editId    = signal(0);

  readonly form = this.fb.nonNullable.group({
    codDane:      ['', [Validators.required]],
    codUnidad:    [''],
    nombre:       ['', [Validators.required]],
    departamento: [''],
    municipio:    [''],
    categoria:    ['A'],
    sitioGraba:   this.fb.control<number | null>(null),
    dbHost:       [''],
    dbPort:       [5432],
    dbName:       [''],
    dbUsername:   [''],
    dbPassword:   [''],
    activo:       [true]
  });

  constructor() {
    // Asegurar que el body quede limpio si el componente se destruye con modal abierta
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('ui-modal-open'));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.getTenants().subscribe({
      next: data => { this.tenants.set(data); this.loading.set(false); },
      error: ()   => { this.loading.set(false); this.toast.error('Error', 'Error al cargar tenants.'); }
    });
  }

  openCreate(): void {
    this.form.reset(this.emptyForm());
    this.modalMode.set('create');
    this.editId.set(0);
    this.showModal.set(true);
    document.body.classList.add('ui-modal-open');
  }

  openEdit(t: TenantPublico): void {
    this.editId.set(t.id);
    this.modalMode.set('edit');
    this.form.reset({
      codDane:      t.codDane,
      codUnidad:    t.codUnidad,
      nombre:       t.nombre,
      departamento: t.departamento,
      municipio:    t.municipio,
      categoria:    t.categoria ?? 'A',
      sitioGraba:   t.sitioGraba ?? null,
      dbHost:       '',
      dbPort:       5432,
      dbName:       '',
      dbUsername:   '',
      dbPassword:   '',
      activo:       t.activo
    });
    this.showModal.set(true);
    document.body.classList.add('ui-modal-open');
  }

  closeModal(): void {
    this.showModal.set(false);
    document.body.classList.remove('ui-modal-open');
  }

  save(): void {
    const v = this.form.getRawValue();
    if (!v.codDane || !v.nombre) {
      this.toast.warning('Campos requeridos', 'Código DANE y Nombre son obligatorios.');
      return;
    }
    const mode = this.modalMode();
    if (mode === 'create') {
      if (!v.dbHost || !v.dbName || !v.dbUsername) {
        this.toast.warning('Campos requeridos', 'Complete los datos de conexión a BD (Host, Nombre, Usuario).');
        return;
      }
      if (!v.dbPassword) {
        this.toast.warning('Contraseña requerida', 'La contraseña de BD es obligatoria al crear un tenant.');
        return;
      }
    }

    this.saving.set(true);
    const request: TenantRequest = v;
    const obs = mode === 'create'
      ? this.service.createTenant(request)
      : this.service.updateTenant(this.editId(), request);

    obs.subscribe({
      next: result => {
        this.saving.set(false);
        if (result.success) {
          this.toast.success('Guardado', result.message);
          this.closeModal();
          this.load();
        } else {
          this.toast.error('Error', result.message);
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error', 'Error al guardar tenant.');
      }
    });
  }

  toggle(t: TenantPublico): void {
    this.service.toggleTenant(t.id).subscribe({
      next: result => {
        if (result.success) {
          this.toast.success('Estado actualizado', result.message);
          this.load();
        } else {
          this.toast.error('Error', result.message);
        }
      },
      error: () => this.toast.error('Error', 'Error al cambiar estado.')
    });
  }

  nivelLabel = (n: number) => this.service.nivelLabel(n);
  nivelClass = (n: number) => this.service.nivelClass(n);
  nivelIcon  = (n: number) => this.service.nivelIcon(n);

  private emptyForm(): TenantRequest {
    return {
      codDane: '', codUnidad: '', nombre: '',
      departamento: '', municipio: '', categoria: 'A',
      sitioGraba: null,
      dbHost: '', dbPort: 5432, dbName: '',
      dbUsername: '', dbPassword: '', activo: true
    };
  }
}
