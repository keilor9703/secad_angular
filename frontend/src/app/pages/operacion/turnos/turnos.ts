import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  TurnosService,
  DtoTurnoListItem, DtoTurno, DtoTurnoUnidad, DtoMedioDisponible, DtoPersonalMedio,
  DtoCrearTurnoRequest, DtoCopiarTurnoRequest,
  DtoAgregarUnidadRequest, DtoAgregarMedioRequest,
  DtoImportarSiviccRequest,
  CLASE_TURNO, TIPO_MEDIO, EstadoMedio
} from '../../../core/services/operacion/turnos.service';
import { AuthService } from '../../../core/auth/auth.service';

// Leaflet cargado vía CDN en index.html
declare const L: any;

/** Formulario de crear/copiar turno — extiende el DTO con campos de fecha datetime-local */
interface FormTurnoConFecha extends DtoCrearTurnoRequest {
  _inicio: string;
  _fin:    string;
}
interface FormCopiarConFecha extends DtoCopiarTurnoRequest {
  _inicio: string;
  _fin:    string;
}

/** Formulario de medio: wrappea hasta 2 personal como campos individuales */
interface FormMedio extends DtoAgregarMedioRequest {
  _personal1Cedu: string;
  _personal1Nomb: string;
  _personal2Cedu: string;
  _personal2Nomb: string;
}

@Component({
  selector:    'app-turnos',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './turnos.html',
  styleUrls:   ['./turnos.scss']
})
export class TurnosComponent implements OnInit, OnDestroy, AfterViewChecked {

  // ── Services ─────────────────────────────────────────────────────────────────
  private turnosSvc = inject(TurnosService);
  private authSvc   = inject(AuthService);
  private cdr       = inject(ChangeDetectorRef);

  // ── Claims JWT ────────────────────────────────────────────────────────────────
  fuerzaId   = 0;
  sitioGraba = 0;

  // ── Filtros ───────────────────────────────────────────────────────────────────
  /** Fuerza a consultar (inicia con la del JWT, el usuario puede cambiarla) */
  fuerzaFiltro = 0;
  /** yyyy-MM-dd (formato del input[type=date]) */
  fechaBusqueda = '';
  cargando      = false;
  error         = '';

  // ── Lista de turnos ───────────────────────────────────────────────────────────
  turnos:           DtoTurnoListItem[] = [];
  turnoSeleccionado: DtoTurnoListItem | null = null;
  turnoDetalle:      DtoTurno        | null = null;

  // ── Unidades ──────────────────────────────────────────────────────────────────
  unidades:          DtoTurnoUnidad[] = [];
  unidadActiva:      DtoTurnoUnidad | null = null;
  cargandoUnidades = false;

  // ── Medios ────────────────────────────────────────────────────────────────────
  medios:          DtoMedioDisponible[] = [];
  cargandoMedios = false;

  // ── Mapa de medios ────────────────────────────────────────────────────────────
  mapaVisible         = false;
  private mapaMedios: any = null;
  private mapaInit    = false;
  private pendingMap  = false;
  private medioMarkers: any[] = [];

  // ── Modal: Crear turno ────────────────────────────────────────────────────────
  modalCrear       = false;
  guardandoCrear   = false;
  errorCrear       = '';
  formCrear: FormTurnoConFecha = this.nuevoFormCrear();

  // ── Modal: Copiar turno ───────────────────────────────────────────────────────
  modalCopiar      = false;
  guardandoCopiar  = false;
  errorCopiar      = '';
  formCopiar: FormCopiarConFecha = { turnoOrigenId: 0, claseTurno: 1, horaInicia: '', horaTermina: '', _inicio: '', _fin: '' };

  // ── Modal: Agregar unidad ─────────────────────────────────────────────────────
  modalUnidad      = false;
  guardandoUnidad  = false;
  errorUnidad      = '';
  formUnidad: DtoAgregarUnidadRequest = { turnoId: 0, unidadCodigo: '', unidadDesc: '', consignas: '' };

