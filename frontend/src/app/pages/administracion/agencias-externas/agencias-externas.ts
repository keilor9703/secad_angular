import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports:     [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './agencias-externas.html',
  styleUrls:   ['./agencias-externas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgenciasExternasComponent implements OnInit {
  private readonly svc   = inject(AgenciaExternaService);
  private readonly toast = inject(ToastService);
  private readonly fb    = inject(FormBuilder);

  readonly agencias = signal<DtoAgenciaExterna[]>([]);
  readonly loading  = signal(false);
  readonly saving   = signal(false);

  readonly showModal  = signal(false);
  readonly modalMode  = signal<ModalMode>('create');
  readonly editId     = signal('');

  readonly tiposAgencia = TIPOS_AGENCIA;

  /** Campos del request no editados por esta UI todavía — se conservan al guardar. */
  private tipoAuth: DtoAgenciaExternaRequest['tipoAuth']             = 'BEARER';
  private apiUsuario                                                  = '';
  private apiPassword                                                 = '';
  private authExtra                                                   = '';
  private formatoPayload: DtoAgenciaExternaRequest['formatoPayload']  = 'PLANO';

  readonly form = this.fb.nonNullable.group({
    nombre:      ['', [Validators.required]],
    descripcion: [''],
    tipoAgencia: ['OTRA'],
    apiUrl:      [''],
    apiMetodo:   ['POST'],
    apiToken:    [''],
    activa:      [true]
  });

  // Campos auxiliares para el JSON de cabeceras y mapeo
  readonly formCabeceras = signal('');
  readonly formMapeo     = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next:  data => { this.agencias.set(data); this.loading.set(false); },
      error: ()   => { this.loading.set(false); this.toast.error('Error', 'No se pudieron cargar las agencias.'); }
    });
  }

  openCreate(): void {
    this.form.reset(this.emptyForm());
    this.tipoAuth = 'BEARER';
    this.apiUsuario = '';
    this.apiPassword = '';
    this.authExtra = '';
    this.formatoPayload = 'PLANO';
    this.formCabeceras.set('');
    this.formMapeo.set('');
    this.modalMode.set('create');
    this.editId.set('');
    this.showModal.set(true);
    document.body.classList.add('ui-modal-open');
  }

  openEdit(a: DtoAgenciaExterna): void {
    this.editId.set(a.id);
    this.modalMode.set('edit');
    this.form.reset({
      nombre:      a.nombre,
      descripcion: a.descripcion ?? '',
      tipoAgencia: a.tipoAgencia,
      apiUrl:      a.apiUrl ?? '',
      apiMetodo:   a.apiMetodo,
      apiToken:    '',   // nunca se pre-rellena por seguridad
      activa:      a.activa
    });
    this.tipoAuth       = a.tipoAuth ?? 'BEARER';
    this.apiUsuario     = a.apiUsuario ?? '';
    this.apiPassword    = '';
    this.authExtra      = a.authExtra ?? '';
    this.formatoPayload = a.formatoPayload ?? 'PLANO';
    this.formCabeceras.set(a.apiCabeceras ?? '');
    this.formMapeo.set(a.campoMapeo ?? '');
    this.showModal.set(true);
    document.body.classList.add('ui-modal-open');
  }

  closeModal(): void {
    this.showModal.set(false);
    document.body.classList.remove('ui-modal-open');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Requerido', 'El nombre de la agencia es obligatorio.');
      return;
    }

    const cabeceras = this.formCabeceras();
    const mapeo     = this.formMapeo();

    // Validar JSON si se ingresó algo
    if (cabeceras.trim()) {
      try { JSON.parse(cabeceras); }
      catch { this.toast.warning('JSON inválido', 'Las cabeceras HTTP no son un JSON válido.'); return; }
    }
    if (mapeo.trim()) {
      try { JSON.parse(mapeo); }
      catch { this.toast.warning('JSON inválido', 'El mapeo de campos no es un JSON válido.'); return; }
    }

    const v = this.form.getRawValue();
    const request: DtoAgenciaExternaRequest = {
      nombre:         v.nombre,
      descripcion:    v.descripcion,
      tipoAgencia:    v.tipoAgencia,
      apiUrl:         v.apiUrl,
      apiMetodo:      v.apiMetodo,
      tipoAuth:       this.tipoAuth,
      apiToken:       v.apiToken,
      apiUsuario:     this.apiUsuario,
      apiPassword:    this.apiPassword,
      authExtra:      this.authExtra,
      apiCabeceras:   cabeceras.trim() || undefined,
      campoMapeo:     mapeo.trim()     || undefined,
      formatoPayload: this.formatoPayload,
      activa:         v.activa
    };

    this.saving.set(true);
    const mode = this.modalMode();
    const obs = mode === 'create'
      ? this.svc.crear(request)
      : this.svc.actualizar(this.editId(), request);

    obs.subscribe({
      next: r => {
        this.saving.set(false);
        if (r.success) {
          this.toast.success('Guardado', r.message);
          this.closeModal();
          this.load();
        } else {
          this.toast.error('Error', r.message);
        }
      },
      error: () => { this.saving.set(false); this.toast.error('Error', 'No se pudo guardar.'); }
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

  private emptyForm() {
    return {
      nombre: '', descripcion: '', tipoAgencia: 'OTRA',
      apiUrl: '', apiMetodo: 'POST', apiToken: '', activa: true
    };
  }
}
