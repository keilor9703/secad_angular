import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';
import { Editor, Toolbar, schema, NgxEditorModule } from 'ngx-editor';

interface CuentaEmail {
  idCuenta: number;
  nombreCuenta: string;
  email: string;
  vigente: number;
  prioridadAlta: number;
  acuseRecibido: number;
}

interface CorreoEnviado {
  idEnvio: number;
  radicado: string;
  deEmail: string;
  nombreCuenta: string;
  para: string;
  asunto: string;
  cuerpo: string;
  fecha: Date;
  tieneAdjuntos: boolean;
  username: string;
  nombreCompleto: string;
  clasificacion: string;
}

@Component({
  selector: 'app-gestion-correos-electronicos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxEditorModule],
  templateUrl: './gestion-correos-electronicos.html',
  styleUrls: ['./gestion-correos-electronicos.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GestionCorreosElectronicosComponent implements OnInit, OnDestroy {
  private readonly http  = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly fb    = inject(FormBuilder);

  readonly view = signal<'compose' | 'history' | 'settings'>('compose');
  private apiUrl = `${environment.apiBaseUrl}`;

  readonly cuentas          = signal<CuentaEmail[]>([]);
  readonly selectedCuentaId = signal<number | null>(null);

  readonly emailForm = this.fb.nonNullable.group({
    para:            [''],
    cc:              [''],
    asunto:          [''],
    cuerpo:          [''],
    idClasificacion: this.fb.control<number | null>(null),
    prioridadAlta:   [false],
    acuseRecibido:   [false]
  });

  readonly clasificaciones = signal<any[]>([]);
  readonly adjuntos        = signal<File[]>([]);
  readonly historial       = signal<CorreoEnviado[]>([]);
  readonly isSending       = signal(false);
  readonly showSuccessModal = signal(false);
  readonly lastRadicado    = signal('');
  readonly selectedCorreo  = signal<CorreoEnviado | null>(null);

  readonly p        = signal(1);
  readonly pageSize = 10;

  readonly paginatedHistorial = computed(() => {
    const start = (this.p() - 1) * this.pageSize;
    return this.historial().slice(start, start + this.pageSize);
  });

  readonly totalPages = computed(() => Math.ceil(this.historial().length / this.pageSize));

  nextPage(): void { if (this.p() < this.totalPages()) this.p.update(v => v + 1); }
  prevPage(): void { if (this.p() > 1) this.p.update(v => v - 1); }

  editor!: Editor;
  detailEditor!: Editor;
  toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline', 'strike'],
    ['blockquote', 'code'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
  ];

  ngOnInit(): void {
    this.editor = new Editor({ schema, history: true, keyboardShortcuts: true });
    this.detailEditor = new Editor({ schema, history: false, keyboardShortcuts: false });
    this.cargarCuentas();
    this.cargarClasificaciones();
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.editor.commands.insertImage(e.target.result).exec();
          };
          reader.readAsDataURL(file);
          event.preventDefault();
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.editor.destroy();
    this.detailEditor.destroy();
  }

  cargarClasificaciones(): void {
    this.http.get<any[]>(`${this.apiUrl}/Dominio`).subscribe({
      next: (data) => { this.clasificaciones.set(data.filter(d => d.idPadre === 198 && d.vigente === 1)); },
      error: (err) => console.error('Error cargando clasificaciones', err)
    });
  }

  cargarCuentas(): void {
    this.http.get<any[]>(`${this.apiUrl}/CuentaEmail/mis-cuentas`).subscribe({
      next: (data) => {
        const activas = data.filter(c => c.vigente === 1);
        this.cuentas.set(activas);
        if (activas.length > 0) {
          this.selectedCuentaId.set(activas[0].idCuenta);
          this.prefillOpcionesDesdeCuenta(activas[0]);
        } else {
          this.selectedCuentaId.set(null);
        }
      },
      error: (err) => console.error('Error cargando cuentas SMTP', err)
    });
  }

  setView(newView: 'compose' | 'history' | 'settings'): void {
    this.view.set(newView);
    if (newView === 'history') this.cargarHistorial();
  }

  onCuentaChange(): void {
    const cuenta = this.cuentas().find(c => c.idCuenta === this.selectedCuentaId());
    if (cuenta) this.prefillOpcionesDesdeCuenta(cuenta);
  }

  private prefillOpcionesDesdeCuenta(cuenta: CuentaEmail): void {
    this.emailForm.patchValue({
      prioridadAlta: cuenta.prioridadAlta === 1,
      acuseRecibido: cuenta.acuseRecibido === 1
    });
  }

  cargarHistorial(): void {
    this.http.get<any[]>(`${this.apiUrl}/GestionCorreos/historico`).subscribe({
      next: (data) => {
        this.historial.set(data.map(h => ({
          idEnvio: h.idEnvio,
          radicado: h.radicado,
          deEmail: h.deEmail,
          nombreCuenta: h.nombreCuenta,
          para: h.destinatario,
          asunto: h.asunto,
          cuerpo: h.cuerpo,
          fecha: new Date(h.fecha),
          tieneAdjuntos: false,
          username: h.username,
          nombreCompleto: h.nombreCompleto,
          clasificacion: h.clasificacion
        })));
      },
      error: (err) => console.error('Error cargando historial', err)
    });
  }

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files) {
      const nuevos = [...this.adjuntos()];
      for (let i = 0; i < files.length; i++) nuevos.push(files[i]);
      this.adjuntos.set(nuevos);
    }
  }

  removeAttachment(index: number): void {
    this.adjuntos.update(items => items.filter((_, i) => i !== index));
  }

  enviarCorreo(): void {
    const v = this.emailForm.getRawValue();
    const cuentaId = this.selectedCuentaId();
    if (!cuentaId || (!v.para?.trim() && !v.cc?.trim()) || !v.asunto || !v.idClasificacion) {
      this.toast.warning('Campos requeridos', 'Por favor complete al menos un destinatario (Para o CCO), asunto y clasificación.');
      return;
    }

    this.isSending.set(true);
    const formData = new FormData();
    formData.append('idCuentaEmail', cuentaId.toString());
    if (v.para?.trim()) formData.append('para', v.para.trim());
    if (v.cc?.trim())  formData.append('cc', v.cc.trim());
    formData.append('asunto', v.asunto);
    formData.append('cuerpo', v.cuerpo);
    formData.append('prioridadAlta', v.prioridadAlta ? 'true' : 'false');
    formData.append('acuseRecibido', v.acuseRecibido ? 'true' : 'false');

    if (v.idClasificacion) {
      formData.append('idClasificacion', v.idClasificacion.toString());
      const clasif = this.clasificaciones().find(c => c.idDominio === v.idClasificacion);
      if (clasif) formData.append('nombreClasificacion', clasif.descripcion);
    }

    const adjuntos = this.adjuntos();
    adjuntos.forEach(file => formData.append('adjuntos', file, file.name));

    this.http.post<any>(`${this.apiUrl}/GestionCorreos/enviar`, formData).subscribe({
      next: (res) => {
        this.isSending.set(false);
        const cuenta = this.cuentas().find(c => c.idCuenta === cuentaId);
        this.historial.update(items => [{
          idEnvio: Date.now(), radicado: res.radicado || 'COR-GEN',
          deEmail: cuenta?.email || '', nombreCuenta: cuenta?.nombreCuenta || '',
          para: v.para, asunto: v.asunto, cuerpo: v.cuerpo,
          fecha: new Date(), tieneAdjuntos: adjuntos.length > 0,
          username: '', nombreCompleto: '', clasificacion: ''
        }, ...items]);
        this.lastRadicado.set(res.radicado);
        this.showSuccessModal.set(true);
        this.toast.success('Envío Exitoso', `Radicado: ${res.radicado}`);
        if (res.message?.toLowerCase().includes('advertencia')) this.toast.warning('Advertencia', res.message);
        this.limpiarFormulario();
      },
      error: (err) => {
        this.isSending.set(false);
        const msg = err.error?.message || err.error?.title || 'No se pudo procesar el envío';
        this.toast.error('Error de Envío', msg);
      }
    });
  }

  limpiarFormulario(): void {
    this.emailForm.reset({ para: '', cc: '', asunto: '', cuerpo: '', idClasificacion: null, prioridadAlta: false, acuseRecibido: false });
    const cuenta = this.cuentas().find(c => c.idCuenta === this.selectedCuentaId());
    if (cuenta) this.prefillOpcionesDesdeCuenta(cuenta);
    this.adjuntos.set([]);
  }

  closeSuccessModal(): void { this.showSuccessModal.set(false); this.setView('history'); }
  verDetalle(correo: CorreoEnviado): void { this.selectedCorreo.set(correo); }
}
