import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  HostListener,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, Subject, interval } from 'rxjs';
import { switchMap, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { EventoService, DtoEventoListItem, DtoCanalItem, DtoSlaConfig, DtoEventoConteos, DtoCanalesAsignadosResult, DtoEstadoHistorialItem, DtoPedidoCercano } from '../../../core/services/operacion/evento.service';
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
  DtoMedioDisponibleResumen,
  DtoRecursoCercano
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
import { VideoLlamadaService, EstadoLlamada, ChatMensaje, UbicacionCiudadano } from '../../../core/services/operacion/video-llamada.service';
import { PanelColapsableComponent } from '../../../components/panel-colapsable/panel-colapsable';
import { animateMarkerTo, stopMarkerAnimation } from '../../../shared/utils/leaflet-marker-animator';

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
  styleUrls: ['./eventos.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  private videoSvc      = inject(VideoLlamadaService);
  private toast         = inject(ToastService);

  // ─── JWT claims ──────────────────────────────────────────────────────────────
  canalId    = 0;
  fuerzaId   = 0;
  sitioGraba = 0;
  idUsuario  = 0;
  /** true si el usuario tiene rol Superadmin (id_rol=1) o está en SuperUserIds. */
  esAdmin    = false;

  // ─── Canal selector ──────────────────────────────────────────────────────────
  readonly canalesDisponibles = signal<DtoCanalItem[]>([]);
  canalSeleccionado  = 0;
  readonly canalNombre        = signal('');
  readonly mostrarSelectorCanal = signal(false);

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
  recursosAbierto         = true;
  despachoAbierto         = true;
  fotosAbierto            = true;
  anotacionesAbierto      = true;
  canalesAsignadosAbierto = true;

  /** Visibilidad multi-canal: qué canales SECAD y agencias externas tienen este evento. */
  readonly canalesAsignados = signal<DtoCanalesAsignadosResult | null>(null);

  // ─── List state ──────────────────────────────────────────────────────────────
  readonly eventos = signal<DtoEventoListItem[]>([]);
  filtroTexto   = '';
  filtroEstado  = '';        // '' = todos | 'A'=Activos | 'P'=Pendientes | 'C'=Cerrados turno
  readonly cargando   = signal(false);
  readonly errorCarga = signal('');

  /** ids vistos en el poll anterior — para detectar cuáles son nuevos en este tick. */
  private idsConocidos    = new Set<string>();
  /** ids que acaban de aparecer en este tick — reciben el destello ".ev-item--nuevo". */
  private readonly idsRecienLlegados = signal(new Set<string>());
  private limpiarRecienLlegadosTimer?: ReturnType<typeof setTimeout>;
  /** false en la primera carga — evita que TODA la bandeja destelle al abrir la página. */
  private primerPollCompletado = false;

  /** Contadores por estado — alimentan los badges de los filtros. */
  readonly conteos = signal<DtoEventoConteos>({
    total: 0, activos: 0, pendientes: 0, enProceso: 0,
    seguimiento: 0, revision: 0, cerradosTurno: 0,
    turnoActual: '', turnoDesde: ''
  });

  // ─── Detail panel ────────────────────────────────────────────────────────────
  panelMode: PanelMode = 'list';
  readonly detalle = signal<DtoPedidoDetalle | null>(null);
  readonly cargandoDetalle = signal(false);
  /** Item de lista del evento actualmente abierto en el panel de detalle.
   *  Permite acceder a campos del listado (numeEvento, etc.) desde el detalle. */
  eventoSeleccionado: DtoEventoListItem | null = null;

  // ─── Annotation form ─────────────────────────────────────────────────────────
  readonly nuevaAnotacion = signal<DtoAnotacionRequest>({ titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' });
  readonly guardandoAnotacion = signal(false);
  readonly mensajeAnotacion   = signal('');

  // ─── Close-event modal ───────────────────────────────────────────────────────
  readonly modalCerrarVisible   = signal(false);
  cerrarComentario     = '';
  readonly cerrandoEvento       = signal(false);
  /** Confirmación explícita — el operador debe marcarla antes de cerrar (acción sin deshacer). */
  cierreConfirmado     = false;
  // Multi-code para cierre de evento
  private eventoCodSubj        = new Subject<string>();
  eventoCodBusqueda            = '';
  readonly eventoSugerencias   = signal<DtoCodigoCasoItem[]>([]);
  eventoCodsSelec:             { codigo: string; descripcion: string }[] = [];
  readonly mostrarSugerenciasEvento = signal(false);

  // ─── Estado change ───────────────────────────────────────────────────────────
  readonly cambiandoEstado = signal(false);
  readonly modalCambiarEstadoVisible = signal(false);
  readonly estadoNuevoPendiente = signal('');
  motivoCambioEstado   = '';
  readonly errorCambioEstado    = signal('');

  /** Historial de cambios de estado del caso — quién, cuándo y por qué. */
  readonly estadoHistorial = signal<DtoEstadoHistorialItem[]>([]);
  historialEstadoAbierto = false;

  // ─── Duplicados / contexto histórico de dirección ────────────────────────────
  readonly duplicados        = signal<DtoPedidoCercano[]>([]);
  readonly cargandoDuplicados = signal(false);
  duplicadosDescartados = false;   // banner cerrado manualmente para este evento
  readonly vinculandoId = signal<string | null>(null);

  // ─── Presencia — quién más está viendo este caso ─────────────────────────────
  readonly presenciaUsuarios = signal<string[]>([]);
  private presenciaSub: Subscription | null = null;

  // ─── Apoyo urgente (seguridad del funcionario) ───────────────────────────────
  readonly solicitandoApoyoId = signal<string | null>(null);

  // ─── Plantillas rápidas de anotaciones ───────────────────────────────────────
  readonly plantillasAnotacion: { label: string; texto: string }[] = [
    { label: 'Sin novedad',        texto: 'Sin novedad en el sitio.' },
    { label: 'No se ubica dirección', texto: 'El recurso no logra ubicar la dirección reportada.' },
    { label: 'Sitio abandonado',   texto: 'Al llegar al sitio no se encontró a nadie / novedad no verificada.' },
    { label: 'Requiere apoyo',     texto: 'Se requiere apoyo de otra unidad para atender el caso.' },
    { label: 'Vía obstruida',      texto: 'Demora por vía obstruida / tráfico en la ruta al sitio.' }
  ];

  // ─── Búsqueda backend (más allá de la cola cargada) ──────────────────────────
  private busquedaSubj = new Subject<string>();
  readonly resultadosBusqueda = signal<DtoEventoListItem[]>([]);
  readonly buscandoBackend       = signal(false);
  get mostrarResultadosBusqueda(): boolean {
    return this.filtroTexto.trim().length >= 3;
  }

  // ─── Alerta sonora para casos nuevos ─────────────────────────────────────────
  private readonly SONIDO_KEY = 'ev_sonido_activo';
  sonidoActivo = true;
  private audioCtx: AudioContext | null = null;

  // ─── Semáforo reactive tick ──────────────────────────────────────────────────
  readonly tick = signal(0);

  // ─── SLA configuration (cargado desde BD al inicio) ──────────────────────────
  readonly slaConfig = signal<DtoSlaConfig[]>([]);

  /** Umbral en minutos para "sin acceso → advertencia" (default 1). */
  get slaUmbralSinAcceso(): number {
    return this.slaConfig().find(s => s.nombre === 'SIN_ACCESO')?.umbralMinutos ?? 1;
  }
  /** Umbral en minutos para "en gestión → crítico" (default 10). */
  get slaUmbralCritico(): number {
    return this.slaConfig().find(s => s.nombre === 'GESTION_CRITICA')?.umbralMinutos ?? 10;
  }

  // ─── Leaflet map ─────────────────────────────────────────────────────────────
  private mapaDetalle: any = null;
  private mapaInicializado = false;
  private pendingMapInit    = false;

  // ─── Recursos en turno (panel de despacho) ───────────────────────────────────
  readonly recursos = signal<DtoMedioDisponibleResumen[]>([]);
  readonly cargandoRecursos   = signal(false);
  readonly errorRecursos      = signal('');
  readonly ultimaActRecursos  = signal<Date | null>(null);
  readonly asignandoMedioId   = signal<string | null>(null);
  private recursoMarkers:   any[]  = [];
  /** patrullaCodigo → marker, para reusar/animar en vez de destruir y recrear cada 8s. */
  private recursoMarkersPorCodigo = new Map<string, any>();
  private recursosSub:      Subscription | null = null;

  // ─── Sugerencia de cuadrante más cercano (PostGIS) ───────────────────────────
  readonly sugerenciasRecurso = signal<DtoRecursoCercano[]>([]);
  readonly cargandoSugerencia = signal(false);
  readonly mostrarSugerencia  = signal(false);
  readonly errorSugerencia    = signal('');

  /** ids de actuación en 'D' cuyo recurso ya está a <100m del incidente — sugiere confirmar llegada. */
  private readonly sugerenciasLlegada = signal(new Set<string>());

  // ─── Actuaciones / timeline de despacho ──────────────────────────────────────
  readonly actuaciones = signal<DtoActuacionListItem[]>([]);
  readonly cargandoActuaciones = signal(false);
  readonly errorActuaciones    = signal('');
  readonly operandoActuacionId = signal<string | null>(null);   // ID de la actuación en proceso
  private actuacionesSub:   Subscription | null = null;

  // ─── Modal: Cierre de actuación (paso "Atendió") — expandido ────────────────
  readonly modalCierreActuacion = signal(false);
  readonly actuacionACerrar     = signal<DtoActuacionListItem | null>(null);
  readonly cerrandoActuacion    = signal(false);
  readonly errorCierreActuacion = signal('');

  // Multi-código tipificación (cad_casos)
  private cierreCodSubj            = new Subject<string>();
  cierreCodBusqueda                = '';
  readonly cierreSugerencias       = signal<DtoCodigoCasoItem[]>([]);
  cierreCodsSeleccionados:         DtoCodigoCierreActuacion[] = [];
  readonly mostrarSugerenciasCierre = signal(false);

  // Clasificación y actividad policial
  readonly actividadesPoliciales = signal<DtoActividadPolicial[]>([]);
  actividadesFiltered:             DtoActividadPolicial[] = [];
  cierreClasifActividad:           'O' | 'P' | '' = '';
  cierreActividadSelec:            DtoActividadPolicial | null = null;

  // Delito (Código Penal) — solo si actividad.requiereDelito = true
  private cierreDelitoSubj         = new Subject<string>();
  cierreDelitoBusqueda             = '';
  readonly cierreDelitoSugs        = signal<DtoDelitoItem[]>([]);
  cierreDelitoSelec:               DtoDelitoItem | null = null;
  readonly mostrarSugerenciasDelito = signal(false);

  // Observación libre
  cierreObservacion                = '';

  // ¿Cerrar el evento después de cerrar la actuación?
  cerrarEventoAlAtender:           boolean | null = null;

  // Anotaciones OPERATIVA: sub-campos dinámicos
  readonly anotActividadCodigo  = signal('');
  readonly anotActividadDesc    = signal('');
  readonly anotRequiereDelito   = signal(false);
  readonly anotDelitoArticulo   = signal('');
  readonly anotDelitoDesc       = signal('');

  // ─── Modal: Desasignar recurso (solo estado P) ───────────────────────────────
  readonly modalDesasignarVisible = signal(false);
  readonly actuacionADesasignar   = signal<DtoActuacionListItem | null>(null);
  desasignarMotivo          = '';
  readonly desasignando           = signal(false);
  readonly errorDesasignar        = signal('');

  // ─── Modal: Registrar novedad operativa ──────────────────────────────────────
  readonly modalNovedadVisible = signal(false);
  readonly actuacionNovedad    = signal<DtoActuacionListItem | null>(null);
  novedadTexto              = '';
  novedadTipo:              'GENERAL' | 'NOVEDAD' | 'ALERTA' = 'NOVEDAD';
  readonly guardandoNovedad    = signal(false);
  readonly errorNovedad        = signal('');

  // ─── Error de asignación (para mostrar feedback en tabla de recursos) ────────
  readonly errorAsignacion = signal('');

  // ─── §6.1 Modal Remitir a agencia / canal ────────────────────────────────────
  readonly modalRemitirVisible = signal(false);
  remitirTab:           'secad' | 'externa' = 'secad';
  // Tab SECAD — canales disponibles agrupados por fuerza
  readonly remitirCanalesGrupos = signal<{ fuerza: string; fuerzaId: number; canales: DtoCanalRecepcion[] }[]>([]);
  /** Clave compuesta "codigo:fuerzaId" — el código solo no es único entre fuerzas */
  remitirCanalesSelec   = new Set<string>();
  // Tab externa — agencias externas por API
  readonly remitirAgencias = signal<DtoAgenciaExterna[]>([]);
  remitirAgenciasSelec  = new Set<string>();        // IDs de agencia seleccionadas
  readonly remitirEnviando       = signal(false);
  readonly remitirError          = signal('');
  /**
   * true (default) = gestión conjunta: el caso permanece también en mi canal.
   * false = remisión exclusiva: se remueve de mi canal (llegó al canal
   * incorrecto y solo debe gestionarse en el destino).
   */
  remitirMantenerCanalOrigen = true;
  /** Confirmación explícita antes de remitir el caso a otro canal/agencia. */
  remitirConfirmado          = false;

  // ─── Adjuntos (fotos del pedido) ──────────────────────────────────────────────
  readonly adjuntos = signal<DtoAdjunto[]>([]);

  // ─── Videollamada con el ciudadano (WebRTC P2P) ──────────────────────────────
  readonly videollamadaEstado = signal<EstadoLlamada>('inactiva');
  readonly videollamadaLink   = signal('');
  readonly videollamadaMensaje = signal('');
  videollamadaTelefono      = '';
  readonly creandoVideollamada = signal(false);
  readonly videollamadaRemoteStream = signal<MediaStream | null>(null);
  readonly videollamadaMicActivo = signal(true);
  readonly videollamadaChatDisponible = signal(false);
  readonly videollamadaChatMensajes = signal<ChatMensaje[]>([]);
  videollamadaChatAbierto  = false;
  videollamadaChatTexto    = '';
  grabandoVideollamada      = false;
  private videoSesionId     = '';
  private videoSubs         = new Subscription();
  readonly videollamadaUbicacion = signal<UbicacionCiudadano | null>(null);
  /** Marcador + recorrido del ciudadano, dibujados sobre el mismo mapa de recursos (mapaDetalle) — no un mapa aparte. */
  private ciudadanoMarker: any = null;
  private ciudadanoTrail: any = null;
  private ciudadanoHistorial: [number, number][] = [];

  // ─── §6.17 Asistente Inteligente ─────────────────────────────────────────────
  /** Panel colapsable visible en el detalle del evento. */
  asistenteAbierto      = false;
  readonly asistenteCategorias = signal<AsistenteCategoria[]>([]);
  readonly asistenteLoadingCat = signal(false);
  /** ID de la categoría seleccionada por el despachador. */
  asistenteCategoriaSel = '';
  readonly asistentePreguntas  = signal<AsistentePregunta[]>([]);
  readonly asistenteLoadingPreg = signal(false);
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

    // ── Videollamada — reflejar estado/track remoto del servicio en la UI ─────
    this.videoSubs.add(
      this.videoSvc.estado$.subscribe(e => { this.videollamadaEstado.set(e); })
    );
    this.videoSubs.add(
      this.videoSvc.remoteStream$.subscribe(s => { this.videollamadaRemoteStream.set(s); })
    );
    this.videoSubs.add(
      this.videoSvc.error$.subscribe(msg => { if (msg) this.toast.error('Videollamada', msg); })
    );
    this.videoSubs.add(
      this.videoSvc.microfonoActivo$.subscribe(activo => { this.videollamadaMicActivo.set(activo); })
    );
    this.videoSubs.add(
      this.videoSvc.chatDisponible$.subscribe(disp => { this.videollamadaChatDisponible.set(disp); })
    );
    this.videoSubs.add(
      this.videoSvc.chatMensajes$.subscribe((msgs: ChatMensaje[]) => { this.videollamadaChatMensajes.set(msgs); })
    );
    this.videoSubs.add(
      this.videoSvc.ubicacion$.subscribe(u => {
        this.videollamadaUbicacion.set(u);
        if (u) this.actualizarUbicacionCiudadanoEnMapa(u);
      })
    );

    // ── Preferencia de alerta sonora (persistida por navegador) ───────────────
    const sonidoGuardado = localStorage.getItem(this.SONIDO_KEY);
    if (sonidoGuardado != null) this.sonidoActivo = sonidoGuardado === '1';

    // ── Búsqueda backend (§ más allá de la cola cargada — incluye cerrados) ───
    this.subs.add(
      this.busquedaSubj.pipe(debounceTime(400), distinctUntilChanged())
        .subscribe(texto => {
          const q = texto.trim();
          if (q.length < 3) { this.resultadosBusqueda.set([]); this.buscandoBackend.set(false); return; }
          this.buscandoBackend.set(true);
          this.eventoSvc.buscar(q, this.fuerzaId || undefined, this.sitioGraba || undefined).subscribe({
            next: r  => { this.resultadosBusqueda.set(r); this.buscandoBackend.set(false); },
            error: () => { this.resultadosBusqueda.set([]); this.buscandoBackend.set(false); }
          });
        })
    );

    // ── Autocomplete: códigos de cierre (modal Atendió) ───────────────────────
    this.subs.add(
      this.cierreCodSubj.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(q => {
          if (!q.trim()) { this.cierreSugerencias.set([]); return; }
          this.actuacionSvc.buscarCodigosCierre(q).subscribe({
            next: r => { this.cierreSugerencias.set(r.data ?? []); },
            error: () => { this.cierreSugerencias.set([]); }
          });
        })
    );

    // ── Autocomplete: delito (modal Atendió) ──────────────────────────────────
    this.subs.add(
      this.cierreDelitoSubj.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(q => {
          if (!q.trim()) { this.cierreDelitoSugs.set([]); return; }
          this.actuacionSvc.buscarDelitos(q).subscribe({
            next: r => { this.cierreDelitoSugs.set(r.data ?? []); },
            error: () => { this.cierreDelitoSugs.set([]); }
          });
        })
    );

    // ── Autocomplete: códigos de cierre (modal Cerrar Evento) ─────────────────
    this.subs.add(
      this.eventoCodSubj.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(q => {
          if (!q.trim()) { this.eventoSugerencias.set([]); return; }
          this.actuacionSvc.buscarCodigosCierre(q).subscribe({
            next: r => { this.eventoSugerencias.set(r.data ?? []); },
            error: () => { this.eventoSugerencias.set([]); }
          });
        })
    );

    // ── SLA config (Épica 5) — cargar al inicio, no crítico si falla ─────────
    this.eventoSvc.getSlaConfig().subscribe({
      next: (cfg) => { this.slaConfig.set(cfg); },
      error: () => { /* usa defaults hardcoded en los getters */ }
    });

    // Semáforo tick every 60s — mantiene la reactividad del semáforo
    this.subs.add(
      interval(60_000).subscribe(() => {
        this.tick.update(t => t + 1);
      })
    );

    // Auto-refresh the queue every 15s
    // Los conteos (badges) se actualizan en el mismo ciclo de forma paralela.
    this.subs.add(
      interval(15_000)
        .pipe(
          startWith(0),
          switchMap(() => {
            this.cargando.set(true);
            // Conteos: siempre globales (sin filtro de estado) para mostrar todos los badges
            this.eventoSvc.getConteos(
              this.canalSeleccionado || undefined,
              this.fuerzaId || undefined
            ).subscribe({
              next:  (c) => { this.conteos.set(c); },
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
                this.idsRecienLlegados.set(new Set(idsNuevos));
                clearTimeout(this.limpiarRecienLlegadosTimer);
                this.limpiarRecienLlegadosTimer = setTimeout(() => {
                  this.idsRecienLlegados.set(new Set());
                }, 6000);
                this.reproducirAlertaSonora();
              }
            } else {
              this.primerPollCompletado = true;
            }
            this.idsConocidos = new Set(items.map(i => i.id));

            this.eventos.set(items);
            this.cargando.set(false);
            this.errorCarga.set('');
          },
          error: (err) => {
            this.cargando.set(false);
            this.errorCarga.set('Error al obtener eventos. Reintentando...');
            console.error('[Eventos] Error carga:', err);
          }
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.videoSubs.unsubscribe();
    if (this.videollamadaEstado() !== 'inactiva') this.videoSvc.colgar();
    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.detenerPollingActuaciones();
    this.detenerPollingPresencia();
    clearTimeout(this.limpiarRecienLlegadosTimer);
  }

  ngAfterViewChecked(): void {
    if (this.pendingMapInit && this.panelMode === 'detail' && this.detalle()) {
      this.initMapaDetalle();
      this.pendingMapInit = false;
    }
  }

  // ─── Canal selector ──────────────────────────────────────────────────────────

  private cargarCanales(): void {
    this.eventoSvc.getCanales(this.sitioGraba || undefined).subscribe({
      next: (c) => {
        this.canalesDisponibles.set(c);
        // Resolve canal name for the header
        this.actualizarNombreCanal();
        // Show selector if canal not configured in JWT
        if (this.canalSeleccionado <= 0 && c.length > 0) {
          this.mostrarSelectorCanal.set(true);
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
    const found = this.canalesDisponibles().find(
      c => c.codigo === this.canalSeleccionado && c.fuerzaId === this.fuerzaId
    );
    this.canalNombre.set(found
      ? `${found.fuerzaDesc} – ${found.descripcion}`
      : this.canalSeleccionado > 0
        ? `Canal ${this.canalSeleccionado}`
        : 'Sin canal');
  }

  seleccionarCanal(codigo: number, fuerzaId: number): void {
    this.canalSeleccionado    = codigo;
    this.fuerzaId             = fuerzaId;
    this.mostrarSelectorCanal.set(false);
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
    this.mostrarSelectorCanal.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarSelector(): void {
    this.mostrarSelectorCanal.set(false);
    this.toggleBodyModalClass(false);
  }

  // ─── List helpers ─────────────────────────────────────────────────────────────

  recargarAhora(): void {
    this.cargando.set(true);

    // Actualizar conteos (badges) en paralelo — no crítico si falla
    this.eventoSvc.getConteos(
      this.canalSeleccionado || undefined,
      this.fuerzaId || undefined
    ).subscribe({
      next:  (c) => { this.conteos.set(c); },
      error: ()  => { /* no crítico */ }
    });

    this.eventoSvc.getEventos(
      this.canalSeleccionado || undefined,
      this.fuerzaId || undefined,
      this.filtroEstado || undefined
    ).subscribe({
      next:  (items) => { this.eventos.set(items); this.cargando.set(false); this.errorCarga.set(''); },
      error: ()      => { this.cargando.set(false); this.errorCarga.set('Error al cargar eventos.'); }
    });
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    this.recargarAhora();
  }

  get eventosFiltrados(): DtoEventoListItem[] {
    const eventos = this.eventos();
    if (!this.filtroTexto) return eventos;
    const q = this.filtroTexto.trim().toLowerCase();
    return eventos.filter(e =>
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
    return this.actuaciones().filter(
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
    this.detalle.set(null);
    this.actuaciones.set([]);       // limpiar despachos del evento anterior
    this.recursos.set([]);       // limpiar recursos del evento anterior
    this.errorAsignacion.set('');       // limpiar errores de asignación anteriores
    this.errorActuaciones.set('');
    this.errorRecursos.set('');
    this.cargandoDetalle.set(true);
    this.mensajeAnotacion.set('');
    this.nuevaAnotacion.set({ titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' });
    this.pendingMapInit   = true;

    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.detenerPollingActuaciones();  // detener polling del evento anterior AHORA
    this.resetAsistente();

    this.adjuntos.set([]);
    this.canalesAsignados.set(null);
    this.estadoHistorial.set([]);
    this.duplicados.set([]);
    this.duplicadosDescartados = false;
    this.detenerPollingPresencia();
    this.resetVideollamada();
    this.videollamadaTelefono  = String(evento.numeTelefono ?? '');
    // Snapshot del id pedido: si el dispatcher selecciona OTRO evento antes de que
    // esta respuesta llegue, una respuesta fuera de orden no debe pisar el panel
    // que ya está mostrando el evento más reciente.
    const requestedId = evento.id;
    this.eventoSvc.getById(evento.id).subscribe({
      next: (d) => {
        if (this.eventoSeleccionado?.id !== requestedId) return;
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
        // El backend promueve el estado a 'E' al abrir (RegistrarAccesoAsync) — reflejarlo
        // de inmediato en la tarjeta de la bandeja, sin esperar el próximo poll de 15s.
        if (d) this.aplicarEstadoActualizado(d.id, d.estado);
        // Cargar fotos adjuntas del pedido (cad_adjuntos) si existe pedidoId
        if (d?.id) {
          this.recepcionSvc.getAdjuntos(d.id)
            .subscribe({ next: r => { if (r.success) this.adjuntos.set(r.data); } });
        }
        this.iniciarPollingRecursos();
        this.iniciarPollingActuaciones(evento.id);
        this.cargarCanalesAsignados();
        this.cargarHistorialEstado();
        this.cargarDuplicados();
        this.iniciarPollingPresencia(evento.id);
      },
      error: () => {
        if (this.eventoSeleccionado?.id !== requestedId) return;
        this.cargandoDetalle.set(false);
        this.errorCarga.set('No se pudo cargar el detalle del evento.');
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
    const detalle = this.detalle();
    if (!detalle) return;
    this.eventoSvc.getCanalesAsignados(detalle.id).subscribe({
      next: (r) => { this.canalesAsignados.set(r); },
      error: () => { /* no crítico — el panel simplemente no se muestra */ }
    });
  }

  volverLista(): void {
    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.detenerPollingActuaciones();
    this.detenerPollingPresencia();
    this.panelMode          = 'list';
    this.detalle.set(null);
    this.eventoSeleccionado = null;
    this.actuaciones.set([]);
    this.adjuntos.set([]);
    this.canalesAsignados.set(null);
    this.estadoHistorial.set([]);
    this.duplicados.set([]);
    this.resetAsistente();
    this.resetVideollamada();
  }

  // ─── Estado change ────────────────────────────────────────────────────────────

  /** Abre el modal que exige un motivo antes de aplicar el cambio de estado. */
  abrirModalCambiarEstado(nuevoEstado: string): void {
    if (!this.detalle() || this.cambiandoEstado()) return;
    this.estadoNuevoPendiente.set(nuevoEstado);
    this.motivoCambioEstado       = '';
    this.errorCambioEstado.set('');
    this.modalCambiarEstadoVisible.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarCambiarEstado(): void {
    this.modalCambiarEstadoVisible.set(false);
    this.estadoNuevoPendiente.set('');
    this.toggleBodyModalClass(false);
  }

  confirmarCambiarEstado(): void {
    const detalle = this.detalle();
    if (!detalle || this.cambiandoEstado() || !this.estadoNuevoPendiente()) return;
    if (!this.motivoCambioEstado.trim()) {
      this.errorCambioEstado.set('Ingrese el motivo del cambio de estado.');
      return;
    }
    this.cambiandoEstado.set(true);
    this.errorCambioEstado.set('');
    const nuevoEstado = this.estadoNuevoPendiente();

    this.eventoSvc.setEstado(detalle.id, nuevoEstado, this.motivoCambioEstado.trim()).subscribe({
      next: (r) => {
        this.cambiandoEstado.set(false);
        if (r.success && this.detalle()) {
          this.aplicarEstadoActualizado(detalle.id, nuevoEstado);
          this.modalCambiarEstadoVisible.set(false);
          this.estadoNuevoPendiente.set('');
          this.toggleBodyModalClass(false);
          this.cargarHistorialEstado();
          this.recargarAhora();
        } else {
          this.errorCambioEstado.set(r.message ?? 'No se pudo cambiar el estado.');
        }
      },
      error: (e) => {
        this.cambiandoEstado.set(false);
        this.errorCambioEstado.set(e.error?.message ?? 'Error al cambiar el estado.');
      }
    });
  }

  /** Carga el historial de cambios de estado del caso (motivo, autor, fecha). */
  cargarHistorialEstado(): void {
    const detalle = this.detalle();
    if (!detalle) return;
    this.eventoSvc.getEstadoHistorial(detalle.id).subscribe({
      next: h  => { this.estadoHistorial.set(h); },
      error: () => { this.estadoHistorial.set([]); }
    });
  }

  /**
   * Reabre un evento cerrado — lo devuelve a Seguimiento ('T') con motivo
   * obligatorio, reusando el mismo flujo de cambio de estado con auditoría.
   */
  reabrirEvento(): void {
    if (!this.detalle() || this.detalle()!.estado !== 'C') return;
    this.abrirModalCambiarEstado('T');
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
    const detalle = this.detalle();
    if (detalle && detalle.id === pedidoId) this.detalle.set({ ...detalle, estado: nuevoEstado });
    this.eventos.update(list => list.map(ev => ev.id === pedidoId ? { ...ev, estado: nuevoEstado } : ev));
  }

  getEstadoLabel(estado: string): string {
    return this.ESTADOS.find(e => e.valor === estado)?.label ?? estado;
  }

  getEstadoClase(estado: string): string {
    return this.ESTADOS.find(e => e.valor === estado)?.clase ?? '';
  }

  // ─── Duplicados / contexto histórico de dirección ────────────────────────────

  /**
   * Busca casos posiblemente duplicados o con historial reciente en la misma
   * zona geográfica — no bloquea nada, es solo contexto para el despachador.
   */
  cargarDuplicados(): void {
    this.duplicados.set([]);
    const detalle = this.detalle();
    if (!detalle?.latitudCaso || !detalle?.longitudCaso) return;
    const lat = parseFloat(detalle.latitudCaso);
    const lng = parseFloat(detalle.longitudCaso);
    if (!isFinite(lat) || !isFinite(lng)) return;

    this.cargandoDuplicados.set(true);
    this.eventoSvc.getDuplicados(detalle.id, lat, lng).subscribe({
      next: r  => { this.cargandoDuplicados.set(false); this.duplicados.set(r); },
      error: () => { this.cargandoDuplicados.set(false); }
    });
  }

  descartarDuplicados(): void {
    this.duplicadosDescartados = true;
  }

  /** Vincula el caso abierto a otro caso (padre) — mismo incidente real, llamadas distintas. */
  vincularCaso(candidato: DtoPedidoCercano): void {
    const detalle = this.detalle();
    if (!detalle || this.vinculandoId()) return;
    this.vinculandoId.set(candidato.id);
    this.eventoSvc.vincular(detalle.id, candidato.sitioGraba, Number(candidato.id)).subscribe({
      next: r => {
        this.vinculandoId.set(null);
        if (r.success && this.detalle()) {
          this.detalle.update(d => d ? { ...d, pedidoPadreSitio: candidato.sitioGraba, pedidoPadreNum: Number(candidato.id) } : d);
          this.toast.success('Vinculación', 'Caso vinculado correctamente.');
        } else {
          this.toast.error('Vinculación', r.message ?? 'No se pudo vincular el caso.');
        }
      },
      error: e => {
        this.vinculandoId.set(null);
        this.toast.error('Vinculación', e.error?.message ?? 'Error al vincular el caso.');
      }
    });
  }

  desvincularCaso(): void {
    const detalle = this.detalle();
    if (!detalle || this.vinculandoId()) return;
    this.vinculandoId.set(detalle.id);
    this.eventoSvc.desvincular(detalle.id).subscribe({
      next: r => {
        this.vinculandoId.set(null);
        if (r.success && this.detalle()) {
          this.detalle.update(d => d ? { ...d, pedidoPadreSitio: null, pedidoPadreNum: null } : d);
        }
      },
      error: () => { this.vinculandoId.set(null); }
    });
  }

  // ─── Presencia — quién más está viendo este caso ─────────────────────────────

  private iniciarPollingPresencia(eventoId: string): void {
    this.detenerPollingPresencia();
    this.presenciaSub = interval(30_000)
      .pipe(startWith(0), switchMap(() => this.eventoSvc.getPresencia(eventoId)))
      .subscribe({
        next: usuarios => { this.presenciaUsuarios.set(usuarios); },
        error: () => { /* no crítico */ }
      });
  }

  private detenerPollingPresencia(): void {
    if (this.presenciaSub) {
      this.presenciaSub.unsubscribe();
      this.presenciaSub = null;
    }
    this.presenciaUsuarios.set([]);
  }

  // ─── Apoyo urgente (seguridad del funcionario) ───────────────────────────────

  solicitarApoyo(act: DtoActuacionListItem): void {
    if (this.solicitandoApoyoId()) return;
    this.solicitandoApoyoId.set(act.id);
    this.actuacionSvc.solicitarApoyo(act.id).subscribe({
      next: r => {
        this.solicitandoApoyoId.set(null);
        if (r.success) { this.recargarActuaciones(); }
        else { this.toast.error('Apoyo', r.message ?? 'No se pudo registrar la solicitud de apoyo.'); }
      },
      error: e => {
        this.solicitandoApoyoId.set(null);
        this.toast.error('Apoyo', e.error?.message ?? 'Error al solicitar apoyo.');
      }
    });
  }

  atenderApoyo(act: DtoActuacionListItem): void {
    if (this.solicitandoApoyoId()) return;
    this.solicitandoApoyoId.set(act.id);
    this.actuacionSvc.atenderApoyo(act.id).subscribe({
      next: r => {
        this.solicitandoApoyoId.set(null);
        if (r.success) { this.recargarActuaciones(); }
      },
      error: () => { this.solicitandoApoyoId.set(null); }
    });
  }

  /** Formatea segundos como mm:ss para la duración de una grabación de videollamada. */
  formatDuracion(segundos: number): string {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** Minutos transcurridos desde que el recurso entró en su estado actual — para el timer visual. */
  minutosEnEstadoActual(act: DtoActuacionListItem): number {
    const ref = act.estado === 'A' ? act.fechaLlegada
              : act.estado === 'D' ? act.fechaDespacho
              : act.fechaCreacion;
    if (!ref) return 0;
    const ms = Date.now() - new Date(ref).getTime();
    return ms > 0 ? Math.floor(ms / 60000) : 0;
  }

  // ─── Videollamada con el ciudadano (WebRTC P2P, sin SFU) ─────────────────────

  private resetVideollamada(): void {
    if (this.videollamadaEstado() !== 'inactiva') this.videoSvc.colgar();
    this.videollamadaLink.set('');
    this.videollamadaMensaje.set('');
    this.grabandoVideollamada = false;
    this.videoSesionId        = '';
    this.videollamadaChatAbierto = false;
    this.videollamadaChatTexto   = '';
    this.videollamadaUbicacion.set(null);
    this.limpiarUbicacionCiudadanoEnMapa();
  }

  /**
   * Dibuja/actualiza la posición en vivo del ciudadano y su recorrido (hilo)
   * sobre el MISMO mapa de "Recursos y ubicación en tiempo real" (mapaDetalle)
   * — no un mapa aparte — para que el despachador vea en un solo lugar el
   * incidente, las patrullas y al ciudadano. Si el mapa aún no existe (el
   * panel nunca se ha renderizado) se descarta el punto — se retoma con la
   * próxima actualización una vez el mapa exista.
   */
  private actualizarUbicacionCiudadanoEnMapa(u: UbicacionCiudadano): void {
    this.ciudadanoHistorial.push([u.lat, u.lng]);
    if (this.ciudadanoHistorial.length > 500) this.ciudadanoHistorial.shift();

    if (!this.mapaDetalle) return;

    if (!this.ciudadanoMarker) {
      this.ciudadanoMarker = L.circleMarker([u.lat, u.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1
      }).addTo(this.mapaDetalle).bindPopup('<b>Ciudadano</b><br>Ubicación en vivo (videollamada)');
      this.ciudadanoTrail = L.polyline(this.ciudadanoHistorial, {
        color: '#2563eb', weight: 3, opacity: 0.55, dashArray: '4 6'
      }).addTo(this.mapaDetalle);
    } else {
      this.ciudadanoMarker.setLatLng([u.lat, u.lng]);
      this.ciudadanoTrail.setLatLngs(this.ciudadanoHistorial);
    }
  }

  /**
   * true mientras hay una llamada realmente en curso (cualquier estado salvo
   * inactiva/finalizada) y el caso no está cerrado — controla si el panel de
   * videollamada ocupa su propia columna, o si en su lugar el mapa/recursos
   * se expanden a todo el ancho (ver .ev-live-grid en la plantilla) para no
   * dejar una columna en blanco cuando no hay llamada activa.
   */
  llamadaEnCurso(detalle: DtoPedidoDetalle): boolean {
    return detalle.estado !== 'C'
      && this.videollamadaEstado() !== 'inactiva'
      && this.videollamadaEstado() !== 'finalizada';
  }

  /** Centra el mapa en la última ubicación conocida del ciudadano — botón "Centrar" del panel de videollamada. */
  centrarEnCiudadano(): void {
    if (!this.mapaDetalle || !this.ciudadanoMarker) return;
    this.mapaDetalle.flyTo(this.ciudadanoMarker.getLatLng(), 16, { duration: 0.6 });
    this.ciudadanoMarker.openPopup();
  }

  private limpiarUbicacionCiudadanoEnMapa(): void {
    if (this.ciudadanoMarker) { try { this.ciudadanoMarker.remove(); } catch { /* mapa ya destruido */ } }
    if (this.ciudadanoTrail)  { try { this.ciudadanoTrail.remove(); }  catch { /* mapa ya destruido */ } }
    this.ciudadanoMarker    = null;
    this.ciudadanoTrail     = null;
    this.ciudadanoHistorial = [];
  }

  /** Crea la sesión, envía el link por SMS y abre la señalización a la espera del ciudadano. */
  iniciarVideollamada(): void {
    const detalle = this.detalle();
    if (!detalle || this.creandoVideollamada()) return;
    if (!this.videollamadaTelefono.trim()) {
      this.toast.warning('Videollamada', 'Ingrese el número de teléfono del ciudadano.');
      return;
    }
    this.creandoVideollamada.set(true);
    this.videoSvc.crearSesion(detalle.id, this.videollamadaTelefono.trim())
      .then(async (r) => {
        this.creandoVideollamada.set(false);
        if (!r.success) {
          this.toast.error('Videollamada', r.message || 'No se pudo crear la sesión.');
          return;
        }
        this.videoSesionId       = r.sesionId;
        this.videollamadaLink.set(`${window.location.origin}/video/${r.sessionToken}`);
        this.videollamadaMensaje.set(r.message);
        this.toast[r.smsEnviado ? 'success' : 'warning']('Videollamada', r.message);
        await this.videoSvc.iniciar(r.sesionId);
      })
      .catch((e) => {
        this.creandoVideollamada.set(false);
        this.toast.error('Videollamada', e?.error?.message ?? 'Error al crear la videollamada.');
      });
  }

  copiarLinkVideollamada(): void {
    const link = this.videollamadaLink();
    if (!link) return;
    navigator.clipboard?.writeText(link)
      .then(() => this.toast.success('Videollamada', 'Enlace copiado al portapapeles.'))
      .catch(() => {});
  }

  toggleGrabacionVideollamada(): void {
    if (this.grabandoVideollamada) {
      const detalle = this.detalle();
      if (!detalle) return;
      this.grabandoVideollamada = false;
      this.videoSvc.detenerYSubirGrabacion(detalle.id, detalle.sitioGraba)
        .then(() => this.toast.success('Videollamada', 'Grabación subida al caso.'))
        .catch(() => this.toast.error('Videollamada', 'No se pudo subir la grabación.'));
    } else {
      this.videoSvc.iniciarGrabacion();
      this.grabandoVideollamada = true;
    }
  }

  colgarVideollamada(): void {
    if (this.grabandoVideollamada) this.toggleGrabacionVideollamada();
    this.videoSvc.colgar();
    this.videollamadaLink.set('');
    this.videollamadaMensaje.set('');
    this.videollamadaChatAbierto = false;
    this.videollamadaChatTexto   = '';
    this.videollamadaUbicacion.set(null);
    this.limpiarUbicacionCiudadanoEnMapa();
  }

  /**
   * Silencia/reactiva el micrófono del despachador sin colgar la llamada —
   * útil cuando el ciudadano no puede recibir audio del CAD sin delatarse
   * ante un agresor, pero puede seguir comunicándose por el chat de texto.
   */
  toggleMicVideollamada(): void {
    this.videoSvc.toggleMicrofono();
  }

  toggleChatVideollamada(): void {
    this.videollamadaChatAbierto = !this.videollamadaChatAbierto;
  }

  enviarChatVideollamada(): void {
    const texto = this.videollamadaChatTexto.trim();
    if (!texto) return;
    this.videoSvc.enviarChat(texto);
    this.videollamadaChatTexto = '';
  }

  setAnotacionTitulo(titulo: string): void {
    this.nuevaAnotacion.update(a => ({ ...a, titulo }));
  }

  setAnotacionTexto(anotacion: string): void {
    this.nuevaAnotacion.update(a => ({ ...a, anotacion }));
  }

  // ─── Plantillas rápidas de anotaciones ───────────────────────────────────────

  aplicarPlantillaAnotacion(texto: string): void {
    this.nuevaAnotacion.update(a => ({
      ...a,
      anotacion: a.anotacion ? `${a.anotacion} ${texto}` : texto
    }));
  }

  // ─── Búsqueda backend ─────────────────────────────────────────────────────────

  onFiltroTextoChange(): void {
    this.busquedaSubj.next(this.filtroTexto);
  }

  // ─── Alerta sonora ─────────────────────────────────────────────────────────────

  toggleSonido(): void {
    this.sonidoActivo = !this.sonidoActivo;
    localStorage.setItem(this.SONIDO_KEY, this.sonidoActivo ? '1' : '0');
  }

  /** Beep corto vía Web Audio — no requiere ningún archivo de audio externo. */
  private reproducirAlertaSonora(): void {
    if (!this.sonidoActivo) return;
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') return;   // política de autoplay del navegador — requiere interacción previa
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch { /* silencioso — la alerta visual sigue funcionando */ }
  }

  // ─── Banner de escalamiento SLA ───────────────────────────────────────────────

  /** Eventos activos, sin ningún recurso asignado, que superaron el umbral crítico de gestión. */
  get eventosEscalados(): DtoEventoListItem[] {
    const umbral = this.slaUmbralCritico;
    return this.eventos().filter(ev => {
      if (ev.estado === 'C') return false;
      if (ev.totalActuacionesActivas > 0) return false;
      if (!ev.fechaPrimerAcceso) return false;
      const minutos = (Date.now() - new Date(ev.fechaPrimerAcceso).getTime()) / 60000;
      return minutos >= umbral;
    });
  }

  // ─── Atajos de teclado ─────────────────────────────────────────────────────────

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement;
    const enCampo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
    if (enCampo) return;

    if (ev.key === 'Escape' && this.panelMode === 'detail') {
      this.volverLista();
      return;
    }
    if (this.panelMode === 'list') {
      if (ev.key === '/') {
        ev.preventDefault();
        document.getElementById('ev-filtro-texto')?.focus();
      } else if (ev.key === 'r' || ev.key === 'R') {
        this.recargarAhora();
      }
    }
  }

  // ─── Annotation ──────────────────────────────────────────────────────────────

  guardarAnotacion(): void {
    const detalle = this.detalle();
    const nuevaAnotacion = this.nuevaAnotacion();
    if (!detalle || !nuevaAnotacion.anotacion.trim()) return;
    this.guardandoAnotacion.set(true);
    this.mensajeAnotacion.set('');

    // Componer título enriquecido para anotaciones OPERATIVA
    let titulo = nuevaAnotacion.titulo;
    if (nuevaAnotacion.tipoAnotacion === 'OPERATIVA' && this.anotActividadCodigo()) {
      const parts: string[] = [this.anotActividadDesc() || this.anotActividadCodigo()];
      if (this.anotDelitoArticulo())
        parts.push(`${this.anotDelitoArticulo()}: ${this.anotDelitoDesc() || ''}`);
      titulo = titulo
        ? `${parts.join(' | ')} — ${titulo}`
        : parts.join(' | ');
    }

    const req: DtoAnotacionRequest = { ...nuevaAnotacion, titulo };

    this.eventoSvc.createAnotacion(detalle.id, req).subscribe({
      next: (r) => {
        this.guardandoAnotacion.set(false);
        if (r.success) {
          this.mensajeAnotacion.set('✔ Anotación registrada.');
          this.aplicarEstadoActualizado(detalle.id, r.estadoActual);
          this.nuevaAnotacion.set({ titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' });
          // Resetear sub-campos OPERATIVA
          this.anotActividadCodigo.set('');
          this.anotActividadDesc.set('');
          this.anotRequiereDelito.set(false);
          this.anotDelitoArticulo.set('');
          this.anotDelitoDesc.set('');
          // Reload annotations
          this.eventoSvc.getAnotaciones(detalle.id).subscribe(anots => {
            this.detalle.update(d => d ? { ...d, anotaciones: anots } : d);
          });
        } else {
          this.mensajeAnotacion.set(r.message || 'Error al guardar.');
        }
      },
      error: () => {
        this.guardandoAnotacion.set(false);
        this.mensajeAnotacion.set('Error al guardar la anotación.');
      }
    });
  }

  /** Al cambiar el tipo de anotación, resetear sub-campos OPERATIVA */
  onTipoAnotacionChange(tipo: string): void {
    this.nuevaAnotacion.update(a => ({ ...a, tipoAnotacion: tipo }));
    this.anotActividadCodigo.set('');
    this.anotActividadDesc.set('');
    this.anotRequiereDelito.set(false);
    this.anotDelitoArticulo.set('');
    this.anotDelitoDesc.set('');
    // Pre-cargar actividades si tipo OPERATIVA y no cargadas aún
    if (this.nuevaAnotacion().tipoAnotacion === 'OPERATIVA' && !this.actividadesPoliciales().length) {
      this.actuacionSvc.getActividadesPoliciales().subscribe({
        next: r => { this.actividadesPoliciales.set(r.data ?? []); },
        error: () => {}
      });
    }
  }

  /** Al cambiar actividad en el formulario de anotación */
  onAnotActividadChange(event: Event): void {
    const codigo = (event.target as HTMLSelectElement).value;
    const act = this.actividadesPoliciales().find(a => a.codigo === codigo);
    this.anotActividadCodigo.set(act?.codigo ?? '');
    this.anotActividadDesc.set(act?.descripcion ?? '');
    this.anotRequiereDelito.set(act?.requiereDelito ?? false);
    if (!this.anotRequiereDelito()) {
      this.anotDelitoArticulo.set('');
      this.anotDelitoDesc.set('');
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
    this.eventoSugerencias.set([]);
    this.mostrarSugerenciasEvento.set(false);
    this.cierreConfirmado        = false;
    this.modalCerrarVisible.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarCierre(): void {
    this.modalCerrarVisible.set(false);
    this.toggleBodyModalClass(false);
  }

  // ── Multi-código: Cerrar Evento ────────────────────────────────────────────

  onEventoCodInput(valor: string): void {
    this.eventoCodBusqueda = valor;
    this.eventoCodSubj.next(valor);
    this.mostrarSugerenciasEvento.set(true);
  }

  seleccionarEventoCod(item: DtoCodigoCasoItem): void {
    if (!this.eventoCodsSelec.some(c => c.codigo === item.codigo)) {
      this.eventoCodsSelec.push({ codigo: item.codigo, descripcion: item.descripcion });
    }
    this.eventoCodBusqueda       = '';
    this.eventoSugerencias.set([]);
    this.mostrarSugerenciasEvento.set(false);
  }

  agregarEventoCodManual(): void {
    const cod = this.eventoCodBusqueda.trim().toUpperCase();
    if (!cod) return;
    if (!this.eventoCodsSelec.some(c => c.codigo === cod)) {
      this.eventoCodsSelec.push({ codigo: cod, descripcion: '' });
    }
    this.eventoCodBusqueda       = '';
    this.eventoSugerencias.set([]);
    this.mostrarSugerenciasEvento.set(false);
  }

  quitarEventoCod(idx: number): void {
    this.eventoCodsSelec.splice(idx, 1);
  }

  cerrarSugerenciasEvento(): void {
    setTimeout(() => { this.mostrarSugerenciasEvento.set(false); }, 200);
  }

  confirmarCierre(): void {
    const detalle = this.detalle();
    if (!detalle || this.cerrandoEvento()) return;
    if (!this.cierreConfirmado) return;   // confirmación reforzada — acción sin deshacer

    this.cerrandoEvento.set(true);
    this.eventoSvc.cerrar(detalle.id, {
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
        this.cerrandoEvento.set(false);
        this.modalCerrarVisible.set(false);
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
        this.cerrandoEvento.set(false);
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
    return this.idsRecienLlegados().has(ev.id);
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
    void this.tick();   // reactive dependency — re-evaluated each tick

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

  /** true si el evento abierto tiene prioridad alta — usado para la sugerencia de recurso. */
  get prioridadAltaActual(): boolean {
    const p = this.detalle()?.prioridad?.toUpperCase();
    return p === 'FLASH' || p === 'INMEDIATA';
  }

  /** ETA estimado (min) — cálculo local a partir de la distancia y el tipo de medio. */
  etaMin(distanciaKm: number | undefined | null, tipoMedio: number): number | null {
    return this.turnosSvc.estimarEtaMin(distanciaKm, tipoMedio as any);
  }

  /**
   * Nombre de la patrulla que ve el operador — el identificador oficial del
   * cuadrante (patrullaDesc, p.ej. "EMEBOGC03E08C13027"), NO el código interno
   * (patrullaCodigo, p.ej. "8254"), que no le interesa al despachador.
   */
  nombrePatrulla(r: { patrullaDesc?: string; patrullaCodigo?: string }): string {
    return (r.patrullaDesc && r.patrullaDesc.trim()) ? r.patrullaDesc : (r.patrullaCodigo ?? '');
  }

  /**
   * Número corto de cuadrante para la etiqueta del marcador en el mapa —
   * los últimos 2 caracteres del nombre (EMEBOGC03E08C13027 → "27").
   */
  numeroCuadrante(r: { patrullaDesc?: string; patrullaCodigo?: string }): string {
    const nombre = this.nombrePatrulla(r);
    return nombre.length >= 2 ? nombre.slice(-2) : nombre;
  }

  /**
   * Nombre del cuadrante para una actuación del timeline de despacho —
   * usa unidadDesc (patrulla_desc) y cae al código solo si no hay nombre.
   */
  nombreUnidad(act: { unidadDesc?: string; unidadAsignada?: string }): string {
    return (act.unidadDesc && act.unidadDesc.trim()) ? act.unidadDesc : (act.unidadAsignada ?? '—');
  }

  // ─── Recursos en turno ───────────────────────────────────────────────────────

  /**
   * Inicia polling de recursos cada 8 s para el canal activo.
   *
   * Este mismo tick dispara la sincronización de GPS con GESPO (bajo demanda,
   * sin ningún proceso de fondo permanente en el backend) — solo corre
   * mientras el operador tiene un canal seleccionado en Eventos, y se detiene
   * solo en cuanto sale (detenerPollingRecursos cancela la suscripción). Se
   * pide únicamente el GPS de las patrullas de ESTE canal/fuerza, no las de
   * toda la fuerza — Turnos no dispara esta sincronización en absoluto.
   */
  private iniciarPollingRecursos(): void {
    this.detenerPollingRecursos();
    if (this.canalSeleccionado <= 0) return;

    this.recursosSub = interval(8_000)
      .pipe(startWith(0), switchMap(() => {
        this.cargandoRecursos.set(true);
        this.turnosSvc.sincronizarGps(this.canalSeleccionado, this.fuerzaId || undefined)
          .subscribe({ error: () => { /* silencioso — no es crítico para la UI */ } });
        return this.turnosSvc.getResumenRecursosCanal(
          this.canalSeleccionado, this.sitioGraba || 1, this.fuerzaId || undefined
        );
      }))
      .subscribe({
        next: (data) => {
          this.cargandoRecursos.set(false);
          this.errorRecursos.set('');
          this.ultimaActRecursos.set(new Date());
          // Calcular distancias al incidente (Haversine)
          const detalle = this.detalle();
          if (detalle?.latitudCaso && detalle?.longitudCaso) {
            const lat0 = parseFloat(detalle.latitudCaso);
            const lng0 = parseFloat(detalle.longitudCaso);
            data.forEach(r => {
              r.distanciaKm = (r.lat != null && r.lng != null)
                ? this.haversineKm(lat0, lng0, r.lat, r.lng) : undefined;
            });
            // Ordenar SOLO por distancia — la posición de cada patrulla es estable
            // aunque cambie de estado (al asignarla no debe saltar al final).
            data.sort((a, b) => (a.distanciaKm ?? 9999) - (b.distanciaKm ?? 9999));
          }
          this.recursos.set(data);
          this.actualizarSugerenciasLlegada();
          this.actualizarMarcadoresRecursos();
        },
        error: () => {
          this.cargandoRecursos.set(false);
          this.errorRecursos.set('Error al obtener recursos.');
        }
      });
  }

  private detenerPollingRecursos(): void {
    if (this.recursosSub) {
      this.recursosSub.unsubscribe();
      this.recursosSub = null;
    }
    this.recursos.set([]);
  }

  // ─── Flujo de despacho 4 pasos ────────────────────────────────────────────────

  /**
   * PASO 1 — Asignar recurso al incidente.
   * Crea la actuación en estado P y vincula el medio al evento.
   * El medio queda asignado pero no cambia su estado operativo todavía.
   */
  asignarRecursoAlEvento(r: DtoMedioDisponibleResumen): void {
    const detalle = this.detalle();
    if (!detalle || this.asignandoMedioId()) return;
    this.asignandoMedioId.set(r.id);
    this.errorAsignacion.set('');

    const req: DtoCrearActuacionRequest = {
      eventoId:       detalle.id,
      sitioGraba:     this.sitioGraba,
      fuerzaId:       this.fuerzaId || undefined,
      canalCodigo:    this.canalSeleccionado || undefined,
      unidadAsignada: r.patrullaCodigo,
      medioId:        r.id          // string — preserves Snowflake 64-bit precision
    };
    this.actuacionSvc.crearActuacion(req).subscribe({
      next: (res) => {
        this.asignandoMedioId.set(null);
        if (res.success) {
          this.errorAsignacion.set('');
          this.aplicarEstadoActualizado(detalle.id, res.estadoEventoActual);
          this.recargarActuaciones();
          this.recargarRecursos();   // refleja inmediatamente el nuevo estado del medio
        } else {
          this.errorAsignacion.set(res.message ?? 'No se pudo asignar el recurso.');
        }
      },
      error: (e) => {
        this.asignandoMedioId.set(null);
        this.errorAsignacion.set(e.error?.message ?? 'Error al asignar el recurso.');
      }
    });
  }

  // ─── Sugerencia de cuadrante más cercano (PostGIS) ───────────────────────────

  /**
   * Consulta el top de medios Libres más cercanos al sitio del incidente
   * (búsqueda espacial indexada en el backend). Es solo una recomendación —
   * el despachador sigue eligiendo y confirmando la asignación a mano.
   */
  sugerirRecursoCercano(): void {
    const detalle = this.detalle();
    if (!detalle || this.canalSeleccionado <= 0) return;
    const lat = parseFloat(detalle.latitudCaso  || '');
    const lng = parseFloat(detalle.longitudCaso || '');
    if (!isFinite(lat) || !isFinite(lng)) {
      this.errorSugerencia.set('El incidente no tiene coordenadas registradas.');
      this.mostrarSugerencia.set(true);
      return;
    }

    this.mostrarSugerencia.set(true);
    this.cargandoSugerencia.set(true);
    this.errorSugerencia.set('');
    this.turnosSvc.getSugerenciaRecurso(
      this.canalSeleccionado, lat, lng, this.sitioGraba || 1, this.fuerzaId || undefined, 5,
      this.prioridadAltaActual
    ).subscribe({
      next: (data) => {
        this.sugerenciasRecurso.set(data);
        this.cargandoSugerencia.set(false);
        if (data.length === 0) this.errorSugerencia.set('No hay recursos libres con GPS reciente en este canal.');
      },
      error: () => {
        this.cargandoSugerencia.set(false);
        this.errorSugerencia.set('No se pudo obtener la sugerencia.');
      }
    });
  }

  /** Asigna un recurso sugerido — reusa el mismo flujo que asignar desde la tabla completa. */
  asignarSugerido(s: DtoRecursoCercano): void {
    const match = this.recursos().find(r => r.id === s.medioId);
    if (!match) {
      this.errorSugerencia.set('El recurso ya no está disponible — actualizando lista…');
      this.recargarRecursos();
      return;
    }
    this.mostrarSugerencia.set(false);
    this.asignarRecursoAlEvento(match);
  }

  // ─── Desasignar (solo estado P) ──────────────────────────────────────────────

  abrirModalDesasignar(act: DtoActuacionListItem): void {
    this.actuacionADesasignar.set(act);
    this.desasignarMotivo      = '';
    this.errorDesasignar.set('');
    this.desasignando.set(false);
    this.modalDesasignarVisible.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarDesasignar(): void {
    this.modalDesasignarVisible.set(false);
    this.actuacionADesasignar.set(null);
    this.toggleBodyModalClass(false);
  }

  confirmarDesasignar(): void {
    const actuacion = this.actuacionADesasignar();
    if (!actuacion || this.desasignando()) return;
    // En P el motivo es opcional (el backend lo rellena); en D/A (recurso ya en
    // ruta o en sitio) es OBLIGATORIO — no se sustituye por un texto genérico
    // acá, para que el operador realmente explique por qué cancela un recurso
    // que ya está actuando.
    if (actuacion.estado !== 'P' && !this.desasignarMotivo.trim()) {
      this.errorDesasignar.set('Indique el motivo para cancelar un recurso que ya salió en ruta o está en sitio.');
      return;
    }
    this.desasignando.set(true);
    this.errorDesasignar.set('');

    this.actuacionSvc.desasignarActuacion(
      actuacion.id,
      this.desasignarMotivo.trim() || undefined
    ).subscribe({
      next: (res) => {
        this.desasignando.set(false);
        if (res.success) {
          this.modalDesasignarVisible.set(false);
          this.actuacionADesasignar.set(null);
          this.toggleBodyModalClass(false);
          this.recargarActuaciones();
          this.recargarRecursos();   // medio vuelve a estado Libre (27)
        } else {
          this.errorDesasignar.set(res.message ?? 'No se pudo desasignar.');
        }
      },
      error: (e) => {
        this.desasignando.set(false);
        this.errorDesasignar.set(e.error?.message ?? 'Error al desasignar el recurso.');
      }
    });
  }

  // ─── Novedad operativa ────────────────────────────────────────────────────────

  abrirModalNovedad(act: DtoActuacionListItem): void {
    this.actuacionNovedad.set(act);
    this.novedadTexto         = '';
    this.novedadTipo          = 'NOVEDAD';
    this.errorNovedad.set('');
    this.guardandoNovedad.set(false);
    this.modalNovedadVisible.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarNovedad(): void {
    this.modalNovedadVisible.set(false);
    this.actuacionNovedad.set(null);
    this.toggleBodyModalClass(false);
  }

  confirmarNovedad(): void {
    const actuacion = this.actuacionNovedad();
    if (!actuacion || this.guardandoNovedad()) return;
    if (!this.novedadTexto.trim()) {
      this.errorNovedad.set('Ingrese el texto de la novedad.');
      return;
    }
    this.guardandoNovedad.set(true);
    this.errorNovedad.set('');

    this.actuacionSvc.agregarNota(actuacion.id, {
      nota:     this.novedadTexto.trim(),
      tipoNota: this.novedadTipo
    }).subscribe({
      next: (res) => {
        this.guardandoNovedad.set(false);
        if (res.success) {
          this.modalNovedadVisible.set(false);
          this.actuacionNovedad.set(null);
          this.toggleBodyModalClass(false);
          // Actualizar conteo de notas en la lista sin recargar todo
          this.recargarActuaciones();
        } else {
          this.errorNovedad.set(res.message ?? 'No se pudo registrar la novedad.');
        }
      },
      error: (e) => {
        this.guardandoNovedad.set(false);
        this.errorNovedad.set(e.error?.message ?? 'Error al registrar la novedad.');
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
   * Auto-sugerencia "En sitio" por proximidad GPS: si el medio asignado a una
   * actuación 'D' (en ruta) ya está a menos de 100 m del incidente, se ofrece
   * un botón de confirmación rápida en vez de esperar a que el operador lo
   * marque manualmente. Nunca cambia el estado solo — siempre requiere el
   * clic explícito del despachador.
   */
  private actualizarSugerenciasLlegada(): void {
    const detalle = this.detalle();
    if (!detalle?.latitudCaso || !detalle?.longitudCaso) return;
    const lat0 = parseFloat(detalle.latitudCaso);
    const lng0 = parseFloat(detalle.longitudCaso);
    if (!isFinite(lat0) || !isFinite(lng0)) return;

    const nuevas = new Set<string>();
    const recursos = this.recursos();
    for (const act of this.actuaciones()) {
      if (act.estado !== 'D' || !act.unidadAsignada) continue;
      const recurso = recursos.find(r => r.patrullaCodigo === act.unidadAsignada);
      if (recurso?.lat == null || recurso?.lng == null) continue;
      const distKm = this.haversineKm(lat0, lng0, recurso.lat, recurso.lng);
      if (distKm <= 0.1) nuevas.add(act.id);
    }
    this.sugerenciasLlegada.set(nuevas);
  }

  sugiereLlegada(act: DtoActuacionListItem): boolean {
    return this.sugerenciasLlegada().has(act.id);
  }

  /**
   * PASO 2 — Marcar inicio de ruta (En camino).
   * Actuación P → D · registra fecha_despacho · medio → 30 (En ruta).
   */
  marcarEnRuta(act: DtoActuacionListItem): void {
    if (this.operandoActuacionId()) return;
    this.operandoActuacionId.set(act.id);
    this.actuacionSvc.actualizarEstado(act.id, { estado: 'D' }).subscribe({
      next: () => {
        this.operandoActuacionId.set(null);
        this.recargarActuaciones();
        this.recargarRecursos();   // refleja medio → En ruta (30)
      },
      error: (e) => {
        this.operandoActuacionId.set(null);
        this.toast.error('Actuación', e.error?.message ?? 'No se pudo actualizar el recurso.');
      }
    });
  }

  /**
   * PASO 3 — Marcar llegada al lugar del incidente (En sitio).
   * Actuación D → A · registra fecha_llegada · medio → 28 (Ocupado/Atendiendo).
   */
  marcarEnSitio(act: DtoActuacionListItem): void {
    if (this.operandoActuacionId()) return;
    this.operandoActuacionId.set(act.id);
    this.actuacionSvc.actualizarEstado(act.id, { estado: 'A' }).subscribe({
      next: () => {
        this.operandoActuacionId.set(null);
        this.recargarActuaciones();
        this.recargarRecursos();   // refleja medio → En sitio (28)
      },
      error: (e) => {
        this.operandoActuacionId.set(null);
        this.toast.error('Actuación', e.error?.message ?? 'No se pudo actualizar el recurso.');
      }
    });
  }

  /**
   * PASO 4 — Abrir modal para marcar atención completada y cerrar la actuación.
   * Carga el catálogo de actividades policiales si no se ha cargado aún.
   */
  abrirCierreActuacion(act: DtoActuacionListItem): void {
    this.actuacionACerrar.set(act);
    this.cerrandoActuacion.set(false);
    this.errorCierreActuacion.set('');
    // Multi-código
    this.cierreCodBusqueda         = '';
    this.cierreSugerencias.set([]);
    this.cierreCodsSeleccionados   = [];
    this.mostrarSugerenciasCierre.set(false);
    // Actividad policial
    this.cierreClasifActividad     = '';
    this.cierreActividadSelec      = null;
    this.actividadesFiltered       = [];
    // Delito
    this.cierreDelitoBusqueda      = '';
    this.cierreDelitoSugs.set([]);
    this.cierreDelitoSelec         = null;
    this.mostrarSugerenciasDelito.set(false);
    // Observación y decisión evento
    this.cierreObservacion         = '';
    this.cerrarEventoAlAtender     = null;

    // Cargar catálogo de actividades (se cachea en memoria para la sesión)
    if (!this.actividadesPoliciales().length) {
      this.actuacionSvc.getActividadesPoliciales().subscribe({
        next: r => { this.actividadesPoliciales.set(r.data ?? []); },
        error: () => {}
      });
    }

    this.modalCierreActuacion.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarCierreActuacion(): void {
    this.modalCierreActuacion.set(false);
    this.actuacionACerrar.set(null);
    this.toggleBodyModalClass(false);
  }

  // ── Multi-código: modal Atendió ────────────────────────────────────────────

  onCierreCodInput(valor: string): void {
    this.cierreCodBusqueda = valor;
    this.cierreCodSubj.next(valor);
    this.mostrarSugerenciasCierre.set(true);
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
    this.cierreSugerencias.set([]);
    this.mostrarSugerenciasCierre.set(false);
  }

  agregarCierreCodManual(): void {
    const cod = this.cierreCodBusqueda.trim().toUpperCase();
    if (!cod) return;
    if (!this.cierreCodsSeleccionados.some(c => c.codigoCierre === cod)) {
      const orden = this.cierreCodsSeleccionados.length + 1;
      this.cierreCodsSeleccionados.push({ orden, codigoCierre: cod, tipoCodigo: 'CIERRE' });
    }
    this.cierreCodBusqueda        = '';
    this.cierreSugerencias.set([]);
    this.mostrarSugerenciasCierre.set(false);
  }

  quitarCierreCod(idx: number): void {
    this.cierreCodsSeleccionados.splice(idx, 1);
    // Renumerar
    this.cierreCodsSeleccionados.forEach((c, i) => c.orden = i + 1);
  }

  cerrarSugerenciasCierre(): void {
    setTimeout(() => { this.mostrarSugerenciasCierre.set(false); }, 200);
  }

  // ── Clasificación de actividad ────────────────────────────────────────────

  onClasifActividadChange(tipo: 'O' | 'P' | ''): void {
    this.cierreClasifActividad = tipo;
    this.cierreActividadSelec  = null;
    this.cierreDelitoSelec     = null;
    this.cierreDelitoBusqueda  = '';
    this.actividadesFiltered   = tipo
      ? this.actividadesPoliciales().filter(a => a.tipo === tipo)
      : [];
  }

  onActividadChange(codigo: string): void {
    this.cierreActividadSelec = this.actividadesFiltered.find(a => a.codigo === codigo) ?? null;
    this.cierreDelitoSelec    = null;
    this.cierreDelitoBusqueda = '';
    this.cierreDelitoSugs.set([]);
  }

  // ── Delito autocomplete ────────────────────────────────────────────────────

  onCierreDelitoInput(valor: string): void {
    this.cierreDelitoBusqueda      = valor;
    this.cierreDelitoSubj.next(valor);
    this.mostrarSugerenciasDelito.set(true);
  }

  seleccionarCierreDelito(item: DtoDelitoItem): void {
    this.cierreDelitoSelec         = item;
    this.cierreDelitoBusqueda      = `${item.articulo} – ${item.descripcion}`;
    this.cierreDelitoSugs.set([]);
    this.mostrarSugerenciasDelito.set(false);
  }

  cerrarSugerenciasDelito(): void {
    setTimeout(() => { this.mostrarSugerenciasDelito.set(false); }, 200);
  }

  /**
   * Confirma el cierre de la actuación (Atendió).
   * Actuación A → C · registra fecha_cierre · medio → 27 (Libre).
   * Si cerrarEventoAlAtender = true, encadena el cierre del evento.
   */
  confirmarCierreActuacion(): void {
    const actuacion = this.actuacionACerrar();
    if (!actuacion || this.cerrandoActuacion()) return;
    if (!this.cierreCodsSeleccionados.length) {
      this.errorCierreActuacion.set('Agregue al menos un código de cierre.');
      return;
    }
    if (this.cerrarEventoAlAtender === null) {
      this.errorCierreActuacion.set('Indique si desea cerrar el evento al finalizar.');
      return;
    }

    this.cerrandoActuacion.set(true);
    this.errorCierreActuacion.set('');

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

    const actuacionId = actuacion.id;

    this.actuacionSvc.cerrarActuacion(actuacionId, req).subscribe({
      next: () => {
        this.cerrandoActuacion.set(false);
        this.modalCierreActuacion.set(false);
        this.actuacionACerrar.set(null);
        this.toggleBodyModalClass(false);

        const detalle = this.detalle();
        if (this.cerrarEventoAlAtender && detalle) {
          // Cerrar también el evento — solo datos de cierre van a cad_eventos;
          // cad_pedidos.comentario es inmutable y NO se toca aquí.
          // Nota: si esta era la última actuación abierta, el backend ya cerró
          // cad_eventos.estado automáticamente (fn_recalcular_estado_evento) antes
          // de que esta llamada llegue — esta petición sigue siendo necesaria
          // porque es la que persiste los códigos de cierre y la observación
          // (el recálculo automático solo cambia el estado, no esos datos).
          this.eventoSvc.cerrar(detalle.id, {
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
        this.cerrandoActuacion.set(false);
        this.errorCierreActuacion.set(e.error?.message ?? 'Error al cerrar la actuación.');
      }
    });
  }

  // ─── Polling de actuaciones ───────────────────────────────────────────────────

  private iniciarPollingActuaciones(eventoId: string): void {
    this.detenerPollingActuaciones();
    this.actuacionesSub = interval(8_000)
      .pipe(startWith(0), switchMap(() => {
        this.cargandoActuaciones.set(true);
        return this.actuacionSvc.getActuacionesEvento(eventoId);
      }))
      .subscribe({
        next: (r) => {
          this.actuaciones.set(r.data ?? []);
          this.cargandoActuaciones.set(false);
          this.errorActuaciones.set('');
        },
        error: () => {
          this.cargandoActuaciones.set(false);
          this.errorActuaciones.set('Error al cargar actuaciones.');
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
    const detalle = this.detalle();
    if (!detalle) return;
    this.actuacionSvc.getActuacionesEvento(detalle.id).subscribe({
      next: (r) => { this.actuaciones.set(r.data ?? []); },
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
        this.errorRecursos.set('');
        this.ultimaActRecursos.set(new Date());
        // Re-calcular distancias al incidente (Haversine)
        const detalle = this.detalle();
        if (detalle?.latitudCaso && detalle?.longitudCaso) {
          const lat0 = parseFloat(detalle.latitudCaso);
          const lng0 = parseFloat(detalle.longitudCaso);
          data.forEach(r => {
            r.distanciaKm = (r.lat != null && r.lng != null)
              ? this.haversineKm(lat0, lng0, r.lat, r.lng) : undefined;
          });
          // Ordenar SOLO por distancia — posición estable al cambiar de estado.
          data.sort((a, b) => (a.distanciaKm ?? 9999) - (b.distanciaKm ?? 9999));
        }
        this.recursos.set(data);
        this.actualizarMarcadoresRecursos();
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
    const detalle = this.detalle();
    if (!detalle || !r.eventoId) return false;
    return String(r.eventoId) === String(detalle.id);
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

  private escapeHtml(value: unknown): string {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private static readonly COLORES_ESTADO_RECURSO: Record<number, string> = {
    27: '#22c55e', 28: '#ef4444', 29: '#6b7280', 30: '#f59e0b', 31: '#3b82f6'
  };

  private iconoRecurso(r: DtoMedioDisponibleResumen): any {
    const color = EventosComponent.COLORES_ESTADO_RECURSO[r.estado] ?? '#94a3b8';
    return L.divIcon({
      className: '',
      html: `<div style="
        width:34px;height:34px;border-radius:50%;
        background:${color};border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;">
        <i class="${this.iconoTipo(r.tipoMedio)}" style="color:#fff;font-size:15px;"></i>
      </div>
      <div style="
        font-size:11px;font-weight:800;color:#fff;
        background:rgba(21,27,59,.78);padding:1px 7px;border-radius:5px;
        margin-top:3px;text-align:center;white-space:nowrap;
        box-shadow:0 1px 3px rgba(0,0,0,.4);">
        ${this.escapeHtml(this.numeroCuadrante(r))}
      </div>`,
      iconSize:   [34, 56],
      iconAnchor: [17, 17],
      popupAnchor:[0, -20]
    });
  }

  /** Contenido del popup del marcador — incluye asignación rápida desde el mapa. */
  private popupContentRecurso(r: DtoMedioDisponibleResumen): HTMLElement {
    const box = document.createElement('div');
    box.className = 'ev-map-popup';

    const titulo = document.createElement('div');
    titulo.className = 'ev-map-popup__title';
    titulo.textContent = this.nombrePatrulla(r);
    box.appendChild(titulo);

    const estado = document.createElement('div');
    estado.className = 'ev-map-popup__estado';
    estado.textContent = r.estadoDesc;
    box.appendChild(estado);

    const personal = document.createElement('div');
    personal.className = 'ev-map-popup__personal';
    personal.textContent = r.personalResumen || 'Sin personal asignado';
    box.appendChild(personal);

    if (r.distanciaKm != null) {
      const dist = document.createElement('div');
      dist.className = 'ev-map-popup__dist';
      dist.textContent = `${this.turnosSvc.formatearDistancia(r.distanciaKm)} al incidente`;
      box.appendChild(dist);
    }

    const puedeAsignar = r.estado === 27 && !r.eventoId && !this.medioAsignadoAEsteEvento(r)
                       && this.detalle()?.estado !== 'C';
    if (this.medioAsignadoAEsteEvento(r)) {
      const badge = document.createElement('div');
      badge.className = 'ev-map-popup__badge';
      badge.textContent = 'Asignado a este evento';
      box.appendChild(badge);
    } else if (puedeAsignar) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ev-map-popup__btn';
      btn.disabled = !!this.asignandoMedioId();
      btn.textContent = this.asignandoMedioId() === r.id ? 'Asignando…' : 'Asignar a este evento';
      btn.addEventListener('click', () => this.asignarRecursoAlEvento(r));
      box.appendChild(btn);
    } else if (r.eventoId) {
      const otro = document.createElement('div');
      otro.className = 'ev-map-popup__badge ev-map-popup__badge--otro';
      otro.textContent = 'Vinculado a otro caso';
      box.appendChild(otro);
    }

    return box;
  }

  /** Actualiza los marcadores de recursos en el mapa del evento. */
  private actualizarMarcadoresRecursos(): void {
    if (!this.mapaDetalle) return;

    const recursosConGps = this.recursos().filter(r => r.lat != null && r.lng != null);
    const codigosVistos  = new Set<string>();

    recursosConGps.forEach(r => {
      const codigo = r.patrullaCodigo;
      codigosVistos.add(codigo);

      const existente = this.recursoMarkersPorCodigo.get(codigo);
      if (existente) {
        // Deslizar a la nueva posición en vez de saltar — el GPS se refresca
        // cada 10-15s, y este panel además hace polling cada 8s.
        existente.setIcon(this.iconoRecurso(r));
        existente.setPopupContent(this.popupContentRecurso(r));
        animateMarkerTo(existente, r.lat!, r.lng!, 2500);
        return;
      }

      const marker = L.marker([r.lat!, r.lng!], { icon: this.iconoRecurso(r) })
        .addTo(this.mapaDetalle)
        .bindPopup(this.popupContentRecurso(r));
      this.recursoMarkersPorCodigo.set(codigo, marker);
      this.recursoMarkers.push(marker);
    });

    for (const [codigo, marker] of this.recursoMarkersPorCodigo.entries()) {
      if (!codigosVistos.has(codigo)) {
        stopMarkerAnimation(marker);
        try { marker.remove(); } catch { /**/ }
        this.recursoMarkersPorCodigo.delete(codigo);
      }
    }
    this.recursoMarkers = Array.from(this.recursoMarkersPorCodigo.values());
  }

  /** Centra el mapa en la patrulla y abre su popup — usado desde la lista lateral. */
  centrarEnRecurso(r: DtoMedioDisponibleResumen): void {
    if (!this.mapaDetalle || r.lat == null || r.lng == null) return;
    this.mapaDetalle.flyTo([r.lat, r.lng], 16, { duration: 0.6 });
    this.recursoMarkersPorCodigo.get(r.patrullaCodigo)?.openPopup();
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
    const detalle = this.detalle();
    if (this.mapaInicializado || !detalle) return;
    const el = document.getElementById('mapaEvento');
    if (!el) return;

    const lat  = parseFloat(detalle.latitudCaso  || '0');
    const lng  = parseFloat(detalle.longitudCaso || '0');
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
          .bindPopup(`<b>${this.escapeHtml(detalle.direCaso)}</b>`)
          .openPopup();
      }

      this.mapaInicializado = true;
    } catch (e) {
      console.warn('[Eventos] Leaflet init error:', e);
    }
  }

  private destroyMapaDetalle(): void {
    // El marcador/recorrido del ciudadano son capas de este mismo mapa — al
    // destruirlo, sus referencias JS quedan apuntando a capas ya removidas.
    this.ciudadanoMarker = null;
    this.ciudadanoTrail  = null;
    if (this.mapaDetalle) {
      try { this.mapaDetalle.remove(); } catch { /* ignore */ }
      this.mapaDetalle     = null;
      this.mapaInicializado = false;
    }
    this.recursoMarkers.forEach(m => stopMarkerAnimation(m));
    this.recursoMarkers = [];
    this.recursoMarkersPorCodigo.clear();
  }

  // ─── §6.1 Modal Remitir a agencia ────────────────────────────────────────────

  abrirModalRemitir(): void {
    this.remitirCanalesSelec.clear();
    this.remitirAgenciasSelec.clear();
    this.remitirError.set('');
    this.remitirEnviando.set(false);
    this.remitirTab                 = 'secad';
    this.remitirMantenerCanalOrigen = true;
    this.remitirConfirmado          = false;

    // Cargar canales SECAD (agrupados por fuerza)
    this.recepcionSvc.getCanales(this.sitioGraba).subscribe({
      next: canales => {
        const mapa: Record<string, { fuerza: string; fuerzaId: number; canales: DtoCanalRecepcion[] }> = {};
        for (const c of (canales ?? [])) {
          const key = c.fuerza || 'SIN FUERZA';
          if (!mapa[key]) mapa[key] = { fuerza: key, fuerzaId: c.fuerzaId, canales: [] };
          mapa[key].canales.push(c);
        }
        this.remitirCanalesGrupos.set(Object.values(mapa).sort((a, b) =>
          a.fuerza.localeCompare(b.fuerza, 'es')));
      },
      error: () => { this.remitirCanalesGrupos.set([]); }
    });

    // Cargar agencias externas (con caché en memoria para la sesión)
    if (this.remitirAgencias().length === 0) {
      this.agenciaSvc.getActivas().subscribe({
        next:  data => { this.remitirAgencias.set(data ?? []); },
        error: ()   => { this.remitirAgencias.set([]); }
      });
    }

    this.modalRemitirVisible.set(true);
    this.toggleBodyModalClass(true);
  }

  cancelarRemitir(): void {
    this.modalRemitirVisible.set(false);
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
    const detalle = this.detalle();
    if (!detalle || this.remitirEnviando()) return;
    if (!this.remitirConfirmado) {
      this.remitirError.set('Confirma la remisión marcando la casilla antes de enviar.');
      return;
    }
    this.remitirEnviando.set(true);
    this.remitirError.set('');

    const pedidoId   = detalle.id;                      // cad_pedidos.id
    const sitioGraba = detalle.sitioGraba ?? this.sitioGraba;
    // numeEvento = cad_eventos.id  (≠ .id que es cad_pedidos.id — ver DtoEventoListItem)
    const eventoId   = this.eventoSeleccionado?.numeEvento
                    ?? detalle.numeEvento
                    ?? detalle.id;

    if (this.remitirTab === 'secad') {
      // ── Remisión a canales SECAD ────────────────────────────────────────────
      if (this.remitirCanalesSelec.size === 0) {
        this.remitirError.set('Selecciona al menos un canal.');
        this.remitirEnviando.set(false);
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
          this.remitirEnviando.set(false);
          if (r.success) {
            this.toast.success('Remisión SECAD', r.message);
            // Añadir anotación de trazabilidad
            const canalesNombres = [...this.remitirCanalesSelec]
              .map(key => {
                for (const g of this.remitirCanalesGrupos())
                  for (const c of g.canales)
                    if (this.canalKey(c) === key) return `${g.fuerza} – ${c.descripcion}`;
                return key;
              }).join(', ');
            const modoTexto = removerCanalOrigen
              ? ' (remisión exclusiva — removido de mi canal)'
              : ' (gestión conjunta — permanece también en mi canal)';
            this.eventoSvc.createAnotacion(detalle.id, {
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
            this.remitirError.set(r.message);
          }
        },
        error: () => {
          this.remitirEnviando.set(false);
          this.remitirError.set('Error de comunicación con el servidor.');
        }
      });

    } else {
      // ── Remisión a agencias externas por API ────────────────────────────────
      if (this.remitirAgenciasSelec.size === 0) {
        this.remitirError.set('Selecciona al menos una agencia.');
        this.remitirEnviando.set(false);
        return;
      }

      const promises = [...this.remitirAgenciasSelec].map(agenciaId =>
        this.agenciaSvc.despachar({ pedidoId, sitioGraba, agenciaId }).toPromise()
      );

      Promise.allSettled(promises).then(results => {
        this.remitirEnviando.set(false);
        const ok  = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
        const err = results.length - ok;

        if (ok > 0)
          this.toast.success('Remisión externa', `${ok} agencia(s) notificadas correctamente.`);
        if (err > 0)
          this.toast.warning('Remisión parcial',
            `${err} agencia(s) no pudieron ser contactadas.`);

        if (ok > 0) {
          this.eventoSvc.getAnotaciones(detalle.id).subscribe(a => {
            this.detalle.update(d => d ? { ...d, anotaciones: a } : d);
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
    if (this.asistenteAbierto && this.asistenteCategorias().length === 0) {
      this.cargarAsistenteCategorias();
    }
  }

  private cargarAsistenteCategorias(): void {
    this.asistenteLoadingCat.set(true);
    this.asistenteSvc.getCategorias(true).subscribe({
      next: (r) => {
        this.asistenteCategorias.set(r.data ?? []);
        this.asistenteLoadingCat.set(false);
      },
      error: () => { this.asistenteLoadingCat.set(false); }
    });
  }

  /** Se llama cuando el despachador cambia de categoría. */
  onAsistenteCategoriaChange(categoriaId: string): void {
    this.asistenteCategoriaSel = categoriaId;
    this.asistentePreguntas.set([]);
    if (!categoriaId) return;

    this.asistenteLoadingPreg.set(true);
    this.asistenteSvc.getPreguntas(categoriaId, true).subscribe({
      next: (r) => {
        this.asistentePreguntas.set(r.data ?? []);
        this.asistenteLoadingPreg.set(false);
      },
      error: () => { this.asistenteLoadingPreg.set(false); }
    });
  }

  /** Reinicia el estado del asistente (llamado en volverLista y abrirDetalle). */
  private resetAsistente(): void {
    this.asistenteAbierto      = false;
    this.asistenteCategorias.set([]);
    this.asistenteCategoriaSel = '';
    this.asistentePreguntas.set([]);
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
