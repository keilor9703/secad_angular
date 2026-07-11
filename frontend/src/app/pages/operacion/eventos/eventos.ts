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
import { Subscription, Subject, interval } from 'rxjs';
import { switchMap, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { EventoService, DtoEventoListItem, DtoCanalItem, DtoSlaConfig, DtoEventoConteos, DtoCanalesAsignadosResult } from '../../../core/services/operacion/evento.service';
import { DtoAnotacionRequest, DtoPedidoDetalle, DtoAnotacion } from '../../../core/services/operacion/pedido.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  AsistenteService,
  AsistenteCategoria,
  AsistentePregunta,
  parsearOpciones
} from '../../../core/services/operacion/asistente.service';
import {
  TurnosService,
  DtoMedioDisponibleResumen
} from '../../../core/services/operacion/turnos.service';
import {
  ActuacionesService,
  DtoActuacionListItem,
  DtoCrearActuacionRequest,
  DtoCierreActuacionRequest,
  DtoActividadPolicial,
  DtoDelitoItem,
  DtoCodigoCasoItem,
  DtoCodigoCierreActuacion
} from '../../../core/services/operacion/actuaciones.service';
import {
  AgenciaExternaService,
  DtoAgenciaExterna
} from '../../../core/services/operacion/agencia-externa.service';
import {
  RecepcionService,
  DtoCanalRecepcion,
  DtoCanalSeleccionado,
  DtoAdjunto
} from '../../../core/services/operacion/recepcion.service';
import { PanelColapsableComponent } from '../../../components/panel-colapsable/panel-colapsable';

// Leaflet is loaded via CDN (index.html) – type-only reference
declare const L: any;

type SemaforoColor = 'semaforo-verde' | 'semaforo-amarillo' | 'semaforo-rojo';
type PanelMode = 'list' | 'detail';
type EstadoEvento = 'A' | 'P' | 'E' | 'T' | 'R' | 'C';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule, PanelColapsableComponent],
  templateUrl: './eventos.html',
  styleUrls: ['./eventos.scss']
})
export class EventosComponent implements OnInit, OnDestroy, AfterViewChecked {

  // ─── Services ────────────────────────────────────────────────────────────────
  private eventoSvc     = inject(EventoService);
  private turnosSvc     = inject(TurnosService);
  private actuacionSvc  = inject(ActuacionesService);
  private authSvc       = inject(AuthService);
  private asistenteSvc  = inject(AsistenteService);
  private agenciaSvc    = inject(AgenciaExternaService);
  private recepcionSvc  = inject(RecepcionService);
  private toast         = inject(ToastService);
  private cdr           = inject(ChangeDetectorRef);

  // ─── JWT claims ──────────────────────────────────────────────────────────────
  canalId    = 0;
  fuerzaId   = 0;
  sitioGraba = 0;
  idUsuario  = 0;
  /** true si el usuario tiene rol Superadmin (id_rol=1) o está en SuperUserIds. */
  esAdmin    = false;

  // ─── Canal selector ──────────────────────────────────────────────────────────
  canalesDisponibles: DtoCanalItem[] = [];
  canalSeleccionado  = 0;
  canalNombre        = '';
  mostrarSelectorCanal = false;

  /**
   * sessionStorage key prefix – persists canal choice across navigations within
   * the same tab. Se escribe/lee SIEMPRE junto con idUsuario (ver canalStorageKey())
   * para que un usuario nunca herede en silencio la selección manual que otro
   * usuario haya hecho antes en esa misma pestaña (p. ej. estación compartida
   * entre turnos) cuando su propio JWT no trae canal_id.
   */
  private readonly CANAL_KEY = 'ev_canal_sel';

  private canalStorageKey(idUsuario: number): string {
    return `${this.CANAL_KEY}:${idUsuario}`;
  }

  // ─── Paneles colapsables del detalle (todos abiertos por defecto) ────────────
  datosAbierto            = true;
  ubicacionAbierto        = true;
  recursosAbierto         = true;
  despachoAbierto         = true;
  fotosAbierto            = true;
  anotacionesAbierto      = true;
  canalesAsignadosAbierto = true;

  /** Visibilidad multi-canal: qué canales SECAD y agencias externas tienen este evento. */
  canalesAsignados: DtoCanalesAsignadosResult | null = null;

  // ─── List state ──────────────────────────────────────────────────────────────
  eventos: DtoEventoListItem[] = [];
  filtroTexto   = '';
  filtroEstado  = '';        // '' = todos | 'A'=Activos | 'P'=Pendientes | 'C'=Cerrados turno
  cargando      = false;
  errorCarga    = '';

  /** ids vistos en el poll anterior — para detectar cuáles son nuevos en este tick. */
  private idsConocidos    = new Set<string>();
  /** ids que acaban de aparecer en este tick — reciben el destello ".ev-item--nuevo". */
  private idsRecienLlegados = new Set<string>();
  private limpiarRecienLlegadosTimer?: ReturnType<typeof setTimeout>;
  /** false en la primera carga — evita que TODA la bandeja destelle al abrir la página. */
  private primerPollCompletado = false;

  /** Contadores por estado — alimentan los badges de los filtros. */
  conteos: DtoEventoConteos = {
    total: 0, activos: 0, pendientes: 0, enProceso: 0,
    seguimiento: 0, revision: 0, cerradosTurno: 0,
    turnoActual: '', turnoDesde: ''
  };

  // ─── Detail panel ────────────────────────────────────────────────────────────
  panelMode: PanelMode = 'list';
  detalle: DtoPedidoDetalle | null = null;
  cargandoDetalle = false;
  /** Item de lista del evento actualmente abierto en el panel de detalle.
   *  Permite acceder a campos del listado (numeEvento, etc.) desde el detalle. */
  eventoSeleccionado: DtoEventoListItem | null = null;

  // ─── Annotation form ─────────────────────────────────────────────────────────
  nuevaAnotacion: DtoAnotacionRequest = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
  guardandoAnotacion = false;
  mensajeAnotacion   = '';

  // ─── Close-event modal ───────────────────────────────────────────────────────
  modalCerrarVisible   = false;
  cerrarComentario     = '';
  cerrandoEvento       = false;
  // Multi-code para cierre de evento
  private eventoCodSubj        = new Subject<string>();
  eventoCodBusqueda            = '';
  eventoSugerencias:           DtoCodigoCasoItem[] = [];
  eventoCodsSelec:             { codigo: string; descripcion: string }[] = [];
  mostrarSugerenciasEvento     = false;

  // ─── Estado change ───────────────────────────────────────────────────────────
  cambiandoEstado = false;

  // ─── Semáforo reactive tick ──────────────────────────────────────────────────
  tick = 0;

  // ─── SLA configuration (cargado desde BD al inicio) ──────────────────────────
  slaConfig: DtoSlaConfig[] = [];

  /** Umbral en minutos para "sin acceso → advertencia" (default 1). */
  get slaUmbralSinAcceso(): number {
    return this.slaConfig.find(s => s.nombre === 'SIN_ACCESO')?.umbralMinutos ?? 1;
  }
  /** Umbral en minutos para "en gestión → crítico" (default 10). */
  get slaUmbralCritico(): number {
    return this.slaConfig.find(s => s.nombre === 'GESTION_CRITICA')?.umbralMinutos ?? 10;
  }

  // ─── Leaflet map ─────────────────────────────────────────────────────────────
  private mapaDetalle: any = null;
  private mapaInicializado = false;
  private pendingMapInit    = false;

  // ─── Recursos en turno (panel de despacho) ───────────────────────────────────
  recursos:                 DtoMedioDisponibleResumen[] = [];
  cargandoRecursos          = false;
  errorRecursos             = '';
  ultimaActRecursos:        Date | null = null;
  asignandoMedioId:         string | null = null;
  private recursoMarkers:   any[]  = [];
  private recursosSub:      Subscription | null = null;

  // ─── Actuaciones / timeline de despacho ──────────────────────────────────────
  actuaciones:              DtoActuacionListItem[] = [];
  cargandoActuaciones       = false;
  errorActuaciones          = '';
  operandoActuacionId:      string | null = null;   // ID de la actuación en proceso
  private actuacionesSub:   Subscription | null = null;

  // ─── Modal: Cierre de actuación (paso "Atendió") — expandido ────────────────
  modalCierreActuacion      = false;
  actuacionACerrar:         DtoActuacionListItem | null = null;
  cerrandoActuacion         = false;
  errorCierreActuacion      = '';

  // Multi-código tipificación (cad_casos)
  private cierreCodSubj            = new Subject<string>();
  cierreCodBusqueda                = '';
  cierreSugerencias:               DtoCodigoCasoItem[] = [];
  cierreCodsSeleccionados:         DtoCodigoCierreActuacion[] = [];
  mostrarSugerenciasCierre         = false;

  // Clasificación y actividad policial
  actividadesPoliciales:           DtoActividadPolicial[] = [];
  actividadesFiltered:             DtoActividadPolicial[] = [];
  cierreClasifActividad:           'O' | 'P' | '' = '';
  cierreActividadSelec:            DtoActividadPolicial | null = null;

  // Delito (Código Penal) — solo si actividad.requiereDelito = true
  private cierreDelitoSubj         = new Subject<string>();
  cierreDelitoBusqueda             = '';
  cierreDelitoSugs:                DtoDelitoItem[] = [];
  cierreDelitoSelec:               DtoDelitoItem | null = null;
  mostrarSugerenciasDelito         = false;

  // Observación libre
  cierreObservacion                = '';

