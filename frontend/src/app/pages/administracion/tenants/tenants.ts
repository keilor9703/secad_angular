import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService, TenantPublico, TenantRequest } from '../../../core/services/super-admin.service';
import { ToastService } from '../../../core/services/toast.service';

type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-tenants',
  templateUrl: './tenants.html',
  styleUrls: ['./tenants.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class TenantsComponent implements OnInit, OnDestroy {
  tenants: TenantPublico[] = [];
  loading   = false;
  saving    = false;

  showModal  = false;
  modalMode: ModalMode = 'create';
  editId     = 0;

  form: TenantRequest = this.emptyForm();

  constructor(
    private service: SuperAdminService,
    private toast:   ToastService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    // Asegurar que el body quede limpio si el componente se destruye con modal abierta
    document.body.classList.remove('ui-modal-open');
  }

  load(): void {
    this.loading = true;
    this.service.getTenants().subscribe({
      next: data => { this.tenants = data; this.loading = false; },
      error: ()   => { this.loading = false; this.toast.error('Error', 'Error al cargar tenants.'); }
    });
  }

  openCreate(): void {
    this.form      = this.emptyForm();
    this.modalMode = 'create';
    this.editId    = 0;
    this.showModal = true;
    document.body.classList.add('ui-modal-open');
  }

  openEdit(t: TenantPublico): void {
    this.editId    = t.id;
    this.modalMode = 'edit';
    this.form = {
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
    };
    this.showModal = true;
    document.body.classList.add('ui-modal-open');
  }

  closeModal(): void {
    this.showModal = false;
    document.body.classList.remove('ui-modal-open');
  }

  save(): void {
    if (!this.form.codDane || !this.form.nombre) {
      this.toast.warning('Campos requeridos', 'Código DANE y Nombre son obligatorios.');
      return;
    }
    if (this.modalMode === 'create') {
      if (!this.form.dbHost || !this.form.dbName || !this.form.dbUsername) {
        this.toast.warning('Campos requeridos', 'Complete los datos de conexión a BD (Host, Nombre, Usuario).');
        return;
      }
      if (!this.form.dbPassword) {
        this.toast.warning('Contraseña requerida', 'La contraseña de BD es obligatoria al crear un tenant.');
        return;
      }
    }

    this.saving = true;
    const obs = this.modalMode === 'create'
      ? this.service.createTenant(this.form)
      : this.service.updateTenant(this.editId, this.form);

    obs.subscribe({
      next: result => {
        this.saving = false;
        if (result.success) {
          this.toast.success('Guardado', result.message);
          this.closeModal();
          this.load();
        } else {
          this.toast.error('Error', result.message);
        }
      },
      error: () => {
        this.saving = false;
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