  // ── Modal: Agregar medio ──────────────────────────────────────────────────────
  modalMedio       = false;
  guardandoMedio   = false;
  errorMedio       = '';
  formMedio: FormMedio = this.nuevoFormMedio();

  // ── Modal: Importar SIVICC ────────────────────────────────────────────────────
  modalSivicc      = false;
  guardandoSivicc  = false;
  errorSivicc      = '';
  formSivicc: DtoImportarSiviccRequest = {
    turnoId: 0, siviccMinutaId: 0, siviccConsecutivo: 0, canalCodigo: undefined, fuerzaId: 0, sitioGraba: 0
  };

  // ── Mensajes de éxito inline ──────────────────────────────────────────────────
  msgExito = '';

  // ── Subscriptions ─────────────────────────────────────────────────────────────
  private subs = new Subscription();

  // ── Constantes expuestas al template ─────────────────────────────────────────
  readonly CLASE_TURNO = CLASE_TURNO;
  readonly TIPO_MEDIO  = TIPO_MEDIO;
  readonly TIPOS_MEDIO_LIST = [
    { value: 20, label: 'Motocicleta'     },
    { value: 21, label: 'Bicicleta'       },
    { value: 22, label: 'Patrulla'        },
    { value: 23, label: 'Ambulancia'      },
    { value: 24, label: 'Camión Bomberos' },
    { value: 25, label: 'Helicóptero'    },
    { value: 26, label: 'Lancha'          }
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    const claims    = this.authSvc.getJwtClaims();
    this.fuerzaId   = claims.fuerzaId;
    this.sitioGraba = claims.sitioGraba;
    this.fuerzaFiltro = this.fuerzaId;
    this.fechaBusqueda = this.hoyIso();
    this.cargarTurnos();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.destruirMapa();
  }