  // ¿Cerrar el evento después de cerrar la actuación?
  cerrarEventoAlAtender:           boolean | null = null;

  // Anotaciones OPERATIVA: sub-campos dinámicos
  anotActividadCodigo  = '';
  anotActividadDesc    = '';
  anotRequiereDelito   = false;
  anotDelitoArticulo   = '';
  anotDelitoDesc       = '';

  // ─── Modal: Desasignar recurso (solo estado P) ───────────────────────────────
  modalDesasignarVisible    = false;
  actuacionADesasignar:     DtoActuacionListItem | null = null;
  desasignarMotivo          = '';
  desasignando              = false;
  errorDesasignar           = '';

  // ─── Modal: Registrar novedad operativa ──────────────────────────────────────
  modalNovedadVisible       = false;
  actuacionNovedad:         DtoActuacionListItem | null = null;
  novedadTexto              = '';
  novedadTipo:              'GENERAL' | 'NOVEDAD' | 'ALERTA' = 'NOVEDAD';
  guardandoNovedad          = false;
  errorNovedad              = '';

  // ─── Error de asignación (para mostrar feedback en tabla de recursos) ────────
  errorAsignacion           = '';

  // ─── §6.1 Modal Remitir a agencia / canal ────────────────────────────────────
  modalRemitirVisible   = false;
  remitirTab:           'secad' | 'externa' = 'secad';
  // Tab SECAD — canales disponibles agrupados por fuerza
  remitirCanalesGrupos: { fuerza: string; fuerzaId: number; canales: DtoCanalRecepcion[] }[] = [];
  /** Clave compuesta "codigo:fuerzaId" — el código solo no es único entre fuerzas */
  remitirCanalesSelec   = new Set<string>();
  // Tab externa — agencias externas por API
  remitirAgencias:      DtoAgenciaExterna[] = [];
  remitirAgenciasSelec  = new Set<string>();        // IDs de agencia seleccionadas
  remitirEnviando       = false;
  remitirError          = '';
  /**
   * true (default) = gestión conjunta: el caso permanece también en mi canal.
   * false = remisión exclusiva: se remueve de mi canal (llegó al canal
   * incorrecto y solo debe gestionarse en el destino).
   */
  remitirMantenerCanalOrigen = true;

  // ─── Adjuntos (fotos del pedido) ──────────────────────────────────────────────
  adjuntos: DtoAdjunto[] = [];

  // ─── §6.17 Asistente Inteligente ─────────────────────────────────────────────
  /** Panel colapsable visible en el detalle del evento. */
  asistenteAbierto      = false;
  asistenteCategorias:  AsistenteCategoria[]   = [];
  asistenteLoadingCat   = false;
  /** ID de la categoría seleccionada por el despachador. */
  asistenteCategoriaSel = '';
  asistentePreguntas:   AsistentePregunta[]    = [];
  asistenteLoadingPreg  = false;
  /** Expone parsearOpciones al template. */
  readonly asisParseOpc = parsearOpciones;

  // ─── Subscriptions ───────────────────────────────────────────────────────────
  private subs = new Subscription();

