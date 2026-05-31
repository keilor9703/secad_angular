import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AgenciaExternaService,
  DtoAgenciaExterna,
  DtoAgenciaExternaRequest,
  TIPOS_AGENCIA
} from '../../../core/services/operacion/agencia-externa.service';
import { ToastService } from '../../../core/services/toast.service';

type ModalMode = 'create' | 'edit';

@Component({
  selector:    'app-agencias-externas',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './agencias-externas.html',
  styleUrls:   ['./agencias-externas.scss']
})
export class AgenciasExternasComponent implements OnInit {

  agencias:  DtoAgenciaExterna[] = [];
  loading    = false;
  saving     = false;

  showModal  = false;
  modalMode: ModalMode = 'create';
  editId     = '';

  readonly tiposAgencia = TIPOS_AGENCIA;

  form: DtoAgenciaExternaRequest = this.emptyForm();

  // Campos auxiliares para el JSON de cabeceras y mapeo
  formCabeceras = '';
  formMapeo     = '';

  constructor(
    private svc:   AgenciaExternaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next:  data => { this.agencias = data; this.loading = false; },
      error: ()   => { this.loading = false; this.toast.error('Error', 'No se pudieron cargar las agencias.'); }
    });
  }

  openCreate(): void {
    this.form          = this.emptyForm();
    this.formCabeceras = '';
    this.formMapeo     = '';
    this.modalMode     = 'create';
    this.editId        = '';
    this.showModal     = true;
    document.body.classList.add('ui-modal-open');
  }

  openEdit(a: DtoAgenciaExterna): void {
    this.editId    = a.id;
    this.modalMode = 'edit';
    this.form = {
      nombre:         a.nombre,
      descripcion:    a.descripcion ?? '',
      tipoAgencia:    a.tipoAgencia,
      apiUrl:         a.apiUrl ?? '',
      apiMetodo:      a.apiMetodo,
      tipoAuth:       a.tipoAuth ?? 'BEARER',
      apiToken:       '',   // nunca se pre-rellena por seguridad
      apiUsuario:     a.apiUsuario ?? '',
      apiPassword:    '',
      authExtra:      a.authExtra ?? '',
      apiCabeceras:   a.apiCabeceras ?? '',
      campoMapeo:     a.campoMapeo ?? '',
      formatoPayload: a.formatoPayload ?? 'PLANO',
      activa:         a.activa,
    };
    this.formCabeceras = a.apiCabeceras ?? '';
    this.formMapeo     = a.campoMapeo ?? '';
    this.showModal     = true;
    document.body.classList.add('ui-modal-open');
  }

  closeModal(): void {
    this.showModal = false;
    document.body.classList.remove('ui-modal-open');
  }

  save(): void {
    if (!this.form.nombre.trim()) {
      this.toast.warning('Requerido', 'El nombre de la agencia es obligatorio.');
      return;
    }

    // Validar JSON si se ingresó algo
    if (this.formCabeceras.trim()) {
      try { JSON.parse(this.formCabeceras); }
      catch { this.toast.warning('JSON inválido', 'Las cabeceras HTTP no son un JSON válido.'); return; }
    }
    if (this.formMapeo.trim()) {
      try { JSON.parse(this.formMapeo); }
      catch { this.toast.warning('JSON inválido', 'El mapeo de campos no es un JSON válido.'); return; }
    }

    this.form.apiCabeceras = this.formCabeceras.trim() || undefined;
    this.form.campoMapeo   = this.formMapeo.trim()     || undefined;

    this.saving = true;
    const obs = this.modalMode === 'create'
      ? this.svc.crear(this.form)
      : this.svc.actualizar(this.editId, this.form);

    obs.subscribe({
      next: r => {
        this.saving = false;
        if (r.success) {
          this.toast.success('Guardado', r.message);
          this.closeModal();
          this.load();
        } else {
          this.toast.error('Error', r.message);
        }
      },
      error: () => { this.saving = false; this.toast.error('Error', 'No se pudo guardar.'); }
    });
  }

  toggle(a: DtoAgenciaExterna): void {
    this.svc.toggle(a.id).subscribe({
      next: r => {
        if (r.success) { this.toast.success('Estado', r.message); this.load(); }
        else             this.toast.error('Error', r.message);
      },
      error: () => this.toast.error('Error', 'No se pudo cambiar el estado.')
    });
  }

  getTipoLabel = (t: string) => this.svc.getTipoLabel(t);
  getTipoIcon  = (t: string) => this.svc.getTipoIcon(t);

  private emptyForm(): DtoAgenciaExternaRequest {
    return {
      nombre: '', descripcion: '', tipoAgencia: 'OTRA',
      apiUrl: '', apiMetodo: 'POST',
      tipoAuth: 'BEARER', apiToken: '', apiUsuario: '', apiPassword: '',
      apiCabeceras: '', campoMapeo: '', formatoPayload: 'PLANO', activa: true
    };
  }
}