  ngAfterViewChecked(): void {
    if (this.pendingMap && this.mapaVisible) {
      this.initMapaMedios();
      this.pendingMap = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGA DE DATOS
  // ═══════════════════════════════════════════════════════════════════════════

  cargarTurnos(): void {
    if (!this.fuerzaFiltro || !this.fechaBusqueda) { this.error = 'Ingrese fuerza y fecha.'; return; }
    this.cargando = true;
    this.error    = '';
    this.turnosSvc.getTurnos(this.fuerzaFiltro, this.fechaParaApi(this.fechaBusqueda), this.sitioGraba)
      .subscribe({
        next: (t) => { this.turnos = t; this.cargando = false; },
        error: (e) => { this.cargando = false; this.error = 'Error al cargar turnos: ' + (e.error?.message ?? e.message); }
      });
  }

  seleccionarTurno(t: DtoTurnoListItem): void {
    if (this.turnoSeleccionado?.id === t.id) return;
    this.turnoSeleccionado = t;
    this.turnoDetalle      = null;
    this.unidades          = [];
    this.unidadActiva      = null;
    this.medios            = [];
    this.mapaVisible       = false;
    this.destruirMapa();

    // Detalle completo del turno
    this.turnosSvc.getTurno(t.id).subscribe({ next: d => this.turnoDetalle = d });

    // Cargar unidades
    this.cargandoUnidades = true;
    this.turnosSvc.getUnidades(t.id).subscribe({
      next: (u) => { this.unidades = u; this.cargandoUnidades = false; },
      error: ()  => { this.cargandoUnidades = false; }
    });
  }

  seleccionarUnidad(u: DtoTurnoUnidad): void {
    if (this.unidadActiva?.id === u.id) return;
    this.unidadActiva  = u;
    this.medios        = [];
    this.mapaVisible   = false;
    this.destruirMapa();
    this.cargarMedios(u.turnoId, u.id);
  }

  cargarMedios(turnoId: number, unidadId?: number): void {
    if (!this.turnoSeleccionado) return;
    this.cargandoMedios = true;
    this.turnosSvc.getMedios(turnoId, unidadId).subscribe({
      next: (m) => {
        this.medios         = m;
        this.cargandoMedios = false;
        if (this.mapaVisible) this.actualizarMarcadoresMedios();
      },
      error: () => { this.cargandoMedios = false; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAPA DE MEDIOS
  // ═══════════════════════════════════════════════════════════════════════════

  toggleMapa(): void {
    this.mapaVisible = !this.mapaVisible;
    if (this.mapaVisible) {
      if (!this.mapaInit) {
        this.pendingMap = true;
        this.cdr.detectChanges();
      } else {
        this.actualizarMarcadoresMedios();
      }
    }
  }

  private initMapaMedios(): void {
    if (this.mapaInit) return;
    const el = document.getElementById('mapaMedios');
    if (!el) return;
    try {
      const center: [number, number] = [4.711, -74.0721];
      this.mapaMedios = L.map('mapaMedios', { zoomControl: true }).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
      }).addTo(this.mapaMedios);
      this.mapaInit = true;
      this.actualizarMarcadoresMedios();
    } catch (e) {
      console.warn('[Turnos] Mapa error:', e);
    }
  }

  private actualizarMarcadoresMedios(): void {
    if (!this.mapaMedios) return;
    // Limpiar marcadores anteriores
    this.medioMarkers.forEach(m => { try { m.remove(); } catch { /**/ } });
    this.medioMarkers = [];

    const mediosConGps = this.medios.filter(m => m.latitud && m.longitud);
    mediosConGps.forEach(m => {
      const color = this.colorEstadoMedio(m.estado);
      const icon  = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;
                           background:${color};border:2px solid #fff;
                           box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14]
      });
      const marker = L.marker([m.latitud!, m.longitud!], { icon })
        .addTo(this.mapaMedios)
        .bindPopup(`<b>${m.patrullaCodigo}</b><br>
          ${m.estadoDesc}<br>
          ${m.personal.map(p => p.ceduEmpleado).join(' / ')}`);
      this.medioMarkers.push(marker);
    });

    if (mediosConGps.length > 0) {
      const bounds = L.latLngBounds(mediosConGps.map(m => [m.latitud!, m.longitud!]));
      this.mapaMedios.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  private destruirMapa(): void {
    if (this.mapaMedios) {
      try { this.mapaMedios.remove(); } catch { /**/ }
      this.mapaMedios = null;
      this.mapaInit   = false;
    }
    this.medioMarkers = [];
  }

  private colorEstadoMedio(estado: number): string {
    const m: Record<number, string> = {
      27: '#22c55e', 28: '#ef4444', 29: '#6b7280', 30: '#f59e0b', 31: '#3b82f6'
    };
    return m[estado] ?? '#94a3b8';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL: CREAR TURNO
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalCrear(): void {
    this.formCrear       = this.nuevoFormCrear();
    this.errorCrear      = '';
    this.guardandoCrear  = false;
    this.modalCrear      = true;
    this.bloquearScroll(true);
  }

  cerrarModalCrear(): void {
    this.modalCrear = false;
    this.bloquearScroll(false);
  }

  onClaseTurnoCrear(clase: number): void {
    this.formCrear.claseTurno = clase as 1 | 2 | 3;
    this.autocompletarHoras(clase, this.formCrear);
  }

  private autocompletarHoras(clase: number, form: any): void {
    const base = this.fechaBusqueda;
    const sigte = this.sumarDia(base);
    switch (clase) {
      case 1: form._inicio = `${base}T06:00`;  form._fin = `${base}T14:00`;  break;
      case 2: form._inicio = `${base}T14:00`;  form._fin = `${base}T22:00`;  break;
      case 3: form._inicio = `${base}T22:00`;  form._fin = `${sigte}T06:00`; break;
    }
  }

  guardarCrear(): void {
    if (!this.formCrear._inicio || !this.formCrear._fin) { this.errorCrear = 'Complete las fechas.'; return; }
    this.guardandoCrear  = true;
    this.errorCrear      = '';
    const req: DtoCrearTurnoRequest = {
      sitioGraba:  this.formCrear.sitioGraba,
      fuerzaId:    this.formCrear.fuerzaId,
      claseTurno:  this.formCrear.claseTurno,
      tipoTurno:   this.formCrear.tipoTurno,
      horaInicia:  this.dtLocalParaApi(this.formCrear._inicio),
      horaTermina: this.dtLocalParaApi(this.formCrear._fin),
      consignas:   this.formCrear.consignas
    };
    this.turnosSvc.crearTurno(req).subscribe({
      next: (r) => {
        this.guardandoCrear = false;
        if (r.success) {
          this.cerrarModalCrear();
          this.msgExito = `✔ Turno creado (ID ${r.id})`;
          setTimeout(() => (this.msgExito = ''), 4000);
          this.cargarTurnos();
        } else { this.errorCrear = r.message; }
      },
      error: (e) => { this.guardandoCrear = false; this.errorCrear = e.error?.message ?? 'Error al crear turno.'; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL: COPIAR TURNO
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalCopiar(): void {
    if (!this.turnoSeleccionado) return;
    this.formCopiar = {
      turnoOrigenId: this.turnoSeleccionado.id,
      claseTurno:    1,
      horaInicia:    '',
      horaTermina:   '',
      _inicio:       '',
      _fin:          ''
    };
    this.errorCopiar     = '';
    this.guardandoCopiar = false;
    this.modalCopiar     = true;
    this.bloquearScroll(true);
  }

  cerrarModalCopiar(): void {
    this.modalCopiar = false;
    this.bloquearScroll(false);
  }

  onClaseTurnoCopiar(clase: number): void {
    this.formCopiar.claseTurno = clase as 1 | 2 | 3;
    this.autocompletarHoras(clase, this.formCopiar);
  }

  guardarCopiar(): void {
    if (!this.formCopiar._inicio || !this.formCopiar._fin) { this.errorCopiar = 'Complete las fechas.'; return; }
    this.guardandoCopiar = true;
    this.errorCopiar     = '';
    const req: DtoCopiarTurnoRequest = {
      turnoOrigenId: this.formCopiar.turnoOrigenId,
      claseTurno:    this.formCopiar.claseTurno,
      tipoTurno:     this.formCopiar.tipoTurno,
      horaInicia:    this.dtLocalParaApi(this.formCopiar._inicio),
      horaTermina:   this.dtLocalParaApi(this.formCopiar._fin)
    };
    this.turnosSvc.copiarTurno(req).subscribe({
      next: (r) => {
        this.guardandoCopiar = false;
        if (r.success) {
          this.cerrarModalCopiar();
          this.msgExito = `✔ Turno copiado (nuevo ID ${r.id})`;
          setTimeout(() => (this.msgExito = ''), 4000);
          this.cargarTurnos();
        } else { this.errorCopiar = r.message; }
      },
      error: (e) => { this.guardandoCopiar = false; this.errorCopiar = e.error?.message ?? 'Error al copiar turno.'; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL: AGREGAR UNIDAD
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalUnidad(): void {
    if (!this.turnoSeleccionado) return;
    this.formUnidad   = { turnoId: this.turnoSeleccionado.id, unidadCodigo: '', unidadDesc: '', consignas: '' };
    this.errorUnidad  = '';
    this.guardandoUnidad = false;
    this.modalUnidad  = true;
    this.bloquearScroll(true);
  }

  cerrarModalUnidad(): void { this.modalUnidad = false; this.bloquearScroll(false); }

  guardarUnidad(): void {
    if (!this.formUnidad.unidadCodigo.trim()) { this.errorUnidad = 'El código de unidad es obligatorio.'; return; }
    this.guardandoUnidad = true;
    this.errorUnidad     = '';
    this.turnosSvc.agregarUnidad(this.formUnidad.turnoId, this.formUnidad).subscribe({
      next: (r) => {
        this.guardandoUnidad = false;
        if (r.success) {
          this.cerrarModalUnidad();
          this.msgExito = '✔ Unidad agregada.';
          setTimeout(() => (this.msgExito = ''), 3000);
          // Recargar unidades
          this.turnosSvc.getUnidades(this.formUnidad.turnoId).subscribe(u => this.unidades = u);
        } else { this.errorUnidad = r.message; }
      },
      error: (e) => { this.guardandoUnidad = false; this.errorUnidad = e.error?.message ?? 'Error.'; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL: AGREGAR MEDIO
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalMedio(): void {
    if (!this.turnoSeleccionado) return;
    this.formMedio       = this.nuevoFormMedio();
    this.formMedio.turnoId      = this.turnoSeleccionado.id;
    this.formMedio.turnoUnidadId = this.unidadActiva?.id ?? undefined;
    this.formMedio.unidadCodigo  = this.unidadActiva?.unidadCodigo ?? undefined;
    this.formMedio.fuerzaId      = this.fuerzaFiltro;
    this.errorMedio    = '';
    this.guardandoMedio = false;
    this.modalMedio    = true;
    this.bloquearScroll(true);
  }

  cerrarModalMedio(): void { this.modalMedio = false; this.bloquearScroll(false); }

  guardarMedio(): void {
    if (!this.formMedio.patrullaCodigo.trim()) { this.errorMedio = 'El código de patrulla es obligatorio.'; return; }
    this.guardandoMedio = true;
    this.errorMedio     = '';

    // Construir personal desde los campos separados
    const personal: DtoPersonalMedio[] = [];
    if (this.formMedio._personal1Cedu.trim()) {
      personal.push({ ceduEmpleado: this.formMedio._personal1Cedu.trim(), nombrePolicial: this.formMedio._personal1Nomb.trim() || undefined });
    }
    if (this.formMedio._personal2Cedu.trim()) {
      personal.push({ ceduEmpleado: this.formMedio._personal2Cedu.trim(), nombrePolicial: this.formMedio._personal2Nomb.trim() || undefined });
    }

    const req: DtoAgregarMedioRequest = {
      turnoId:       this.formMedio.turnoId,
      turnoUnidadId: this.formMedio.turnoUnidadId,
      unidadCodigo:  this.formMedio.unidadCodigo,
      fuerzaId:      this.formMedio.fuerzaId,
      canalCodigo:   this.formMedio.canalCodigo,
      canalFuerzaId: this.formMedio.canalFuerzaId,
      patrullaCodigo: this.formMedio.patrullaCodigo.trim().toUpperCase(),
      patrullaDesc:  this.formMedio.patrullaDesc?.trim(),
      tipoMedio:     this.formMedio.tipoMedio,
      personal
    };
    this.turnosSvc.agregarMedio(req.turnoId, req).subscribe({
      next: (r) => {
        this.guardandoMedio = false;
        if (r.success) {
          this.cerrarModalMedio();
          this.msgExito = '✔ Medio agregado.';
          setTimeout(() => (this.msgExito = ''), 3000);
          if (this.unidadActiva) this.cargarMedios(req.turnoId, req.turnoUnidadId);
          // Actualizar conteo en turno seleccionado
          this.turnosSvc.getUnidades(req.turnoId).subscribe(u => this.unidades = u);
        } else { this.errorMedio = r.message; }
      },
      error: (e) => { this.guardandoMedio = false; this.errorMedio = e.error?.message ?? 'Error.'; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL: IMPORTAR SIVICC
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalSivicc(): void {
    if (!this.turnoSeleccionado) return;
    this.formSivicc = {
      turnoId: this.turnoSeleccionado.id,
      siviccMinutaId: 0, siviccConsecutivo: 0,
      fuerzaId: this.fuerzaFiltro,
      sitioGraba: this.sitioGraba
    };
    this.errorSivicc     = '';
    this.guardandoSivicc = false;
    this.modalSivicc     = true;
    this.bloquearScroll(true);
  }

  cerrarModalSivicc(): void { this.modalSivicc = false; this.bloquearScroll(false); }

  guardarSivicc(): void {
    if (!this.formSivicc.siviccMinutaId) { this.errorSivicc = 'ID de minuta SIVICC requerido.'; return; }
    this.guardandoSivicc = true;
    this.errorSivicc     = '';
    this.turnosSvc.importarSivicc(this.formSivicc.turnoId, this.formSivicc).subscribe({
      next: (r) => {
        this.guardandoSivicc = false;
        if (r.success) {
          this.cerrarModalSivicc();
          this.msgExito = '✔ Importación SIVICC completada.';
          setTimeout(() => (this.msgExito = ''), 4000);
          this.cargarTurnos();
          if (this.turnoSeleccionado) {
            this.turnosSvc.getUnidades(this.turnoSeleccionado.id).subscribe(u => this.unidades = u);
          }
        } else { this.errorSivicc = r.message; }
      },
      error: (e) => { this.guardandoSivicc = false; this.errorSivicc = e.error?.message ?? 'Error SIVICC.'; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS DE PRESENTACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  claseTurnoDesc(clase: number): string {
    return this.turnosSvc.etiquetaClaseTurno(clase as 1 | 2 | 3);
  }

  claseTurnoCorto(clase: number): string {
    return this.turnosSvc.etiquetaClaseTurnoCorta(clase as 1 | 2 | 3);
  }

  /** Formatea la lista de personal de un medio para mostrar en la UI. */
  formatearPersonal(personal: DtoPersonalMedio[]): string {
    if (!personal?.length) return '—';
    return personal
      .map(p => p.ceduEmpleado + (p.nombrePolicial ? ' – ' + p.nombrePolicial : ''))
      .join(' | ');
  }

  claseTurnoCss(clase: number): string {
    return { 1: 'tr-clase-1', 2: 'tr-clase-2', 3: 'tr-clase-3' }[clase] ?? 'tr-clase-1';
  }

  estadoTurnoCss(estado: string): string {
    return { A: 'tr-estado-a', C: 'tr-estado-c', V: 'tr-estado-v' }[estado] ?? 'tr-estado-a';
  }

  estadoMedioCss(estado: number): string {
    return this.turnosSvc.claseEstadoMedio(estado as EstadoMedio);
  }

  iconoTipo(tipo: number): string {
    return this.turnosSvc.iconoTipoMedio(tipo as any);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSIÓN DE FECHAS
  // ═══════════════════════════════════════════════════════════════════════════

  /** yyyy-MM-dd → dd/MM/yyyy */
  private fechaParaApi(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** yyyy-MM-ddTHH:mm → dd/MM/yyyy HH:mm */
  private dtLocalParaApi(local: string): string {
    if (!local) return '';
    const [date, time] = local.split('T');
    const [y, m, d]    = date.split('-');
    return `${d}/${m}/${y} ${time ?? '00:00'}`;
  }

  private hoyIso(): string {
    return new Date().toISOString().substring(0, 10);
  }

  private sumarDia(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().substring(0, 10);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FÁBRICA DE FORMS VACÍOS
  // ═══════════════════════════════════════════════════════════════════════════

  private nuevoFormCrear(): FormTurnoConFecha {
    return {
      sitioGraba:  this.sitioGraba,
      fuerzaId:    this.fuerzaFiltro,
      claseTurno:  1,
      horaInicia:  '',
      horaTermina: '',
      consignas:   '',
      _inicio:     '',
      _fin:        ''
    };
  }

  private nuevoFormMedio(): FormMedio {
    return {
      turnoId: 0, turnoUnidadId: undefined, unidadCodigo: undefined,
      fuerzaId: 0, canalCodigo: undefined, canalFuerzaId: undefined,
      patrullaCodigo: '', patrullaDesc: undefined, tipoMedio: 22, personal: [],
      _personal1Cedu: '', _personal1Nomb: '',
      _personal2Cedu: '', _personal2Nomb: ''
    };
  }

  // ─── scroll lock ──────────────────────────────────────────────────────────
  private bloquearScroll(block: boolean): void {
    document.body.classList.toggle('ui-modal-open', block);
  }

  // ─── trackBy helpers ──────────────────────────────────────────────────────
  trackByTurno(_: number, t: DtoTurnoListItem): number { return t.id; }
  trackByUnidad(_: number, u: DtoTurnoUnidad): number  { return u.id; }
  trackByMedio(_: number, m: DtoMedioDisponible): number { return m.id; }
}
