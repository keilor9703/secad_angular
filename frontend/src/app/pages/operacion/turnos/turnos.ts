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
  DtoAgregarUnidadRequest, DtoAgregarMedioRequest, DtoActualizarMedioRequest,
  DtoImportarSiviccRequest, DtoUnidadSivicc,
  CLASE_TURNO, TIPO_MEDIO, EstadoMedio
} from '../../../core/services/operacion/turnos.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EventoService, DtoCanalItem } from '../../../core/services/operacion/evento.service';

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
  private turnosSvc  = inject(TurnosService);
  private authSvc    = inject(AuthService);
  private cdr        = inject(ChangeDetectorRef);
  private eventoSvc  = inject(EventoService);

  // ── Canales de radio (cargados una vez) ───────────────────────────────────────
  canales: DtoCanalItem[] = [];
  cargandoCanales = false;

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
  formCopiar: FormCopiarConFecha = { turnoOrigenId: '', claseTurno: 1, horaInicia: '', horaTermina: '', _inicio: '', _fin: '' };

  // ── Modal: Agregar unidad ─────────────────────────────────────────────────────
  modalUnidad      = false;
  guardandoUnidad  = false;
  errorUnidad      = '';
  formUnidad: DtoAgregarUnidadRequest = { turnoId: '', unidadCodigo: '', unidadDesc: '', consignas: '' };

  // ── Modal: Agregar medio ──────────────────────────────────────────────────────
  modalMedio       = false;
  guardandoMedio   = false;
  errorMedio       = '';
  formMedio: FormMedio = this.nuevoFormMedio();

  // ── Modal: Editar medio ───────────────────────────────────────────────────────
  modalEditarMedio      = false;
  guardandoEditarMedio  = false;
  errorEditarMedio      = '';
  medioEditando: DtoMedioDisponible | null = null;
  formEditarMedio: FormMedio = this.nuevoFormMedio();

  // ── Modal: Importar SIVICC (wizard 2 pasos) ──────────────────────────────────
  modalSivicc           = false;
  /** Paso 1: consultando unidades en SIVICC */
  cargandoUnidadesSivicc = false;
  /** Unidades disponibles retornadas por GET .../sivicc/unidades */
  unidadesSivicc: DtoUnidadSivicc[] = [];
  /** Paso 3: importando */
  guardandoSivicc  = false;
  errorSivicc      = '';
  /** Canal radio a asignar (opcional) */
  siviccCanalCodigo: number | undefined = undefined;
  formSivicc: DtoImportarSiviccRequest = {
    turnoId: '', fuerzaId: 0, sitioGraba: 0, unidades: []
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

  cargarMedios(turnoId: string, unidadId?: string): void {
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
    this.formMedio              = this.nuevoFormMedio();
    this.formMedio.turnoId      = this.turnoSeleccionado.id;
    this.formMedio.turnoUnidadId = this.unidadActiva?.id ?? undefined;
    this.formMedio.unidadCodigo  = this.unidadActiva?.unidadCodigo ?? undefined;
    this.formMedio.fuerzaId      = this.fuerzaFiltro;
    this.errorMedio    = '';
    this.guardandoMedio = false;
    this.modalMedio    = true;
    this.bloquearScroll(true);
    // Cargar canales si aún no están disponibles
    this.cargarCanales();
  }

  /** Carga los canales de radio del sitio una sola vez (lazy). */
  private cargarCanales(): void {
    if (this.canales.length > 0 || this.cargandoCanales) return;
    this.cargandoCanales = true;
    this.eventoSvc.getCanales(this.sitioGraba).subscribe({
      next:  c  => { this.canales = c; this.cargandoCanales = false; },
      error: () => { this.cargandoCanales = false; }
    });
  }

  cerrarModalMedio(): void { this.modalMedio = false; this.bloquearScroll(false); }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL: EDITAR MEDIO
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalEditarMedio(m: DtoMedioDisponible): void {
    this.medioEditando      = m;
    this.errorEditarMedio   = '';
    this.guardandoEditarMedio = false;

    // Pre-cargar el formulario con los datos actuales del medio
    this.formEditarMedio = {
      turnoId:        m.turnoId,
      turnoUnidadId:  m.turnoUnidadId,
      unidadCodigo:   m.unidadCodigo,
      fuerzaId:       m.fuerzaId ?? 0,
      canalCodigo:    m.canalCodigo,
      canalFuerzaId:  m.canalFuerzaId,
      patrullaCodigo: m.patrullaCodigo,
      patrullaDesc:   m.patrullaDesc || undefined,
      tipoMedio:      m.tipoMedio,
      personal:       [],
      _personal1Cedu: m.personal[0]?.ceduEmpleado  ?? '',
      _personal1Nomb: m.personal[0]?.nombrePolicial ?? '',
      _personal2Cedu: m.personal[1]?.ceduEmpleado  ?? '',
      _personal2Nomb: m.personal[1]?.nombrePolicial ?? ''
    };

    this.modalEditarMedio = true;
    this.bloquearScroll(true);
    this.cargarCanales();
  }

  cerrarModalEditarMedio(): void {
    this.modalEditarMedio = false;
    this.medioEditando    = null;
    this.bloquearScroll(false);
  }

  /** Llama al endpoint PUT /medios/{id} con los campos editados. */
  guardarEditarMedio(): void {
    if (!this.medioEditando) return;
    if (!this.formEditarMedio.patrullaCodigo.trim()) {
      this.errorEditarMedio = 'El código de patrulla es obligatorio.';
      return;
    }

    this.guardandoEditarMedio = true;
    this.errorEditarMedio     = '';

    const personal: DtoPersonalMedio[] = [];
    if (this.formEditarMedio._personal1Cedu.trim()) {
      personal.push({
        ceduEmpleado:   this.formEditarMedio._personal1Cedu.trim(),
        nombrePolicial: this.formEditarMedio._personal1Nomb.trim() || undefined
      });
    }
    if (this.formEditarMedio._personal2Cedu.trim()) {
      personal.push({
        ceduEmpleado:   this.formEditarMedio._personal2Cedu.trim(),
        nombrePolicial: this.formEditarMedio._personal2Nomb.trim() || undefined
      });
    }

    const req: DtoActualizarMedioRequest = {
      canalCodigo:    this.formEditarMedio.canalCodigo,
      canalFuerzaId:  this.formEditarMedio.canalFuerzaId,
      patrullaCodigo: this.formEditarMedio.patrullaCodigo.trim().toUpperCase(),
      patrullaDesc:   this.formEditarMedio.patrullaDesc?.trim(),
      tipoMedio:      this.formEditarMedio.tipoMedio,
      personal
    };

    this.turnosSvc.actualizarMedio(this.medioEditando.id, req).subscribe({
      next: (r) => {
        this.guardandoEditarMedio = false;
        if (r.success) {
          this.cerrarModalEditarMedio();
          this.msgExito = '✔ Medio actualizado.';
          setTimeout(() => (this.msgExito = ''), 3000);
          // Recargar la lista de medios de la unidad activa
          if (this.unidadActiva) {
            this.cargarMedios(this.unidadActiva.turnoId, this.unidadActiva.id);
          }
        } else {
          this.errorEditarMedio = r.message;
        }
      },
      error: (e) => {
        this.guardandoEditarMedio = false;
        this.errorEditarMedio = e.error?.message ?? 'Error al actualizar el medio.';
      }
    });
  }

  /** Handler del canal en el modal de edición (sincroniza canalFuerzaId). */
  onCanalChangeEditar(codigo: number | undefined): void {
    const canal = this.canales.find(c => c.codigo === Number(codigo));
    this.formEditarMedio.canalCodigo   = canal?.codigo;
    this.formEditarMedio.canalFuerzaId = canal?.fuerzaId;
  }

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
  // MODAL: IMPORTAR SIVICC  (wizard de 2 pasos)
  // Paso 1: abrir → consultar automáticamente las unidades en SIVICC
  // Paso 3: confirmar → importar los medios de las unidades seleccionadas
  // ═══════════════════════════════════════════════════════════════════════════

  abrirModalSivicc(): void {
    if (!this.turnoSeleccionado) return;
    this.formSivicc = {
      turnoId:    this.turnoSeleccionado.id,
      fuerzaId:   this.fuerzaFiltro,
      sitioGraba: this.sitioGraba,
      unidades:   []
    };
    this.siviccCanalCodigo        = undefined;
    this.errorSivicc              = '';
    this.guardandoSivicc          = false;
    this.unidadesSivicc           = [];
    this.cargandoUnidadesSivicc   = true;
    this.modalSivicc              = true;
    this.bloquearScroll(true);
    this.cargarCanales(); // para el select de canal opcional

    // Paso 1: consultar unidades automáticamente
    this.turnosSvc.getUnidadesSivicc(this.turnoSeleccionado.id).subscribe({
      next: (lista) => {
        this.cargandoUnidadesSivicc = false;
        // Todas comienzan seleccionadas si no existen aún en CAD
        this.unidadesSivicc = lista.map(u => ({ ...u, seleccionada: !u.existeEnCadMedios }));
        // Si no hay unidades se muestra el estado vacío en el template (no es un error)
      },
      error: (e) => {
        this.cargandoUnidadesSivicc = false;
        this.errorSivicc = 'Error al consultar SIVICC: ' + (e.error?.message ?? e.message ?? 'Error desconocido.');
      }
    });
  }

  cerrarModalSivicc(): void {
    this.modalSivicc    = false;
    this.bloquearScroll(false);
  }

  /** Seleccionar / deseleccionar todas las unidades. */
  toggleTodaSivicc(seleccionar: boolean): void {
    this.unidadesSivicc.forEach(u => (u.seleccionada = seleccionar));
  }

  get todasSiviccSeleccionadas(): boolean {
    return this.unidadesSivicc.length > 0 && this.unidadesSivicc.every(u => u.seleccionada);
  }

  get algunaSiviccSeleccionada(): boolean {
    return this.unidadesSivicc.some(u => u.seleccionada);
  }

  guardarSivicc(): void {
    if (!this.algunaSiviccSeleccionada) {
      this.errorSivicc = 'Seleccione al menos una unidad para importar.';
      return;
    }
    this.guardandoSivicc = true;
    this.errorSivicc     = '';

    const unidades = this.unidadesSivicc
      .filter(u => u.seleccionada)
      .map(u => ({ minutaId: u.minutaId, consecutivo: u.consecutivo }));

    const req: DtoImportarSiviccRequest = {
      ...this.formSivicc,
      canalCodigo: this.siviccCanalCodigo,
      unidades
    };

    this.turnosSvc.importarSivicc(req.turnoId, req).subscribe({
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
        } else {
          this.errorSivicc = r.message;
        }
      },
      error: (e) => {
        this.guardandoSivicc = false;
        this.errorSivicc = e.error?.message ?? 'Error al importar desde SIVICC.';
      }
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

  /** Cuando el usuario elige un canal del select, actualiza canalCodigo y canalFuerzaId. */
  onCanalChange(codigo: number | undefined): void {
    const canal = this.canales.find(c => c.codigo === Number(codigo));
    this.formMedio.canalCodigo   = canal?.codigo;
    this.formMedio.canalFuerzaId = canal?.fuerzaId;
  }

  /** Devuelve las clases FontAwesome para el tipo de medio (reemplaza Material Icons). */
  iconoTipo(tipo: number): string {
    const map: Record<number, string> = {
      20: 'fa-solid fa-motorcycle',        // Motocicleta
      21: 'fa-solid fa-bicycle',           // Bicicleta
      22: 'fa-solid fa-car-side',          // Patrulla
      23: 'fa-solid fa-truck-medical',     // Ambulancia
      24: 'fa-solid fa-fire-flame-curved', // Camión Bomberos
      25: 'fa-solid fa-helicopter',        // Helicóptero
      26: 'fa-solid fa-sailboat',          // Lancha
    };
    return map[tipo] ?? 'fa-solid fa-car';
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
      turnoId: '', turnoUnidadId: undefined, unidadCodigo: undefined,
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
  trackByTurno(_: number, t: DtoTurnoListItem): string { return t.id; }
  trackByUnidad(_: number, u: DtoTurnoUnidad): string  { return u.id; }
  trackByMedio(_: number, m: DtoMedioDisponible): string { return m.id; }
}
