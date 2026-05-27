import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, NgxEditorModule],
  templateUrl: './gestion-correos-electronicos.html',
  styleUrls: ['./gestion-correos-electronicos.scss'],
})
export class GestionCorreosElectronicosComponent implements OnInit, OnDestroy {
  view: 'compose' | 'history' | 'settings' = 'compose';
  private apiUrl = `${environment.apiBaseUrl}`;

  cuentas: CuentaEmail[] = [];
  selectedCuentaId: number | null = null;
  
  emailForm = {
    para: '',
    cc: '',
    asunto: '',
    cuerpo: '',
    idClasificacion: null as number | null,
    prioridadAlta: false,
    acuseRecibido: false
  };
  
  clasificaciones: any[] = [];
  
  adjuntos: File[] = [];
  historial: CorreoEnviado[] = [];
  isSending = false;
  showSuccessModal = false;
  lastRadicado = '';
  selectedCorreo: CorreoEnviado | null = null;
  
  p: number = 1;
  pageSize: number = 10;

  get paginatedHistorial(): CorreoEnviado[] {
    const start = (this.p - 1) * this.pageSize;
    return this.historial.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.historial.length / this.pageSize);
  }

  nextPage(): void {
    if (this.p < this.totalPages) this.p++;
  }

  prevPage(): void {
    if (this.p > 1) this.p--;
  }
  
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

  constructor(
    private http: HttpClient,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.editor = new Editor({
      schema: schema,
      history: true,
      keyboardShortcuts: true
    });
    this.detailEditor = new Editor({
      schema: schema,
      history: false,
      keyboardShortcuts: false
    });
    
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
            const base64 = e.target.result;
            this.editor.commands
              .insertImage(base64)
              .exec();
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
      next: (data) => {
        this.clasificaciones = data.filter(d => d.idPadre === 198 && d.vigente === 1);
      },
      error: (err) => console.error('Error cargando clasificaciones', err)
    });
  }

  cargarCuentas(): void {
    this.http.get<any[]>(`${this.apiUrl}/CuentaEmail/mis-cuentas`).subscribe({
      next: (data) => {
        this.cuentas = data.filter(c => c.vigente === 1);
        if (this.cuentas.length > 0) {
          this.selectedCuentaId = this.cuentas[0].idCuenta;
          this.prefillOpcionesDesdeCuenta(this.cuentas[0]);
        } else {
          this.selectedCuentaId = null;
        }
      },
      error: (err) => console.error('Error cargando cuentas SMTP', err)
    });
  }

  setView(newView: 'compose' | 'history' | 'settings'): void {
    this.view = newView;
    if (newView === 'history') {
      this.cargarHistorial();
    }
  }

  onCuentaChange(): void {
    const cuenta = this.cuentas.find(c => c.idCuenta === this.selectedCuentaId);
    if (cuenta) this.prefillOpcionesDesdeCuenta(cuenta);
  }

  private prefillOpcionesDesdeCuenta(cuenta: CuentaEmail): void {
    this.emailForm.prioridadAlta = cuenta.prioridadAlta === 1;
    this.emailForm.acuseRecibido = cuenta.acuseRecibido === 1;
  }

  cargarHistorial(): void {
    this.http.get<any[]>(`${this.apiUrl}/GestionCorreos/historico`).subscribe({
      next: (data) => {
        this.historial = data.map(h => ({
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
        }));
      },
      error: (err) => console.error('Error cargando historial', err)
    });
  }

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        this.adjuntos.push(files[i]);
      }
    }
  }

  removeAttachment(index: number): void {
    this.adjuntos.splice(index, 1);
  }

  enviarCorreo(): void {
    if (!this.selectedCuentaId || (!this.emailForm.para?.trim() && !this.emailForm.cc?.trim()) || !this.emailForm.asunto || !this.emailForm.idClasificacion) {
      this.toast.warning('Campos requeridos', 'Por favor complete al menos un destinatario (Para o CCO), asunto y clasificación.');
      return;
    }

    this.isSending = true;
    const formData = new FormData();
    formData.append('idCuentaEmail', this.selectedCuentaId.toString());
    if (this.emailForm.para?.trim()) formData.append('para', this.emailForm.para.trim());
    if (this.emailForm.cc?.trim()) formData.append('cc', this.emailForm.cc.trim());
    formData.append('asunto', this.emailForm.asunto);
    formData.append('cuerpo', this.emailForm.cuerpo);

    formData.append('prioridadAlta', this.emailForm.prioridadAlta ? 'true' : 'false');
    formData.append('acuseRecibido', this.emailForm.acuseRecibido ? 'true' : 'false');

    if (this.emailForm.idClasificacion) {
      formData.append('idClasificacion', this.emailForm.idClasificacion.toString());
      const clasif = this.clasificaciones.find(c => c.idDominio === this.emailForm.idClasificacion);
      if (clasif) {
        formData.append('nombreClasificacion', clasif.descripcion);
      }
    }
    
    this.adjuntos.forEach(file => {
      formData.append('adjuntos', file, file.name);
    });

    this.http.post<any>(`${this.apiUrl}/GestionCorreos/enviar`, formData).subscribe({
      next: (res) => {
        this.isSending = false;
        const cuenta = this.cuentas.find(c => c.idCuenta === this.selectedCuentaId);
        
        this.historial.unshift({
          idEnvio: Date.now(),
          radicado: res.radicado || 'COR-GEN',
          deEmail: cuenta?.email || '',
          nombreCuenta: cuenta?.nombreCuenta || '',
          para: this.emailForm.para,
          asunto: this.emailForm.asunto,
          cuerpo: this.emailForm.cuerpo,
          fecha: new Date(),
          tieneAdjuntos: this.adjuntos.length > 0,
          username: '',
          nombreCompleto: '',
          clasificacion: ''
        });

        this.lastRadicado = res.radicado;
        this.showSuccessModal = true;
        this.toast.success('Envío Exitoso', `Radicado: ${res.radicado}`);
        if (res.message && res.message.toLowerCase().includes('advertencia')) {
          this.toast.warning('Advertencia', res.message);
        }
        this.limpiarFormulario();
      },
      error: (err) => {
        this.isSending = false;
        console.error('Error enviando correo', err);
        const msg = err.error?.message || err.error?.title || 'No se pudo procesar el envío';
        this.toast.error('Error de Envío', msg);
      }
    });
  }

  limpiarFormulario(): void {
    this.emailForm = { para: '', cc: '', asunto: '', cuerpo: '', idClasificacion: null, prioridadAlta: false, acuseRecibido: false };
    const cuenta = this.cuentas.find(c => c.idCuenta === this.selectedCuentaId);
    if (cuenta) this.prefillOpcionesDesdeCuenta(cuenta);
    this.adjuntos = [];
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.setView('history');
  }

  verDetalle(correo: CorreoEnviado): void {
    this.selectedCorreo = correo;
  }
}