  // ─── Estados labels ──────────────────────────────────────────────────────────
  readonly ESTADOS: { valor: EstadoEvento; label: string; clase: string }[] = [
    { valor: 'A', label: 'Activo',        clase: 'estado-activo'     },
    { valor: 'P', label: 'Pendiente',     clase: 'estado-pendiente'  },
    { valor: 'E', label: 'En proceso',    clase: 'estado-proceso'    },
    { valor: 'T', label: 'Seguimiento',   clase: 'estado-seguimiento'},
    { valor: 'R', label: 'Para revisión', clase: 'estado-revision'   },
    { valor: 'C', label: 'Cerrado',       clase: 'estado-cerrado'    }
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Read JWT claims
    const claims    = this.authSvc.getJwtClaims();
    this.fuerzaId   = claims.fuerzaId;
    this.sitioGraba = claims.sitioGraba;
    this.canalId    = claims.canalId;
    this.esAdmin    = claims.esAdmin;
    this.idUsuario  = claims.idUsuario;

    // Priority: JWT claim > sessionStorage (del MISMO usuario) > 0
    if (this.canalId > 0) {
      this.canalSeleccionado = this.canalId;
      // this.fuerzaId ya viene del claim, en pareja consistente con canalId.
    } else {
      // Restore the canal chosen in a previous navigation within this tab session
      // — SOLO si fue este mismo usuario quien lo eligió. La clave incluye
      // idUsuario para que, en una estación compartida entre turnos, un usuario
      // sin canal_id en su JWT nunca herede en silencio la selección manual que
      // dejó otro usuario antes en la misma pestaña.
      // Se guarda como "codigo:fuerzaId" — el código solo no es único entre
      // fuerzas, así que hay que restaurar ambos valores como pareja.
      const stored = sessionStorage.getItem(this.canalStorageKey(this.idUsuario));
      if (stored) {
        const [codigo, fuerzaId] = stored.split(':').map(Number);
        if (codigo > 0) {
          this.canalSeleccionado = codigo;
          this.fuerzaId          = fuerzaId || 0;
        }
      }
    }

    // Load available channels for the selector
    this.cargarCanales();

    // ── Autocomplete: códigos de cierre (modal Atendió) ───────────────────────
    this.subs.add(
      this.cierreCodSubj.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(q => {
          if (!q.trim()) { this.cierreSugerencias = []; return; }
          this.actuacionSvc.buscarCodigosCierre(q).subscribe({
            next: r => { this.cierreSugerencias = r.data ?? []; },
            error: () => { this.cierreSugerencias = []; }
          });
        })
    );

    // ── Autocomplete: delito (modal Atendió) ──────────────────────────────────
    this.subs.add(
      this.cierreDelitoSubj.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(q => {
          if (!q.trim()) { this.cierreDelitoSugs = []; return; }
          this.actuacionSvc.buscarDelitos(q).subscribe({
            next: r => { this.cierreDelitoSugs = r.data ?? []; },
            error: () => { this.cierreDelitoSugs = []; }
          });
        })
    );

    // ── Autocomplete: códigos de cierre (modal Cerrar Evento) ─────────────────
    this.subs.add(
      this.eventoCodSubj.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(q => {
          if (!q.trim()) { this.eventoSugerencias = []; return; }
          this.actuacionSvc.buscarCodigosCierre(q).subscribe({
            next: r => { this.eventoSugerencias = r.data ?? []; },
            error: () => { this.eventoSugerencias = []; }
          });
        })
    );

    // ── SLA config (Épica 5) — cargar al inicio, no crítico si falla ─────────
    this.eventoSvc.getSlaConfig().subscribe({
      next: (cfg) => { this.slaConfig = cfg; },
      error: () => { /* usa defaults hardcoded en los getters */ }
    });

    // Semáforo tick every 60s — mantiene la reactividad del semáforo
    this.subs.add(
      interval(60_000).subscribe(() => {
        this.tick++;
        this.cdr.markForCheck();
      })
    );

    // Auto-refresh the queue every 15s
    // Los conteos (badges) se actualizan en el mismo ciclo de forma paralela.
    this.subs.add(
      interval(15_000)
        .pipe(
          startWith(0),
          switchMap(() => {
            this.cargando = true;
            // Conteos: siempre globales (sin filtro de estado) para mostrar todos los badges
            this.eventoSvc.getConteos(
              this.canalSeleccionado || undefined,
              this.fuerzaId || undefined
            ).subscribe({
              next:  (c) => { this.conteos = c; },
              error: ()  => { /* no crítico: los badges simplemente no se actualizan */ }
            });
            return this.eventoSvc.getEventos(
              this.canalSeleccionado || undefined,
              this.fuerzaId || undefined,
              this.filtroEstado || undefined
            );
          })
        )
        .subscribe({
          next: (items) => {
            // Diffing contra el poll anterior: solo destellan los ids que aparecieron
            // en ESTE tick. En la primera carga (página recién abierta) no se destella
            // nada — todo lo que ya estaba en la bandeja no es "nuevo".
            if (this.primerPollCompletado) {
              const idsNuevos = items
                .filter(i => !this.idsConocidos.has(i.id))
                .map(i => i.id);
              if (idsNuevos.length) {
                this.idsRecienLlegados = new Set(idsNuevos);
                clearTimeout(this.limpiarRecienLlegadosTimer);
                this.limpiarRecienLlegadosTimer = setTimeout(() => {
                  this.idsRecienLlegados = new Set();
                  this.cdr.markForCheck();
                }, 6000);
              }
            } else {
              this.primerPollCompletado = true;
            }
            this.idsConocidos = new Set(items.map(i => i.id));

            this.eventos    = items;
            this.cargando   = false;
            this.errorCarga = '';
          },
          error: (err) => {
            this.cargando   = false;
            this.errorCarga = 'Error al obtener eventos. Reintentando...';
            console.error('[Eventos] Error carga:', err);
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.detenerPollingActuaciones();
    clearTimeout(this.limpiarRecienLlegadosTimer);
  }

  ngAfterViewChecked(): void {
    if (this.pendingMapInit && this.panelMode === 'detail' && this.detalle) {
      this.initMapaDetalle();
      this.pendingMapInit = false;
    }
  }

  // ─── Canal selector ──────────────────────────────────────────────────────────

  private cargarCanales(): void {
    this.eventoSvc.getCanales(this.sitioGraba || undefined).subscribe({
      next: (c) => {
        this.canalesDisponibles = c;
        // Resolve canal name for the header
        this.actualizarNombreCanal();
        // Show selector if canal not configured in JWT
        if (this.canalSeleccionado <= 0 && c.length > 0) {
          this.mostrarSelectorCanal = true;
          this.toggleBodyModalClass(true);
        }
      },
      error: () => {
        // Non-fatal: keep mostrarSelectorCanal as-is
      }
    });
  }

  private actualizarNombreCanal(): void {
    // codigo NO es único por sí solo entre fuerzas — hay que matchear también
    // por fuerzaId, o se puede resolver el nombre del canal de otra fuerza.
    const found = this.canalesDisponibles.find(
      c => c.codigo === this.canalSeleccionado && c.fuerzaId === this.fuerzaId
    );
    this.canalNombre = found
      ? `${found.fuerzaDesc} – ${found.descripcion}`
      : this.canalSeleccionado > 0
        ? `Canal ${this.canalSeleccionado}`
        : 'Sin canal';
  }

  seleccionarCanal(codigo: number, fuerzaId: number): void {
    this.canalSeleccionado    = codigo;
    this.fuerzaId             = fuerzaId;
    this.mostrarSelectorCanal = false;
    this.toggleBodyModalClass(false);
    // Persist so the selector doesn't reappear on the next navigation within this session.
    // "codigo:fuerzaId" — deben restaurarse siempre como pareja (ver ngOnInit).
    // Escrito bajo la clave de ESTE usuario — ver canalStorageKey().
    sessionStorage.setItem(this.canalStorageKey(this.idUsuario), `${codigo}:${fuerzaId}`);
    this.actualizarNombreCanal();
    // Cerrar cualquier evento abierto: el detalle pertenece al canal anterior.
    // volverLista() detiene el polling de recursos y actuaciones, destruye el
    // mapa y limpia todo el estado del panel de detalle.
    this.volverLista();
    this.recargarAhora();
  }

  cambiarCanal(): void {
    this.mostrarSelectorCanal = true;
    this.toggleBodyModalClass(true);
  }

  cancelarSelector(): void {
    this.mostrarSelectorCanal = false;
    this.toggleBodyModalClass(false);
  }

  // ─── List helpers ─────────────────────────────────────────────────────────────

  recargarAhora(): void {
    this.cargando = true;

    // Actualizar conteos (badges) en paralelo — no crítico si falla
    this.eventoSvc.getConteos(
      this.canalSeleccionado || undefined,
      this.fuerzaId || undefined
    ).subscribe({
      next:  (c) => { this.conteos = c; },
      error: ()  => { /* no crítico */ }
    });

    this.eventoSvc.getEventos(
      this.canalSeleccionado || undefined,
      this.fuerzaId || undefined,
      this.filtroEstado || undefined
    ).subscribe({
      next:  (items) => { this.eventos = items; this.cargando = false; this.errorCarga = ''; },
      error: ()      => { this.cargando = false; this.errorCarga = 'Error al cargar eventos.'; }
    });
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    this.recargarAhora();
  }

  get eventosFiltrados(): DtoEventoListItem[] {
    if (!this.filtroTexto) return this.eventos;
    const q = this.filtroTexto.trim().toLowerCase();
    return this.eventos.filter(e =>
      // Dirección y ubicación
      e.direCaso?.toLowerCase().includes(q)              ||
      e.ciudad?.toLowerCase().includes(q)                ||
      // Código de caso
      e.codiPedido?.toLowerCase().includes(q)            ||
      e.codiPedido2?.toLowerCase().includes(q)           ||
      e.descPedido?.toLowerCase().includes(q)            ||
      // Identificadores numéricos
      String(e.numeLlamada  ?? '').includes(q)           ||  // N° llamada PlantaTel
      String(e.numeTelefono ?? '').includes(q)           ||  // Teléfono del llamante
      String(e.numeEvento   ?? '').includes(q)           ||  // ID del evento (Snowflake)
      String(e.id           ?? '').includes(q)           ||  // ID del pedido (Snowflake)
      // Persona
      e.nombLlamante?.toLowerCase().includes(q)          ||  // Nombre del llamante / afectado
      // Operador
      e.usernameCreacion?.toLowerCase().includes(q)
    );
  }

  get totalMostrados(): number { return this.eventosFiltrados.length; }

  /**
   * Actuaciones que cuentan como "despacho activo":
   * P (asignada), D (en ruta), A (en sitio).
   * Excluye C (cerradas — ya completaron su misión) y V (anuladas — canceladas).
   * Se usa para el contador del encabezado "Despacho activo".
   */
  get actuacionesActivas(): DtoActuacionListItem[] {
    return this.actuaciones.filter(
      a => a.estado === 'P' || a.estado === 'D' || a.estado === 'A'
    );
  }

  // ─── Detail panel ─────────────────────────────────────────────────────────────

  abrirDetalle(evento: DtoEventoListItem): void {
    // ── Limpiar estado del evento ANTERIOR antes de cargar el nuevo ──────────
    // CRÍTICO: si no se limpia aquí, los datos del evento anterior quedan
    // visibles en la UI durante el tiempo que tarda la nueva carga HTTP,
    // y ambas suscripciones de polling compiten actualizando los mismos arrays.
    this.panelMode          = 'detail';
    this.eventoSeleccionado = evento;   // guarda el item de lista para acceder a numeEvento
    this.detalle            = null;
    this.actuaciones      = [];       // limpiar despachos del evento anterior
    this.recursos         = [];       // limpiar recursos del evento anterior
    this.errorAsignacion  = '';       // limpiar errores de asignación anteriores
    this.errorActuaciones = '';
    this.errorRecursos    = '';
    this.cargandoDetalle  = true;
    this.mensajeAnotacion = '';
    this.nuevaAnotacion   = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
    this.pendingMapInit   = true;

    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.detenerPollingActuaciones();  // detener polling del evento anterior AHORA
    this.resetAsistente();

    this.adjuntos         = [];
    this.canalesAsignados = null;
    this.eventoSvc.getById(evento.id).subscribe({
      next: (d) => {
        this.detalle         = d;
        this.cargandoDetalle = false;
        // El backend promueve el estado a 'E' al abrir (RegistrarAccesoAsync) — reflejarlo
        // de inmediato en la tarjeta de la bandeja, sin esperar el próximo poll de 15s.
        if (d) this.aplicarEstadoActualizado(d.id, d.estado);
        // Cargar fotos adjuntas del pedido (cad_adjuntos) si existe pedidoId
        if (d?.id) {
          this.recepcionSvc.getAdjuntos(d.id)
            .subscribe({ next: r => { if (r.success) this.adjuntos = r.data; } });
        }
        this.iniciarPollingRecursos();
        this.iniciarPollingActuaciones(evento.id);
        this.cargarCanalesAsignados();
      },
      error: () => {
        this.cargandoDetalle = false;
        this.errorCarga = 'No se pudo cargar el detalle del evento.';
      }
    });
  }

  /**
   * Carga qué canales SECAD y agencias externas tienen conocimiento de este
   * evento — visibilidad multi-canal para cualquier funcionario, sin importar
   * desde qué canal lo mire. Se vuelve a llamar tras cerrar/remitir para
   * reflejar el estado más reciente sin tener que reabrir el detalle.
   */
  cargarCanalesAsignados(): void {
    if (!this.detalle) return;
    this.eventoSvc.getCanalesAsignados(this.detalle.id).subscribe({
      next: (r) => { this.canalesAsignados = r; },
      error: () => { /* no crítico — el panel simplemente no se muestra */ }
    });
  }

  volverLista(): void {
    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.detenerPollingActuaciones();
    this.panelMode          = 'list';
    this.detalle            = null;
    this.eventoSeleccionado = null;
    this.actuaciones        = [];
    this.adjuntos           = [];
    this.canalesAsignados   = null;
    this.resetAsistente();
  }

  // ─── Estado change ────────────────────────────────────────────────────────────

  cambiarEstado(nuevoEstado: string): void {
    if (!this.detalle || this.cambiandoEstado) return;
    if (!confirm(`¿Cambiar el estado del evento a "${this.getEstadoLabel(nuevoEstado)}"?`)) return;
    this.cambiandoEstado = true;

    this.eventoSvc.setEstado(this.detalle.id, nuevoEstado).subscribe({
      next: (r) => {
        this.cambiandoEstado = false;
        if (r.success && this.detalle) {
          this.aplicarEstadoActualizado(this.detalle.id, nuevoEstado);
          this.recargarAhora();
        }
      },
      error: () => { this.cambiandoEstado = false; }
    });
  }

  /**
   * Refleja de inmediato un cambio de estado (manual o automático) tanto en el
   * panel de detalle abierto como en la tarjeta correspondiente de la bandeja,
   * sin esperar el próximo poll de 15s. `nuevoEstado` puede venir null/undefined
   * cuando el backend indica que no hubo cambio (p.ej. el evento ya estaba en
   * 'E' o más adelante) — en ese caso no se hace nada.
   */
  private aplicarEstadoActualizado(pedidoId: string, nuevoEstado: string | null | undefined): void {
    if (!nuevoEstado) return;
    if (this.detalle && this.detalle.id === pedidoId) this.detalle.estado = nuevoEstado;
    const item = this.eventos.find(ev => ev.id === pedidoId);
    if (item) item.estado = nuevoEstado;
  }

  getEstadoLabel(estado: string): string {
    return this.ESTADOS.find(e => e.valor === estado)?.label ?? estado;
  }

  getEstadoClase(estado: string): string {
    return this.ESTADOS.find(e => e.valor === estado)?.clase ?? '';
  }

  // ─── Annotation ──────────────────────────────────────────────────────────────

  guardarAnotacion(): void {
    if (!this.detalle || !this.nuevaAnotacion.anotacion.trim()) return;
    this.guardandoAnotacion = true;
    this.mensajeAnotacion   = '';

    // Componer título enriquecido para anotaciones OPERATIVA
    let titulo = this.nuevaAnotacion.titulo;
    if (this.nuevaAnotacion.tipoAnotacion === 'OPERATIVA' && this.anotActividadCodigo) {
      const parts: string[] = [this.anotActividadDesc || this.anotActividadCodigo];
      if (this.anotDelitoArticulo)
        parts.push(`${this.anotDelitoArticulo}: ${this.anotDelitoDesc || ''}`);
      titulo = titulo
        ? `${parts.join(' | ')} — ${titulo}`
        : parts.join(' | ');
    }

    const req: DtoAnotacionRequest = { ...this.nuevaAnotacion, titulo };

    this.eventoSvc.createAnotacion(this.detalle.id, req).subscribe({
      next: (r) => {
        this.guardandoAnotacion = false;
        if (r.success) {
          this.mensajeAnotacion = '✔ Anotación registrada.';
          this.aplicarEstadoActualizado(this.detalle!.id, r.estadoActual);
          this.nuevaAnotacion   = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
          // Resetear sub-campos OPERATIVA
          this.anotActividadCodigo = '';
          this.anotActividadDesc   = '';
          this.anotRequiereDelito  = false;
          this.anotDelitoArticulo  = '';
          this.anotDelitoDesc      = '';
          // Reload annotations
          this.eventoSvc.getAnotaciones(this.detalle!.id).subscribe(anots => {
            if (this.detalle) this.detalle.anotaciones = anots;
          });
        } else {
          this.mensajeAnotacion = r.message || 'Error al guardar.';
        }
      },
      error: () => {
        this.guardandoAnotacion = false;
        this.mensajeAnotacion   = 'Error al guardar la anotación.';
      }
    });
  }

  /** Al cambiar el tipo de anotación, resetear sub-campos OPERATIVA */
  onTipoAnotacionChange(): void {
    this.anotActividadCodigo = '';
    this.anotActividadDesc   = '';
    this.anotRequiereDelito  = false;
    this.anotDelitoArticulo  = '';
    this.anotDelitoDesc      = '';
    // Pre-cargar actividades si tipo OPERATIVA y no cargadas aún
    if (this.nuevaAnotacion.tipoAnotacion === 'OPERATIVA' && !this.actividadesPoliciales.length) {
      this.actuacionSvc.getActividadesPoliciales().subscribe({
        next: r => { this.actividadesPoliciales = r.data ?? []; },
        error: () => {}
      });
    }
  }

  /** Al cambiar actividad en el formulario de anotación */
  onAnotActividadChange(event: Event): void {
    const codigo = (event.target as HTMLSelectElement).value;
    const act = this.actividadesPoliciales.find(a => a.codigo === codigo);
    this.anotActividadCodigo  = act?.codigo ?? '';
    this.anotActividadDesc    = act?.descripcion ?? '';
    this.anotRequiereDelito   = act?.requiereDelito ?? false;
    if (!this.anotRequiereDelito) {
      this.anotDelitoArticulo = '';
      this.anotDelitoDesc     = '';
    }
  }

  getTipoAnotacionLabel(tipo: string): string {
    const map: Record<string, string> = {
      GENERAL:          'General',
      OPERATIVA:        'Operativa',
      PREVENTIVA:       'Preventiva',
      DESPACHO:         'Despacho',
      NOVEDAD_PERSONAL: 'Novedad personal',
      CIERRE:           'Cierre',
      // Generada automáticamente por confirmarRemitir() al remitir el evento a otra agencia.
      REMISION:         'Remisión'
    };
    return map[tipo] ?? tipo;
  }

  // ─── Close event modal ────────────────────────────────────────────────────────

  abrirModalCerrar(): void {
    this.cerrarComentario        = '';
    this.eventoCodsSelec         = [];
    this.eventoCodBusqueda       = '';
    this.eventoSugerencias       = [];
    this.mostrarSugerenciasEvento = false;
    this.modalCerrarVisible      = true;
    this.toggleBodyModalClass(true);
  }

  cancelarCierre(): void {
    this.modalCerrarVisible = false;
    this.toggleBodyModalClass(false);
  }

  // ── Multi-código: Cerrar Evento ────────────────────────────────────────────

  onEventoCodInput(valor: string): void {
    this.eventoCodBusqueda = valor;
    this.eventoCodSubj.next(valor);
    this.mostrarSugerenciasEvento = true;
  }

  seleccionarEventoCod(item: DtoCodigoCasoItem): void {
    if (!this.eventoCodsSelec.some(c => c.codigo === item.codigo)) {
      this.eventoCodsSelec.push({ codigo: item.codigo, descripcion: item.descripcion });
    }
    this.eventoCodBusqueda       = '';
    this.eventoSugerencias       = [];
    this.mostrarSugerenciasEvento = false;
  }

  agregarEventoCodManual(): void {
    const cod = this.eventoCodBusqueda.trim().toUpperCase();
    if (!cod) return;
    if (!this.eventoCodsSelec.some(c => c.codigo === cod)) {
      this.eventoCodsSelec.push({ codigo: cod, descripcion: '' });
    }
    this.eventoCodBusqueda       = '';
    this.eventoSugerencias       = [];
    this.mostrarSugerenciasEvento = false;
  }

  quitarEventoCod(idx: number): void {
    this.eventoCodsSelec.splice(idx, 1);
  }

  cerrarSugerenciasEvento(): void {
    setTimeout(() => { this.mostrarSugerenciasEvento = false; }, 200);
  }

  confirmarCierre(): void {
    if (!this.detalle || this.cerrandoEvento) return;

    this.cerrandoEvento = true;
    this.eventoSvc.cerrar(this.detalle.id, {
      estado:            'C',
      observacionCierre: this.cerrarComentario.trim() || undefined,
      codigosCierre:     this.eventoCodsSelec.map((c, i) => ({
        orden:             i + 1,
        codigoCierre:      c.codigo,
        tipoCodigo:        'CIERRE',
        descripcionLibre:  c.descripcion || undefined
      }))
    }, this.canalSeleccionado, this.fuerzaId).subscribe({
      next: (r) => {
        this.cerrandoEvento     = false;
        this.modalCerrarVisible = false;
        this.toggleBodyModalClass(false);
        if (r.success) {
          // Si el evento tiene varios canales, esto puede ser un cierre parcial
          // (solo mi canal) o el cierre definitivo — el mensaje del backend
          // distingue cuál de los dos ocurrió.
          this.toast.success('Evento', r.message || 'Evento cerrado.');
          this.volverLista();
          this.recargarAhora();
        } else {
          this.toast.warning('Cerrar evento', r.message || 'No se pudo cerrar el evento.');
        }
      },
      error: (e) => {
        this.cerrandoEvento = false;
        this.toast.error('Cerrar evento', e.error?.message ?? 'Error al cerrar el evento.');
      }
    });
  }

  // ─── Body scroll lock ─────────────────────────────────────────────────────────

  private toggleBodyModalClass(open: boolean): void {
    if (open) {
      document.body.classList.add('ui-modal-open');
    } else {
      document.body.classList.remove('ui-modal-open');
    }
  }

  // ─── Indicadores "nuevo" / "en gestión" en la tarjeta de la bandeja ────────

  /**
   * true durante ~6s tras el poll en el que este evento apareció por primera
   * vez en la bandeja — dispara el destello ".ev-item--nuevo". Nunca se marca
   * en la carga inicial de la página (ver primerPollCompletado).
   */
  esEventoNuevo(ev: DtoEventoListItem): boolean {
    return this.idsRecienLlegados.has(ev.id);
  }

  /**
   * Indicador fijo (no animado) de que el evento ya está siendo trabajado.
   * 'E' = En proceso, que ahora se asigna automáticamente en cuanto un
   * despachador abre el evento (ver RegistrarAccesoAsync en el backend).
   */
  esEventoEnGestion(ev: DtoEventoListItem): boolean {
    return ev.estado === 'E';
  }

  // ─── Semáforo dinámico con SLAs (Épica 4 + Épica 5) ────────────────────────

  /**
   * Calcula el color del semáforo usando los umbrales SLA configurados en BD.
   *
   * Estado final (C = cerrado): siempre verde.
   * FLASH: siempre rojo (prioridad máxima).
   *
   * Para eventos abiertos:
   *   • Verde   — evento accedido (en gestión) y dentro del umbral crítico.
   *   • Amarillo — sin primer acceso dentro del umbral 'SIN_ACCESO'.
   *   • Rojo    — (a) INMEDIATA sin acceso, o (b) en gestión > umbral crítico,
   *               o (c) RUTINA/otro sin acceso superando umbral de advertencia
   *               multiplicado por 10 como límite razonable.
   */
  getSemaforoClass(item: DtoEventoListItem | DtoPedidoDetalle): SemaforoColor {
    void this.tick;   // reactive dependency — re-evaluated each tick

    if (item.estado === 'C') return 'semaforo-verde';

    const prio         = (item.prioridad ?? '').toUpperCase().trim();
    const minDesdeCreacion = this.getMinutosDesdeCreacion(item);

    // FLASH → siempre rojo
    if (prio === 'FLASH') return 'semaforo-rojo';

    // ── Determinar si ya tuvo primer acceso ──────────────────────────────────
    // DtoPedidoDetalle (vista de detalle) tiene 'anotaciones'; DtoEventoListItem no.
    // Cuando se está en la vista de detalle, el acceso YA fue registrado al abrir.
    const esVistaDetalle = 'anotaciones' in item;
    const primerAcceso   = (item as DtoEventoListItem).fechaPrimerAcceso ?? null;
    const tuvoAcceso     = esVistaDetalle || !!primerAcceso;

    if (!tuvoAcceso) {
      // Sin acceso: verde → amarillo → rojo según prioridad y tiempo
      if (minDesdeCreacion >= this.slaUmbralSinAcceso) {
        return prio === 'INMEDIATA' ? 'semaforo-rojo' : 'semaforo-amarillo';
      }
      return 'semaforo-verde';
    }

    // Con acceso: medir tiempo transcurrido desde el primer acceso.
    // Si no tenemos fecha de primer acceso (ej. DtoPedidoDetalle sin ese campo),
    // usar fechaCreacion como aproximación razonable.
    const refAcceso = primerAcceso ?? item.fechaCreacion;
    const minDesdeAcceso = this.getMinutosDesdeAcceso(refAcceso);
    if (minDesdeAcceso >= this.slaUmbralCritico) return 'semaforo-rojo';
    return 'semaforo-verde';
  }

  /** Minutos transcurridos desde la creación del evento (usa fechaCreacion). */
  private getMinutosDesdeCreacion(item: DtoEventoListItem | DtoPedidoDetalle): number {
    const raw = item.fechaCreacion ?? item.horaCaso;
    if (!raw) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(raw).getTime()) / 60_000));
  }

  /** Minutos transcurridos desde el primer acceso por un despachador. */
  private getMinutosDesdeAcceso(fechaPrimerAcceso: string | null): number {
    if (!fechaPrimerAcceso) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(fechaPrimerAcceso).getTime()) / 60_000));
  }

  /**
   * Etiqueta de tiempo para la tarjeta del evento (Épica 4).
   * • Eventos cerrados: muestra la fecha de creación como texto estático.
   * • Eventos abiertos sin acceso: "Esperando Xm" (tiempo en cola).
   * • Eventos con acceso: "En gestión Xm" (tiempo desde primer acceso, máx cap).
   * La etiqueta ya no es un contador infinito.
   */
  getElapsedLabel(item: DtoEventoListItem | DtoPedidoDetalle): string {
    if (item.estado === 'C') {
      // Evento cerrado — mostrar fecha de creación estática
      const fc = item.fechaCreacion;
      if (!fc) return '–';
      const d = new Date(fc);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // DtoPedidoDetalle tiene 'anotaciones'; DtoEventoListItem no.
    const esVistaDetalle = 'anotaciones' in item;
    const primerAcceso   = (item as DtoEventoListItem).fechaPrimerAcceso ?? null;

    if (!esVistaDetalle && !primerAcceso) {
      // Sin acceso — mostrar tiempo en cola (desde creación)
      const min = this.getMinutosDesdeCreacion(item);
      return min < 60
        ? `En cola ${min}m`
        : `En cola ${Math.floor(min / 60)}h${min % 60 > 0 ? ' ' + (min % 60) + 'm' : ''}`;
    }

    // Con acceso (o en vista de detalle) — mostrar tiempo de gestión
    const refFecha = primerAcceso ?? item.fechaCreacion;
    const min = refFecha
      ? Math.max(0, Math.floor((Date.now() - new Date(refFecha).getTime()) / 60_000))
      : this.getMinutosDesdeCreacion(item);
    return min < 60
      ? `Gestión ${min}m`
      : `Gestión ${Math.floor(min / 60)}h${min % 60 > 0 ? ' ' + (min % 60) + 'm' : ''}`;
  }

  /** Fecha de creación formateada para el encabezado del detalle. */
  getFechaCreacionLabel(item: DtoEventoListItem | DtoPedidoDetalle): string {
    const raw = item.fechaCreacion ?? item.horaCaso;
    if (!raw) return '–';
    const d = new Date(raw);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  getPrioridadLabel(p: string): string {
    const map: Record<string, string> = { FLASH: 'Flash', INMEDIATA: 'Inmediata', RUTINA: 'Rutina' };
    return map[p?.toUpperCase()] ?? (p || 'Sin prioridad');
  }

  getPrioridadClass(p: string): string {
    const map: Record<string, string> = { FLASH: 'prio-flash', INMEDIATA: 'prio-inmediata', RUTINA: 'prio-rutina' };
    return map[p?.toUpperCase()] ?? 'prio-default';
  }

  // ─── Recursos en turno ───────────────────────────────────────────────────────

  /** Inicia polling de recursos cada 8 s para el canal activo. */
  private iniciarPollingRecursos(): void {
    this.detenerPollingRecursos();
    if (this.canalSeleccionado <= 0) return;

    this.recursosSub = interval(8_000)
      .pipe(startWith(0), switchMap(() => {
        this.cargandoRecursos = true;
        return this.turnosSvc.getResumenRecursosCanal(
          this.canalSeleccionado, this.sitioGraba || 1, this.fuerzaId || undefined
        );
      }))
      .subscribe({
        next: (data) => {
          this.recursos          = data;
          this.cargandoRecursos  = false;
          this.errorRecursos     = '';
          this.ultimaActRecursos = new Date();
          // Calcular distancias al incidente (Haversine)
          if (this.detalle?.latitudCaso && this.detalle?.longitudCaso) {
            const lat0 = parseFloat(this.detalle.latitudCaso);
            const lng0 = parseFloat(this.detalle.longitudCaso);
            this.recursos.forEach(r => {
              r.distanciaKm = (r.lat != null && r.lng != null)
                ? this.haversineKm(lat0, lng0, r.lat, r.lng) : undefined;
            });
            // Ordenar: libres primero, luego por distancia
            this.recursos.sort((a, b) => {
              const libre = (x: DtoMedioDisponibleResumen) => x.estado === 27 ? 0 : 1;
              const df = libre(a) - libre(b);
              if (df !== 0) return df;
              return (a.distanciaKm ?? 9999) - (b.distanciaKm ?? 9999);
            });
          }
          this.actualizarMarcadoresRecursos();
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargandoRecursos = false;
          this.errorRecursos    = 'Error al obtener recursos.';
        }
      });
  }

  private detenerPollingRecursos(): void {
    if (this.recursosSub) {
      this.recursosSub.unsubscribe();
      this.recursosSub = null;
    }
    this.recursos = [];
  }

  // ─── Flujo de despacho 4 pasos ────────────────────────────────────────────────

  /**
   * PASO 1 — Asignar recurso al incidente.
   * Crea la actuación en estado P y vincula el medio al evento.
   * El medio queda asignado pero no cambia su estado operativo todavía.
   */
  asignarRecursoAlEvento(r: DtoMedioDisponibleResumen): void {
    if (!this.detalle || this.asignandoMedioId) return;
    this.asignandoMedioId = r.id;
    this.errorAsignacion  = '';

    const req: DtoCrearActuacionRequest = {
      eventoId:       this.detalle.id,
      sitioGraba:     this.sitioGraba,
      fuerzaId:       this.fuerzaId || undefined,
      canalCodigo:    this.canalSeleccionado || undefined,
      unidadAsignada: r.patrullaCodigo,
      medioId:        r.id          // string — preserves Snowflake 64-bit precision
    };
    this.actuacionSvc.crearActuacion(req).subscribe({
      next: (res) => {
        this.asignandoMedioId = null;
        if (res.success) {
          this.errorAsignacion = '';
          this.aplicarEstadoActualizado(this.detalle!.id, res.estadoEventoActual);
          this.recargarActuaciones();
          this.recargarRecursos();   // refleja inmediatamente el nuevo estado del medio
        } else {
          this.errorAsignacion = res.message ?? 'No se pudo asignar el recurso.';
        }
      },
      error: (e) => {
        this.asignandoMedioId = null;
        this.errorAsignacion  = e.error?.message ?? 'Error al asignar el recurso.';
      }
    });
  }

  // ─── Desasignar (solo estado P) ──────────────────────────────────────────────

  abrirModalDesasignar(act: DtoActuacionListItem): void {
    this.actuacionADesasignar  = act;
    this.desasignarMotivo      = '';
    this.errorDesasignar       = '';
    this.desasignando          = false;
    this.modalDesasignarVisible = true;
    this.toggleBodyModalClass(true);
  }

  cancelarDesasignar(): void {
    this.modalDesasignarVisible = false;
    this.actuacionADesasignar   = null;
    this.toggleBodyModalClass(false);
  }

  confirmarDesasignar(): void {
    if (!this.actuacionADesasignar || this.desasignando) return;
    this.desasignando    = true;
    this.errorDesasignar = '';

    this.actuacionSvc.desasignarActuacion(
      this.actuacionADesasignar.id,
      this.desasignarMotivo.trim() || 'Desasignado por operador'
    ).subscribe({
      next: (res) => {
        this.desasignando = false;
        if (res.success) {
          this.modalDesasignarVisible = false;
          this.actuacionADesasignar   = null;
          this.toggleBodyModalClass(false);
          this.recargarActuaciones();
          this.recargarRecursos();   // medio vuelve a estado Libre (27)
        } else {
          this.errorDesasignar = res.message ?? 'No se pudo desasignar.';
        }
      },
      error: (e) => {
        this.desasignando    = false;
        this.errorDesasignar = e.error?.message ?? 'Error al desasignar el recurso.';
      }
    });
  }

  // ─── Novedad operativa ────────────────────────────────────────────────────────

  abrirModalNovedad(act: DtoActuacionListItem): void {
    this.actuacionNovedad     = act;
    this.novedadTexto         = '';
    this.novedadTipo          = 'NOVEDAD';
    this.errorNovedad         = '';
    this.guardandoNovedad     = false;
    this.modalNovedadVisible  = true;
    this.toggleBodyModalClass(true);
  }

  cancelarNovedad(): void {
    this.modalNovedadVisible = false;
    this.actuacionNovedad    = null;
    this.toggleBodyModalClass(false);
  }

  confirmarNovedad(): void {
    if (!this.actuacionNovedad || this.guardandoNovedad) return;
    if (!this.novedadTexto.trim()) {
      this.errorNovedad = 'Ingrese el texto de la novedad.';
      return;
    }
    this.guardandoNovedad = true;
    this.errorNovedad     = '';

    this.actuacionSvc.agregarNota(this.actuacionNovedad.id, {
      nota:     this.novedadTexto.trim(),
      tipoNota: this.novedadTipo
    }).subscribe({
      next: (res) => {
        this.guardandoNovedad = false;
        if (res.success) {
          this.modalNovedadVisible = false;
          this.actuacionNovedad    = null;
          this.toggleBodyModalClass(false);
          // Actualizar conteo de notas en la lista sin recargar todo
          this.recargarActuaciones();
        } else {
          this.errorNovedad = res.message ?? 'No se pudo registrar la novedad.';
        }
      },
      error: (e) => {
        this.guardandoNovedad = false;
        this.errorNovedad     = e.error?.message ?? 'Error al registrar la novedad.';
      }
    });
  }

  /**
   * true si el canal/fuerza de la sesión activa es el mismo que asignó este
   * recurso — solo ese canal puede gestionarlo en un evento multi-canal (ver
   * VerificarCanalPropietarioAsync en el backend, que es quien realmente lo
   * hace cumplir). Aquí solo se usa para no ofrecer botones que van a fallar;
   * actuaciones legacy sin canal_codigo/fuerza_id, o si por algún motivo la
   * sesión no tiene su propio canal resuelto, se dejan visibles (mismo criterio
   * "fail-open" que aplica el backend).
   */
  puedeGestionarActuacion(act: DtoActuacionListItem): boolean {
    if (act.canalCodigo == null || act.fuerzaId == null) return true;
    if (!this.canalSeleccionado || !this.fuerzaId) return true;
    return act.canalCodigo === this.canalSeleccionado && act.fuerzaId === this.fuerzaId;
  }

  /**
   * PASO 2 — Marcar inicio de ruta (En camino).
   * Actuación P → D · registra fecha_despacho · medio → 30 (En ruta).
   */
  marcarEnRuta(act: DtoActuacionListItem): void {
    if (this.operandoActuacionId) return;
    this.operandoActuacionId = act.id;
    this.actuacionSvc.actualizarEstado(act.id, { estado: 'D' }).subscribe({
      next: () => {
        this.operandoActuacionId = null;
        this.recargarActuaciones();
        this.recargarRecursos();   // refleja medio → En ruta (30)
      },
      error: (e) => {
        this.operandoActuacionId = null;
        this.toast.error('Actuación', e.error?.message ?? 'No se pudo actualizar el recurso.');
      }
    });
  }

  /**
   * PASO 3 — Marcar llegada al lugar del incidente (En sitio).
   * Actuación D → A · registra fecha_llegada · medio → 28 (Ocupado/Atendiendo).
   */
  marcarEnSitio(act: DtoActuacionListItem): void {
    if (this.operandoActuacionId) return;
    this.operandoActuacionId = act.id;
    this.actuacionSvc.actualizarEstado(act.id, { estado: 'A' }).subscribe({
      next: () => {
        this.operandoActuacionId = null;
        this.recargarActuaciones();
        this.recargarRecursos();   // refleja medio → En sitio (28)
      },
      error: (e) => {
        this.operandoActuacionId = null;
        this.toast.error('Actuación', e.error?.message ?? 'No se pudo actualizar el recurso.');
      }
    });
  }

  /**
   * PASO 4 — Abrir modal para marcar atención completada y cerrar la actuación.
   * Carga el catálogo de actividades policiales si no se ha cargado aún.
   */
  abrirCierreActuacion(act: DtoActuacionListItem): void {
    this.actuacionACerrar          = act;
    this.cerrandoActuacion         = false;
    this.errorCierreActuacion      = '';
    // Multi-código
    this.cierreCodBusqueda         = '';
    this.cierreSugerencias         = [];
    this.cierreCodsSeleccionados   = [];
    this.mostrarSugerenciasCierre  = false;
    // Actividad policial
    this.cierreClasifActividad     = '';
    this.cierreActividadSelec      = null;
    this.actividadesFiltered       = [];
    // Delito
    this.cierreDelitoBusqueda      = '';
    this.cierreDelitoSugs          = [];
    this.cierreDelitoSelec         = null;
    this.mostrarSugerenciasDelito  = false;
    // Observación y decisión evento
    this.cierreObservacion         = '';
    this.cerrarEventoAlAtender     = null;

    // Cargar catálogo de actividades (se cachea en memoria para la sesión)
    if (!this.actividadesPoliciales.length) {
      this.actuacionSvc.getActividadesPoliciales().subscribe({
        next: r => { this.actividadesPoliciales = r.data ?? []; },
        error: () => {}
      });
    }

    this.modalCierreActuacion = true;
    this.toggleBodyModalClass(true);
  }

  cancelarCierreActuacion(): void {
    this.modalCierreActuacion = false;
    this.actuacionACerrar     = null;
    this.toggleBodyModalClass(false);
  }

  // ── Multi-código: modal Atendió ────────────────────────────────────────────

  onCierreCodInput(valor: string): void {
    this.cierreCodBusqueda = valor;
    this.cierreCodSubj.next(valor);
    this.mostrarSugerenciasCierre = true;
  }

  seleccionarCierreCod(item: DtoCodigoCasoItem): void {
    const orden = this.cierreCodsSeleccionados.length + 1;
    if (!this.cierreCodsSeleccionados.some(c => c.codigoCierre === item.codigo)) {
      this.cierreCodsSeleccionados.push({
        orden, codigoCierre: item.codigo, tipoCodigo: 'CIERRE',
        descripcionLibre: item.descripcion || undefined
      });
    }
    this.cierreCodBusqueda        = '';
    this.cierreSugerencias        = [];
    this.mostrarSugerenciasCierre = false;
  }

  agregarCierreCodManual(): void {
    const cod = this.cierreCodBusqueda.trim().toUpperCase();
    if (!cod) return;
    if (!this.cierreCodsSeleccionados.some(c => c.codigoCierre === cod)) {
      const orden = this.cierreCodsSeleccionados.length + 1;
      this.cierreCodsSeleccionados.push({ orden, codigoCierre: cod, tipoCodigo: 'CIERRE' });
    }
    this.cierreCodBusqueda        = '';
    this.cierreSugerencias        = [];
    this.mostrarSugerenciasCierre = false;
  }

  quitarCierreCod(idx: number): void {
    this.cierreCodsSeleccionados.splice(idx, 1);
    // Renumerar
    this.cierreCodsSeleccionados.forEach((c, i) => c.orden = i + 1);
  }

  cerrarSugerenciasCierre(): void {
    setTimeout(() => { this.mostrarSugerenciasCierre = false; }, 200);
  }

  // ── Clasificación de actividad ────────────────────────────────────────────

  onClasifActividadChange(tipo: 'O' | 'P' | ''): void {
    this.cierreClasifActividad = tipo;
    this.cierreActividadSelec  = null;
    this.cierreDelitoSelec     = null;
    this.cierreDelitoBusqueda  = '';
    this.actividadesFiltered   = tipo
      ? this.actividadesPoliciales.filter(a => a.tipo === tipo)
      : [];
  }

  onActividadChange(codigo: string): void {
    this.cierreActividadSelec = this.actividadesFiltered.find(a => a.codigo === codigo) ?? null;
    this.cierreDelitoSelec    = null;
    this.cierreDelitoBusqueda = '';
    this.cierreDelitoSugs     = [];
  }

  // ── Delito autocomplete ────────────────────────────────────────────────────

  onCierreDelitoInput(valor: string): void {
    this.cierreDelitoBusqueda      = valor;
    this.cierreDelitoSubj.next(valor);
    this.mostrarSugerenciasDelito  = true;
  }

  seleccionarCierreDelito(item: DtoDelitoItem): void {
    this.cierreDelitoSelec         = item;
    this.cierreDelitoBusqueda      = `${item.articulo} – ${item.descripcion}`;
    this.cierreDelitoSugs          = [];
    this.mostrarSugerenciasDelito  = false;
  }

  cerrarSugerenciasDelito(): void {
    setTimeout(() => { this.mostrarSugerenciasDelito = false; }, 200);
  }

  /**
   * Confirma el cierre de la actuación (Atendió).
   * Actuación A → C · registra fecha_cierre · medio → 27 (Libre).
   * Si cerrarEventoAlAtender = true, encadena el cierre del evento.
   */
  confirmarCierreActuacion(): void {
    if (!this.actuacionACerrar || this.cerrandoActuacion) return;
    if (!this.cierreCodsSeleccionados.length) {
      this.errorCierreActuacion = 'Agregue al menos un código de cierre.';
      return;
    }
    if (this.cerrarEventoAlAtender === null) {
      this.errorCierreActuacion = 'Indique si desea cerrar el evento al finalizar.';
      return;
    }

    this.cerrandoActuacion    = true;
    this.errorCierreActuacion = '';

    const req: DtoCierreActuacionRequest = {
      estado:             'C',
      observacionCierre:  this.cierreObservacion.trim() || undefined,
      codigosCierre:      this.cierreCodsSeleccionados,
      actividadCodigo:    this.cierreActividadSelec?.codigo,
      actividadTipo:      this.cierreClasifActividad || undefined,
      actividadDesc:      this.cierreActividadSelec?.descripcion,
      delitoArticulo:     this.cierreDelitoSelec?.articulo,
      delitoDesc:         this.cierreDelitoSelec?.descripcion
    };

    const actuacionId = this.actuacionACerrar.id;

    this.actuacionSvc.cerrarActuacion(actuacionId, req).subscribe({
      next: () => {
        this.cerrandoActuacion    = false;
        this.modalCierreActuacion = false;
        this.actuacionACerrar     = null;
        this.toggleBodyModalClass(false);

        if (this.cerrarEventoAlAtender && this.detalle) {
          // Cerrar también el evento — solo datos de cierre van a cad_eventos;
          // cad_pedidos.comentario es inmutable y NO se toca aquí.
          // Nota: si esta era la última actuación abierta, el backend ya cerró
          // cad_eventos.estado automáticamente (fn_recalcular_estado_evento) antes
          // de que esta llamada llegue — esta petición sigue siendo necesaria
          // porque es la que persiste los códigos de cierre y la observación
          // (el recálculo automático solo cambia el estado, no esos datos).
          this.eventoSvc.cerrar(this.detalle.id, {
            estado:            'C',
            observacionCierre: req.observacionCierre?.trim() || 'Cerrado al atender.',
            codigosCierre:     req.codigosCierre.map((c, i) => ({
              orden:            i + 1,
              codigoCierre:     c.codigoCierre,
              tipoCodigo:       c.tipoCodigo ?? 'CIERRE',
              descripcionLibre: c.descripcionLibre || undefined
            }))
          }, this.canalSeleccionado, this.fuerzaId).subscribe({
            next: (r) => {
              if (r.success) {
                this.toast.success('Evento cerrado', r.message || 'El evento se cerró correctamente.');
                this.volverLista();
              } else {
                // Antes este caso ni siquiera se alcanzaba aquí (llegaba como error
                // HTTP 400 y caía en la rama `error` de abajo, silenciada).
                this.toast.warning('Cerrar evento', r.message || 'No se pudo cerrar el evento.');
                this.recargarAhora();
              }
            },
            error: (e) => {
              // Antes se descartaba en silencio — el despachador nunca se enteraba
              // de que el evento había quedado cerrado (por la última actuación)
              // pero SIN los códigos de cierre ni la observación que acababa de
              // digitar, porque esta petición es la única que los persiste.
              this.toast.error('Cerrar evento',
                e.error?.message ?? 'La actuación se cerró, pero no se pudo cerrar el evento. Intente cerrarlo manualmente.');
              this.recargarAhora();
            }
          });
        } else {
          this.recargarActuaciones();
          this.recargarRecursos();   // refleja medio → Libre (27)
          this.recargarAhora();      // recalcula el estado del evento
        }
      },
      error: (e) => {
        this.cerrandoActuacion    = false;
        this.errorCierreActuacion = e.error?.message ?? 'Error al cerrar la actuación.';
      }
    });
  }

  // ─── Polling de actuaciones ───────────────────────────────────────────────────

  private iniciarPollingActuaciones(eventoId: string): void {
    this.detenerPollingActuaciones();
    this.actuacionesSub = interval(8_000)
      .pipe(startWith(0), switchMap(() => {
        this.cargandoActuaciones = true;
        return this.actuacionSvc.getActuacionesEvento(eventoId);
      }))
      .subscribe({
        next: (r) => {
          this.actuaciones         = r.data ?? [];
          this.cargandoActuaciones = false;
          this.errorActuaciones    = '';
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargandoActuaciones = false;
          this.errorActuaciones    = 'Error al cargar actuaciones.';
        }
      });
  }

  private detenerPollingActuaciones(): void {
    if (this.actuacionesSub) {
      this.actuacionesSub.unsubscribe();
      this.actuacionesSub = null;
    }
  }

  private recargarActuaciones(): void {
    if (!this.detalle) return;
    this.actuacionSvc.getActuacionesEvento(this.detalle.id).subscribe({
      next: (r) => { this.actuaciones = r.data ?? []; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  /**
   * Recarga inmediata de recursos (single-shot, sin esperar el ciclo de 8 s).
   * Aplica las mismas transformaciones que el polling: distancias, orden y marcadores.
   */
  private recargarRecursos(): void {
    if (this.canalSeleccionado <= 0) return;
    this.turnosSvc.getResumenRecursosCanal(
      this.canalSeleccionado, this.sitioGraba || 1, this.fuerzaId || undefined
    ).subscribe({
      next: (data) => {
        this.recursos          = data;
        this.errorRecursos     = '';
        this.ultimaActRecursos = new Date();
        // Re-calcular distancias al incidente (Haversine)
        if (this.detalle?.latitudCaso && this.detalle?.longitudCaso) {
          const lat0 = parseFloat(this.detalle.latitudCaso);
          const lng0 = parseFloat(this.detalle.longitudCaso);
          this.recursos.forEach(r => {
            r.distanciaKm = (r.lat != null && r.lng != null)
              ? this.haversineKm(lat0, lng0, r.lat, r.lng) : undefined;
          });
          // Libres primero, luego por distancia
          this.recursos.sort((a, b) => {
            const libre = (x: DtoMedioDisponibleResumen) => x.estado === 27 ? 0 : 1;
            const df = libre(a) - libre(b);
            if (df !== 0) return df;
            return (a.distanciaKm ?? 9999) - (b.distanciaKm ?? 9999);
          });
        }
        this.actualizarMarcadoresRecursos();
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  /** Helpers para la plantilla */
  etiquetaEstadoActuacion(estado: string): string {
    return this.actuacionSvc.etiquetaEstado(estado as any);
  }

  claseEstadoActuacion(estado: string): string {
    return this.actuacionSvc.claseEstado(estado as any);
  }

  /** Determina si el medio ya está asignado a ESTE evento */
  medioAsignadoAEsteEvento(r: DtoMedioDisponibleResumen): boolean {
    if (!this.detalle || !r.eventoId) return false;
    return String(r.eventoId) === String(this.detalle.id);
  }

  /** Fórmula de Haversine — retorna distancia en km. */
  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Actualiza los marcadores de recursos en el mapa del evento. */
  private actualizarMarcadoresRecursos(): void {
    if (!this.mapaDetalle) return;
    this.recursoMarkers.forEach(m => { try { m.remove(); } catch { /**/ } });
    this.recursoMarkers = [];

    const colores: Record<number, string> = {
      27: '#22c55e', 28: '#ef4444', 29: '#6b7280', 30: '#f59e0b', 31: '#3b82f6'
    };

    this.recursos
      .filter(r => r.lat != null && r.lng != null)
      .forEach(r => {
        const color = colores[r.estado] ?? '#94a3b8';
        const icon  = L.divIcon({
          className: '',
          html: `<div style="
            width:16px;height:16px;border-radius:50%;
            background:${color};border:2px solid #fff;
            box-shadow:0 1px 5px rgba(0,0,0,.45);
            display:flex;align-items:center;justify-content:center;">
          </div>
          <div style="
            font-size:9px;font-weight:700;color:#fff;
            text-shadow:0 0 4px rgba(0,0,0,.8);
            margin-top:-12px;text-align:center;white-space:nowrap;">
            ${r.patrullaCodigo}
          </div>`,
          iconSize:   [16, 28],
          iconAnchor: [8, 8],
          popupAnchor:[0, -10]
        });
        const dist = r.distanciaKm != null
          ? `<br><b>${this.turnosSvc.formatearDistancia(r.distanciaKm)}</b> al incidente` : '';
        const marker = L.marker([r.lat!, r.lng!], { icon })
          .addTo(this.mapaDetalle)
          .bindPopup(`<b>${r.patrullaCodigo}</b><br>
            ${r.estadoDesc}<br>
            ${r.personalResumen || 'Sin personal'}${dist}`);
        this.recursoMarkers.push(marker);
      });
  }

  formatDistancia(km?: number): string {
    return this.turnosSvc.formatearDistancia(km);
  }

  iconoTipo(tipo: number): string {
    return this.turnosSvc.iconoTipoMedio(tipo as any);
  }

  claseEstadoMedio(estado: number): string {
    return this.turnosSvc.claseEstadoMedio(estado as any);
  }

  etiquetaEstadoMedio(estado: number): string {
    return this.turnosSvc.etiquetaEstadoMedio(estado as any);
  }

  etiquetaTipoMedio(tipo: number): string {
    const map: Record<number, string> = {
      20: 'Motocicleta', 21: 'Bicicleta', 22: 'Patrulla',
      23: 'Ambulancia',  24: 'Camión Bomberos', 25: 'Helicóptero', 26: 'Lancha'
    };
    return map[tipo] ?? `Tipo ${tipo}`;
  }

  // ─── Leaflet map ─────────────────────────────────────────────────────────────

  private initMapaDetalle(): void {
    if (this.mapaInicializado || !this.detalle) return;
    const el = document.getElementById('mapaEvento');
    if (!el) return;

    const lat  = parseFloat(this.detalle.latitudCaso  || '0');
    const lng  = parseFloat(this.detalle.longitudCaso || '0');
    const hasCoords = lat !== 0 && lng !== 0;

    const center: [number, number] = hasCoords ? [lat, lng] : [4.711, -74.0721];

    try {
      this.mapaDetalle = L.map('mapaEvento', { zoomControl: true }).setView(center, hasCoords ? 15 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(this.mapaDetalle);

      if (hasCoords) {
        L.marker([lat, lng])
          .addTo(this.mapaDetalle)
          .bindPopup(`<b>${this.detalle.direCaso ?? ''}</b>`)
          .openPopup();
      }

      this.mapaInicializado = true;
    } catch (e) {
      console.warn('[Eventos] Leaflet init error:', e);
    }
  }

  private destroyMapaDetalle(): void {
    if (this.mapaDetalle) {
      try { this.mapaDetalle.remove(); } catch { /* ignore */ }
      this.mapaDetalle     = null;
      this.mapaInicializado = false;
    }
  }

  // ─── §6.1 Modal Remitir a agencia ────────────────────────────────────────────

  abrirModalRemitir(): void {
    this.remitirCanalesSelec.clear();
    this.remitirAgenciasSelec.clear();
    this.remitirError               = '';
    this.remitirEnviando            = false;
    this.remitirTab                 = 'secad';
    this.remitirMantenerCanalOrigen = true;

    // Cargar canales SECAD (agrupados por fuerza)
    this.recepcionSvc.getCanales(this.sitioGraba).subscribe({
      next: canales => {
        const mapa: Record<string, { fuerza: string; fuerzaId: number; canales: DtoCanalRecepcion[] }> = {};
        for (const c of (canales ?? [])) {
          const key = c.fuerza || 'SIN FUERZA';
          if (!mapa[key]) mapa[key] = { fuerza: key, fuerzaId: c.fuerzaId, canales: [] };
          mapa[key].canales.push(c);
        }
        this.remitirCanalesGrupos = Object.values(mapa).sort((a, b) =>
          a.fuerza.localeCompare(b.fuerza, 'es'));
      },
      error: () => { this.remitirCanalesGrupos = []; }
    });

    // Cargar agencias externas (con caché en memoria para la sesión)
    if (this.remitirAgencias.length === 0) {
      this.agenciaSvc.getActivas().subscribe({
        next:  data => { this.remitirAgencias = data ?? []; },
        error: ()   => { this.remitirAgencias = []; }
      });
    }

    this.modalRemitirVisible = true;
    this.toggleBodyModalClass(true);
  }

  cancelarRemitir(): void {
    this.modalRemitirVisible = false;
    this.toggleBodyModalClass(false);
  }

  /** Clave compuesta para un canal: "codigo:fuerzaId" */
  canalKey(c: DtoCanalRecepcion): string { return `${c.codigo}:${c.fuerzaId}`; }

  toggleRemitirCanal(c: DtoCanalRecepcion): void {
    const key = this.canalKey(c);
    if (this.remitirCanalesSelec.has(key)) this.remitirCanalesSelec.delete(key);
    else                                    this.remitirCanalesSelec.add(key);
  }

  toggleRemitirAgencia(id: string): void {
    if (this.remitirAgenciasSelec.has(id)) this.remitirAgenciasSelec.delete(id);
    else                                    this.remitirAgenciasSelec.add(id);
  }

  get remitirTotalSelec(): number {
    return this.remitirTab === 'secad'
      ? this.remitirCanalesSelec.size
      : this.remitirAgenciasSelec.size;
  }

  confirmarRemitir(): void {
    if (!this.detalle || this.remitirEnviando) return;
    this.remitirEnviando = true;
    this.remitirError    = '';

    const pedidoId   = this.detalle.id;                      // cad_pedidos.id
    const sitioGraba = this.detalle.sitioGraba ?? this.sitioGraba;
    // numeEvento = cad_eventos.id  (≠ .id que es cad_pedidos.id — ver DtoEventoListItem)
    const eventoId   = this.eventoSeleccionado?.numeEvento
                    ?? this.detalle.numeEvento
                    ?? this.detalle.id;

    if (this.remitirTab === 'secad') {
      // ── Remisión a canales SECAD ────────────────────────────────────────────
      if (this.remitirCanalesSelec.size === 0) {
        this.remitirError = 'Selecciona al menos un canal.';
        this.remitirEnviando = false;
        return;
      }

      // Reconstruir DtoCanalSeleccionado[] desde las claves "codigo:fuerzaId"
      const canalesDto: DtoCanalSeleccionado[] = [...this.remitirCanalesSelec].map(key => {
        const [codigo, fuerzaId] = key.split(':').map(Number);
        return { codigo, fuerzaId };
      });

      const removerCanalOrigen = !this.remitirMantenerCanalOrigen;

      this.recepcionSvc.remitirCanal({
        pedidoId,
        sitioGraba,
        eventoId,
        canales: canalesDto,
        removerCanalOrigen,
        canalOrigenCodigo:   this.canalSeleccionado || undefined,
        canalOrigenFuerzaId: this.fuerzaId || undefined,
      }).subscribe({
        next: r => {
          this.remitirEnviando = false;
          if (r.success) {
            this.toast.success('Remisión SECAD', r.message);
            // Añadir anotación de trazabilidad
            const canalesNombres = [...this.remitirCanalesSelec]
              .map(key => {
                for (const g of this.remitirCanalesGrupos)
                  for (const c of g.canales)
                    if (this.canalKey(c) === key) return `${g.fuerza} – ${c.descripcion}`;
                return key;
              }).join(', ');
            const modoTexto = removerCanalOrigen
              ? ' (remisión exclusiva — removido de mi canal)'
              : ' (gestión conjunta — permanece también en mi canal)';
            this.eventoSvc.createAnotacion(this.detalle!.id, {
              titulo:        'Caso remitido a canal SECAD',
              anotacion:     `Remitido a: ${canalesNombres}${modoTexto}`,
              tipoAnotacion: 'REMISION'
            }).subscribe({ next: _ => {}, error: () => {} });
            this.cancelarRemitir();
            if (removerCanalOrigen) {
              // El caso ya no pertenece a mi canal — no tiene sentido seguir
              // mirando su detalle desde aquí.
              this.volverLista();
            } else {
              // Sigue siendo mío también — refrescar el panel de canales
              // asignados para reflejar el nuevo canal destino de inmediato.
              this.cargarCanalesAsignados();
            }
          } else {
            this.remitirError = r.message;
          }
        },
        error: () => {
          this.remitirEnviando = false;
          this.remitirError    = 'Error de comunicación con el servidor.';
        }
      });

    } else {
      // ── Remisión a agencias externas por API ────────────────────────────────
      if (this.remitirAgenciasSelec.size === 0) {
        this.remitirError = 'Selecciona al menos una agencia.';
        this.remitirEnviando = false;
        return;
      }

      const promises = [...this.remitirAgenciasSelec].map(agenciaId =>
        this.agenciaSvc.despachar({ pedidoId, sitioGraba, agenciaId }).toPromise()
      );

      Promise.allSettled(promises).then(results => {
        this.remitirEnviando = false;
        const ok  = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
        const err = results.length - ok;

        if (ok > 0)
          this.toast.success('Remisión externa', `${ok} agencia(s) notificadas correctamente.`);
        if (err > 0)
          this.toast.warning('Remisión parcial',
            `${err} agencia(s) no pudieron ser contactadas.`);

        if (ok > 0) {
          this.eventoSvc.getAnotaciones(this.detalle!.id).subscribe(a => {
            if (this.detalle) this.detalle.anotaciones = a;
          });
          this.cancelarRemitir();
        }
      });
    }
  }

  getAgenciaIcon  = (tipo: string) => this.agenciaSvc.getTipoIcon(tipo);
  getAgenciaLabel = (tipo: string) => this.agenciaSvc.getTipoLabel(tipo);

  // ─── §6.17 Asistente Inteligente ─────────────────────────────────────────────

  /** Abre/cierra el panel del asistente. Carga las categorías la primera vez. */
  toggleAsistente(): void {
    this.asistenteAbierto = !this.asistenteAbierto;
    if (this.asistenteAbierto && this.asistenteCategorias.length === 0) {
      this.cargarAsistenteCategorias();
    }
  }

  private cargarAsistenteCategorias(): void {
    this.asistenteLoadingCat = true;
    this.asistenteSvc.getCategorias(true).subscribe({
      next: (r) => {
        this.asistenteCategorias = r.data ?? [];
        this.asistenteLoadingCat = false;
      },
      error: () => { this.asistenteLoadingCat = false; }
    });
  }

  /** Se llama cuando el despachador cambia de categoría. */
  onAsistenteCategoriaChange(categoriaId: string): void {
    this.asistenteCategoriaSel = categoriaId;
    this.asistentePreguntas    = [];
    if (!categoriaId) return;

    this.asistenteLoadingPreg = true;
    this.asistenteSvc.getPreguntas(categoriaId, true).subscribe({
      next: (r) => {
        this.asistentePreguntas    = r.data ?? [];
        this.asistenteLoadingPreg  = false;
      },
      error: () => { this.asistenteLoadingPreg = false; }
    });
  }

  /** Reinicia el estado del asistente (llamado en volverLista y abrirDetalle). */
  private resetAsistente(): void {
    this.asistenteAbierto      = false;
    this.asistenteCategorias   = [];
    this.asistenteCategoriaSel = '';
    this.asistentePreguntas    = [];
  }

  // ─── Utility ──────────────────────────────────────────────────────────────────

  formatHora(raw: string | null | undefined): string {
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleString('es-CO', {
        day:    '2-digit',
        month:  '2-digit',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch { return raw; }
  }

  trackById(_: number, item: DtoEventoListItem): string { return item.id; }
  trackByIdAnot(_: number, a: DtoAnotacion): number  { return a.id; }
}
