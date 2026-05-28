import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { ToastService } from '../../../core/services/toast.service';
import {
  PedidoService,
  DtoPedidoListItem,
  DtoPedidoDetalle,
  DtoAnotacionRequest
} from '../../../core/services/operacion/pedido.service';
import {
  EventoService,
  DtoEventoListItem,
  DtoEventoConteos
} from '../../../core/services/operacion/evento.service';
import {
  ActuacionesService,
  DtoActuacionListItem
} from '../../../core/services/operacion/actuaciones.service';

type VistaCad    = 'dashboard' | 'incidentes' | 'kpis';
type SemaforoColor = 'semaforo-verde' | 'semaforo-amarillo' | 'semaforo-rojo';

// ─── Interfaces locales ───────────────────────────────────────────────────────

interface DashStat {
  total:      number;
  activos:    number;
  pendientes: number;
  cerrados:   number;
  flash:      number;
  inmediata:  number;
  rutina:     number;
  criticos:   number;
  porOrigen:  Record<string, number>;
}

interface TimelineItem {
  timestamp:     string | null;
  tipo:          'CREACION' | 'ANOTACION' | 'CIERRE' | 'SUPERVISION';
  titulo:        string;
  descripcion:   string;
  actor:         string;
  icono:         string;
  colorClass:    string;
  tipoAnotacion?: string;
}

interface KpiItem {
  label:     string;
  valor:     number | string;
  unidad:    string;
  meta:      number;
  cumple:    boolean;
  prioridad?: string;
  icon:      string;
}

interface OperadorStat {
  username:       string;
  total:          number;
  activos:        number;
  cerrados:       number;
  tiempoPromedio: number;
  criticos:       number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector:    'app-pedido',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './pedido.html',
  styleUrls:   ['./pedido.scss']
})
export class PedidoComponent implements OnInit, OnDestroy {

  // ── Vista ─────────────────────────────────────────────────────────────────
  vista: VistaCad = 'dashboard';

  // ── UI ────────────────────────────────────────────────────────────────────
  visible    = true;
  minimized  = false;
  loading    = false;
  tick       = 0;

  // ── Filtros ──────────────────────────────────────────────────────────────
  filtroEstado    = '';
  filtroTexto     = '';
  filtroPrioridad = '';

  // ── Datos ─────────────────────────────────────────────────────────────────
  listaPedidos:   DtoPedidoListItem[]               = [];
  /** Mapa de enriquecimiento: cad_pedidos.id → DtoEventoListItem.
   *  Provee prioridad, descPedido, numeEvento y usernameCreacion
   *  que el endpoint /Pedido no incluye en su listado. */
  eventoMap:      Record<string, DtoEventoListItem> = {};
  selectedId:     string | null                     = null;
  detalle:        DtoPedidoDetalle | null            = null;
  actuaciones:    DtoActuacionListItem[]             = [];
  loadingDetalle  = false;
  timeline:       TimelineItem[]                    = [];
  lastRefresh:    Date                              = new Date();

  // ── Dashboard ────────────────────────────────────────────────────────────
  stats:   DashStat             = this.emptyStats();
  conteos: DtoEventoConteos | null = null;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  kpis:       KpiItem[]      = [];
  operadores: OperadorStat[] = [];

  // ── Anotación supervisora ────────────────────────────────────────────────
  anotacionForm:  DtoAnotacionRequest = this.emptyAnotacion();
  savingAnotacion = false;
  showAnotForm    = false;

  private destroy$ = new Subject<void>();

  constructor(
    private readonly pedidoService:      PedidoService,
    private readonly eventoService:      EventoService,
    private readonly actuacionesService: ActuacionesService,
    private readonly toast:              ToastService
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargarLista();

    // Auto-refresh lista cada 30 s
    interval(30_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cargarLista(true));

    // Tick semáforo cada 60 s → recalcula stats y KPIs
    interval(60_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { this.tick++; this.computarStats(); this.computarKpis(); });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Carga de datos
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Carga TODOS los pedidos y, en paralelo, los eventos del módulo de despacho.
   * Los eventos enriquecen la lista con prioridad, origen, numeEvento y descPedido
   * que el endpoint /Pedido no devuelve en el listado.
   */
  cargarLista(silencioso = false): void {
    if (!silencioso) this.loading = true;

    forkJoin({
      pedidos: this.pedidoService.getList(),
      eventos: this.eventoService.getEventos()
        .pipe(catchError(() => of([] as DtoEventoListItem[]))),
      conteos: this.eventoService.getConteos()
        .pipe(catchError(() => of(null as DtoEventoConteos | null)))
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ pedidos, eventos, conteos }) => {
        // Turno vigente para el encabezado del dashboard
        this.conteos = conteos;

        // Construir mapa de enriquecimiento: pedido.id → eventoListItem
        this.eventoMap = {};
        for (const ev of (eventos ?? [])) {
          this.eventoMap[String(ev.id)] = ev;
        }

        this.listaPedidos = (pedidos ?? []).map(p => this.normalizarListItem(p as any));
        this.loading      = false;
        this.lastRefresh  = new Date();
        this.computarStats();
        this.computarKpis();
      },
      error: () => {
        this.loading = false;
        if (!silencioso) {
          this.toast.error('Seguimiento CAD', 'No se pudo cargar la lista de incidentes.');
        }
      }
    });
  }

  /**
   * Carga el detalle del incidente y, si tiene numeEvento, sus actuaciones
   * (despacho de recursos) en paralelo para construir el timeline completo.
   */
  seleccionarIncidente(item: DtoPedidoListItem): void {
    if (this.selectedId === item.id && this.detalle) return;
    this.selectedId     = item.id;
    this.loadingDetalle = true;
    this.detalle        = null;
    this.timeline       = [];
    this.actuaciones    = [];
    this.showAnotForm   = false;

    // El backend filtra cad_actuaciones por pedido_id (= cad_pedidos.id),
    // NO por evento_id (cad_eventos.id). Por eso se pasa item.id, no numeEvento.
    const numeEvento = item.numeEvento ?? null;

    forkJoin({
      detalle: this.pedidoService.getById(item.id),
      actsResp: this.actuacionesService.getActuacionesEvento(item.id)
          .pipe(catchError(() => of({ success: true, data: [] as DtoActuacionListItem[] })))
    }).subscribe({
      next: ({ detalle, actsResp }) => {
        this.detalle        = this.normalizarDetalle(detalle as any, item);
        this.actuaciones    = actsResp.data ?? [];
        this.loadingDetalle = false;
        this.buildTimeline(this.detalle, this.actuaciones);
        if (this.vista === 'dashboard') this.vista = 'incidentes';
      },
      error: () => {
        this.loadingDetalle = false;
        this.toast.error('Seguimiento CAD', 'No se pudo cargar el detalle del incidente.');
      }
    });
  }

  volverALista(): void {
    this.selectedId   = null;
    this.detalle      = null;
    this.timeline     = [];
    this.actuaciones  = [];
    this.showAnotForm = false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Timeline — Historia Clínica del Incidente
  // ──────────────────────────────────────────────────────────────────────────

  buildTimeline(d: DtoPedidoDetalle, actuaciones: DtoActuacionListItem[] = []): void {
    const items: TimelineItem[] = [];

    // ── 1. Evento de creación ─────────────────────────────────────────────
    const codiDesc1 = d.codiPedido
      ? `${d.codiPedido}${d.descPedido ? ' — ' + d.descPedido : ''}`
      : null;
    const codiDesc2 = d.codiPedido2
      ? `${d.codiPedido2}${d.descPedido2 ? ' — ' + d.descPedido2 : ''}`
      : null;

    items.push({
      timestamp:   d.fechaCreacion,
      tipo:        'CREACION',
      titulo:      'Incidente creado',
      descripcion: [
        codiDesc1  ? `Código: ${codiDesc1}` : null,
        codiDesc2  ? `/ ${codiDesc2}`        : null,
        d.direCaso ? `Dir: ${d.direCaso}`    : null,
        d.prioridad ? `Prioridad: ${this.getPrioridadLabel(d.prioridad)}` : null,
        d.origen    ? `Canal: ${this.getOrigenLabel(d.origen)}`           : null,
      ].filter(Boolean).join(' · '),
      actor:      d.usernameCreacion || '—',
      icono:      'fa-solid fa-circle-plus',
      colorClass: 'tl-creacion',
    });

    // ── 2. Actuaciones (despacho de recursos operativos) ──────────────────
    for (const act of actuaciones) {
      const canal  = [act.fuerzaDesc, act.canalDesc].filter(Boolean).join(' · ');
      const unidad = act.unidadAsignada
        ? `${act.unidadAsignada}${act.placaUnidad ? ' (' + act.placaUnidad + ')' : ''}`
        : 'Sin unidad registrada';

      // Asignación del recurso (estado P)
      items.push({
        timestamp:     act.fechaCreacion,
        tipo:          'ANOTACION',
        titulo:        `Recurso asignado — ${canal}`,
        descripcion:   unidad,
        actor:         '—',
        icono:         'fa-solid fa-hand-point-right',
        colorClass:    'tl-despacho',
        tipoAnotacion: 'DESPACHO',
      });

      // En camino (estado D) — con tiempo desde asignación
      if (act.fechaDespacho) {
        const tAsig = this.diffMin(act.fechaCreacion, act.fechaDespacho);
        items.push({
          timestamp:     act.fechaDespacho,
          tipo:          'ANOTACION',
          titulo:        `Recurso en camino — ${canal}`,
          descripcion:   `${unidad} · ⏱ Asignación→Despacho: ${this.fmtDur(tAsig)}`,
          actor:         '—',
          icono:         'fa-solid fa-truck-fast',
          colorClass:    'tl-despacho',
          tipoAnotacion: 'DESPACHO',
        });
      }

      // En sitio (estado A) — con tiempo de tránsito
      if (act.fechaLlegada) {
        const tTransito = this.diffMin(act.fechaDespacho ?? act.fechaCreacion, act.fechaLlegada);
        items.push({
          timestamp:     act.fechaLlegada,
          tipo:          'ANOTACION',
          titulo:        `Recurso en sitio — ${canal}`,
          descripcion:   `${unidad} · ⏱ Tránsito: ${this.fmtDur(tTransito)}`,
          actor:         '—',
          icono:         'fa-solid fa-location-dot',
          colorClass:    'tl-operativa',
          tipoAnotacion: 'OPERATIVA',
        });
      }

      // Cierre de actuación (estado C o V) — con tiempos de atención y total
      if (act.fechaCierre) {
        const cerradoLabel = act.estado === 'V' ? 'Actuación anulada' : 'Actuación cerrada';
        const ref          = act.fechaLlegada ?? act.fechaDespacho ?? act.fechaCreacion;
        const tAtencion    = this.diffMin(ref, act.fechaCierre);
        const tTotal       = this.diffMin(act.fechaCreacion, act.fechaCierre);
        const partes       = [
          `${unidad}`,
          act.fechaLlegada ? `⏱ En sitio: ${this.fmtDur(tAtencion)}`    : null,
          `⏱ Total actuación: ${this.fmtDur(tTotal)}`,
          act.caliPedido   ? `Cal.: ${act.caliPedido}` : null,
        ].filter(Boolean).join(' · ');

        items.push({
          timestamp:     act.fechaCierre,
          tipo:          'CIERRE',
          titulo:        `${cerradoLabel} — ${canal}`,
          descripcion:   partes,
          actor:         '—',
          icono:         act.estado === 'V' ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-flag-checkered',
          colorClass:    act.estado === 'V' ? 'tl-general' : 'tl-cierre',
          tipoAnotacion: 'CIERRE',
        });
      }
    }

    // ── 3. Anotaciones tipificadas del pedido ─────────────────────────────
    const tipoMap: Record<string, { icon: string; clase: string }> = {
      'OPERATIVA':        { icon: 'fa-solid fa-shield-halved',        clase: 'tl-operativa'   },
      'PREVENTIVA':       { icon: 'fa-solid fa-triangle-exclamation', clase: 'tl-preventiva'  },
      'DESPACHO':         { icon: 'fa-solid fa-paper-plane',          clase: 'tl-despacho'    },
      'NOVEDAD_PERSONAL': { icon: 'fa-solid fa-user-shield',          clase: 'tl-novedad'     },
      'CIERRE':           { icon: 'fa-solid fa-flag-checkered',       clase: 'tl-cierre'      },
      'SUPERVISION':      { icon: 'fa-solid fa-eye',                  clase: 'tl-supervision' },
      'GENERAL':          { icon: 'fa-solid fa-comment',              clase: 'tl-general'     },
    };

    for (const a of (d.anotaciones ?? [])) {
      const meta = tipoMap[(a.tipoAnotacion ?? '').toUpperCase()] ?? tipoMap['GENERAL'];
      items.push({
        timestamp:     a.fechaCreacion,
        tipo:          a.tipoAnotacion === 'CIERRE'      ? 'CIERRE'      :
                       a.tipoAnotacion === 'SUPERVISION' ? 'SUPERVISION' : 'ANOTACION',
        titulo:        a.titulo || this.getLabelTipoAnotacion(a.tipoAnotacion),
        descripcion:   a.anotacion,
        actor:         a.usernameCreacion || '—',
        icono:         meta.icon,
        colorClass:    meta.clase,
        tipoAnotacion: a.tipoAnotacion,
      });
    }

    // Ordenar cronológicamente
    items.sort((a, b) => {
      if (!a.timestamp) return -1;
      if (!b.timestamp) return  1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    this.timeline = items;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Anotación supervisora (Jefe de Turno)
  // ──────────────────────────────────────────────────────────────────────────

  guardarAnotacion(): void {
    if (!this.detalle || !this.anotacionForm.anotacion?.trim()) {
      this.toast.warning('Anotación', 'El texto de la observación es requerido.');
      return;
    }
    this.savingAnotacion             = true;
    this.anotacionForm.tipoAnotacion = 'SUPERVISION';

    this.pedidoService.createAnotacion(this.detalle.id, this.anotacionForm).subscribe({
      next: (resp) => {
        this.savingAnotacion = false;
        if (resp.success) {
          this.toast.success('Supervisión', resp.message || 'Observación registrada en la trazabilidad.');
          this.anotacionForm = this.emptyAnotacion();
          this.showAnotForm  = false;
          this.refreshDetalle(this.detalle!.id, this.detalle!.numeEvento ?? null);
        } else {
          this.toast.warning('Anotación', resp.message);
        }
      },
      error: (err) => {
        this.savingAnotacion = false;
        this.toast.error('Anotación', err?.error?.detail ?? 'Error al registrar la observación.');
      }
    });
  }

  private refreshDetalle(pedidoId: string, numeEvento: string | null | undefined): void {
    const listItem = this.listaPedidos.find(p => p.id === pedidoId) ?? null;
    forkJoin({
      detalle: this.pedidoService.getById(pedidoId),
      // Siempre usar pedidoId: el backend filtra por cad_actuaciones.pedido_id
      actsResp: this.actuacionesService.getActuacionesEvento(pedidoId)
          .pipe(catchError(() => of({ success: true, data: [] as DtoActuacionListItem[] })))
    }).subscribe({
      next: ({ detalle, actsResp }) => {
        this.detalle     = this.normalizarDetalle(detalle as any, listItem);
        this.actuaciones = actsResp.data ?? [];
        this.buildTimeline(this.detalle, this.actuaciones);
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Stats del Dashboard
  // ──────────────────────────────────────────────────────────────────────────

  computarStats(): void {
    const s = this.emptyStats();
    s.total = this.listaPedidos.length;

    for (const p of this.listaPedidos) {
      if      (p.estado === 'A') s.activos++;
      else if (p.estado === 'P') s.pendientes++;
      else if (p.estado === 'C') s.cerrados++;

      const prio = this.normPrio(p);
      if      (prio === 'FLASH')     s.flash++;
      else if (prio === 'INMEDIATA') s.inmediata++;
      else if (prio === 'RUTINA')    s.rutina++;

      const origen = p.origen ?? 'MANUAL';
      s.porOrigen[origen] = (s.porOrigen[origen] ?? 0) + 1;

      if (p.estado !== 'C' && this.getSemaforoClass(p) === 'semaforo-rojo') s.criticos++;
    }

    this.stats = s;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  KPIs
  // ──────────────────────────────────────────────────────────────────────────

  computarKpis(): void {
    const activos = this.listaPedidos.filter(p => p.estado !== 'C');

    const tiemposFlash  = activos.filter(p => this.normPrio(p) === 'FLASH')    .map(p => this.getMinutos(p));
    const tiemposInmd   = activos.filter(p => this.normPrio(p) === 'INMEDIATA').map(p => this.getMinutos(p));
    const tiemposRutina = activos.filter(p => this.normPrio(p) === 'RUTINA')   .map(p => this.getMinutos(p));

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const avgFlash  = avg(tiemposFlash);
    const avgInmd   = avg(tiemposInmd);
    const avgRutina = avg(tiemposRutina);
    const tasaRes   = this.stats.total > 0
      ? Math.round((this.stats.cerrados / this.stats.total) * 100) : 0;

    this.kpis = [
      {
        label:     'T. promedio FLASH activos',
        valor:     avgFlash,
        unidad:    ' min',
        meta:      20,
        cumple:    tiemposFlash.length === 0 || avgFlash < 20,
        prioridad: 'flash',
        icon:      'fa-bolt',
      },
      {
        label:     'T. promedio INMEDIATA activos',
        valor:     avgInmd,
        unidad:    ' min',
        meta:      45,
        cumple:    tiemposInmd.length === 0 || avgInmd < 45,
        prioridad: 'inmediata',
        icon:      'fa-gauge-high',
      },
      {
        label:     'T. promedio RUTINA activos',
        valor:     avgRutina,
        unidad:    ' min',
        meta:      60,
        cumple:    tiemposRutina.length === 0 || avgRutina < 60,
        prioridad: 'rutina',
        icon:      'fa-clock',
      },
      {
        label:  'Incidentes críticos (tiempo excedido)',
        valor:  this.stats.criticos,
        unidad: '',
        meta:   0,
        cumple: this.stats.criticos === 0,
        icon:   'fa-triangle-exclamation',
      },
      {
        label:  'Incidentes activos / pendientes',
        valor:  this.stats.activos + this.stats.pendientes,
        unidad: '',
        meta:   9999,
        cumple: true,
        icon:   'fa-circle-dot',
      },
      {
        label:  'Tasa de resolución del turno',
        valor:  tasaRes,
        unidad: '%',
        meta:   80,
        cumple: tasaRes >= 80 || this.stats.total === 0,
        icon:   'fa-check-double',
      },
    ];

    this.computarOperadores();
  }

  computarOperadores(): void {
    const mapa: Record<string, OperadorStat> = {};

    for (const p of this.listaPedidos) {
      const usr = p.usernameCreacion?.trim() || '(sin usuario)';
      if (!mapa[usr]) {
        mapa[usr] = { username: usr, total: 0, activos: 0, cerrados: 0, tiempoPromedio: 0, criticos: 0 };
      }
      const op = mapa[usr];
      op.total++;
      if (p.estado === 'C') {
        op.cerrados++;
      } else {
        op.activos++;
        op.tiempoPromedio = Math.round(
          (op.tiempoPromedio * (op.activos - 1) + this.getMinutos(p)) / op.activos
        );
        if (this.getSemaforoClass(p) === 'semaforo-rojo') op.criticos++;
      }
    }

    this.operadores = Object.values(mapa).sort((a, b) => b.total - a.total);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Lista filtrada
  // ──────────────────────────────────────────────────────────────────────────

  get listadoFiltrado(): DtoPedidoListItem[] {
    let list = this.listaPedidos;

    if (this.filtroEstado) {
      list = list.filter(p => p.estado === this.filtroEstado);
    }

    if (this.filtroPrioridad) {
      const pf = this.filtroPrioridad.toUpperCase();
      list = list.filter(p => this.normPrio(p) === pf);
    }

    if (this.filtroTexto.trim()) {
      const txt = this.filtroTexto.toLowerCase().trim();
      list = list.filter(p =>
        p.direCaso?.toLowerCase().includes(txt)              ||
        p.codiPedido?.toLowerCase().includes(txt)            ||
        p.descPedido?.toLowerCase().includes(txt)            ||
        p.codiPedido2?.toLowerCase().includes(txt)           ||
        p.usernameCreacion?.toLowerCase().includes(txt)      ||
        String(p.id).includes(txt)                           ||
        (p.numeEvento ? String(p.numeEvento).includes(txt) : false)
      );
    }

    return list;
  }

  get incidentesCriticos(): DtoPedidoListItem[] {
    return this.listaPedidos.filter(
      p => p.estado !== 'C' && this.getSemaforoClass(p) === 'semaforo-rojo'
    ).slice(0, 10);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Semáforo
  // ──────────────────────────────────────────────────────────────────────────

  getSemaforoClass(item: DtoPedidoListItem): SemaforoColor {
    void this.tick; // dependencia reactiva
    if (item.estado === 'C') return 'semaforo-verde';
    const prio = this.normPrio(item);
    const min  = this.getMinutos(item);
    if (prio === 'FLASH')     return 'semaforo-rojo';
    if (prio === 'INMEDIATA') return min >= 30 ? 'semaforo-rojo' : 'semaforo-amarillo';
    if (min >= 60) return 'semaforo-rojo';
    if (min >= 30) return 'semaforo-amarillo';
    return 'semaforo-verde';
  }

  getMinutos(item: DtoPedidoListItem): number {
    const ref = item.horaCaso ?? item.fechaCreacion;
    if (!ref) return 0;
    return Math.floor((Date.now() - new Date(ref).getTime()) / 60_000);
  }

  getElapsedLabel(item: DtoPedidoListItem): string {
    const m = this.getMinutos(item);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return m % 60 > 0 ? `${h}h ${m % 60}m` : `${h}h`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Label helpers
  // ──────────────────────────────────────────────────────────────────────────

  getEstadoLabel(e: string): string {
    return ({ A: 'Activo', C: 'Cerrado', P: 'Pendiente' } as any)[e] ?? e;
  }

  getEstadoClass(e: string): string {
    return ({ A: 'seg-badge--activo', C: 'seg-badge--cerrado', P: 'seg-badge--pendiente' } as any)[e]
           ?? 'seg-badge--default';
  }

  getPrioridadLabel(p: string): string {
    const n = this.normPrio({ prioridad: p } as any);
    return n || p || '—';
  }

  getPrioridadClass(p: string): string {
    const n = this.normPrio({ prioridad: p } as any);
    return ({ FLASH: 'prio-flash', INMEDIATA: 'prio-inmediata', RUTINA: 'prio-rutina' } as any)[n]
           ?? 'prio-default';
  }

  getLabelTipoAnotacion(tipo: string): string {
    const map: Record<string, string> = {
      'OPERATIVA':        'Anotación operativa',
      'PREVENTIVA':       'Anotación preventiva',
      'DESPACHO':         'Despacho de recurso',
      'NOVEDAD_PERSONAL': 'Novedad de personal',
      'CIERRE':           'Cierre del incidente',
      'SUPERVISION':      'Supervisión — Jefe de Turno',
      'GENERAL':          'Anotación general',
    };
    return map[(tipo ?? '').toUpperCase()] ?? 'Anotación';
  }

  getOrigenLabel(origen: string): string {
    const map: Record<string, string> = {
      'CTI':         'Llamada 112/123',
      'RECEPCION':   'Recepción telefónica',
      'RADIO':       'Radio policial',
      'CAMPO':       'Reporte de campo',
      'SUPERVISION': 'Supervisión / Iniciativa',
      'INTERNO':     'Canal interno',
      'INTEGRACION': 'Otra entidad / Traslado',
      'SIEDCO':      'SIEDCO',
      'APP_MOVIL':   'App Móvil',
      'MANUAL':      'Ingreso manual',
    };
    return map[(origen ?? '').toUpperCase()] ?? origen ?? '—';
  }

  getOrigenKeys(): string[] {
    return Object.keys(this.stats.porOrigen);
  }

  /** Etiqueta legible del turno de vigilancia ("1er turno · desde 06:00"). */
  getTurnoLabel(): string {
    if (!this.conteos) return '';
    const desde = this.conteos.turnoDesde
      ? new Date(this.conteos.turnoDesde).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `${this.conteos.turnoActual} turno${desde ? ' · desde ' + desde : ''}`;
  }

  /** Construye la cadena "CÓDIGO — Descripción" para cualquier código de caso. */
  codiConDesc(codigo: string | undefined, desc: string | undefined): string {
    if (!codigo) return '—';
    return desc ? `${codigo} — ${desc}` : codigo;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  UI
  // ──────────────────────────────────────────────────────────────────────────

  setVista(v: VistaCad): void  { this.vista = v; }
  toggleMinimize():    void    { this.minimized = !this.minimized; }
  closePanel():        void    { this.visible   = false; }

  // ──────────────────────────────────────────────────────────────────────────
  //  Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /** Normaliza la prioridad a FLASH | INMEDIATA | RUTINA */
  private normPrio(item: Partial<DtoPedidoListItem> & { prioridad?: string }): string {
    const p = ((item as any).prioridad ?? '').toUpperCase().trim();
    if (p === 'FLASH'     || p === '01') return 'FLASH';
    if (p === 'INMEDIATA' || p === '02') return 'INMEDIATA';
    if (p === 'RUTINA'    || p === '03') return 'RUTINA';
    return p;
  }

  private emptyStats(): DashStat {
    return { total: 0, activos: 0, pendientes: 0, cerrados: 0,
             flash: 0, inmediata: 0, rutina: 0, criticos: 0, porOrigen: {} };
  }

  private emptyAnotacion(): DtoAnotacionRequest {
    return { titulo: '', anotacion: '', tipoAnotacion: 'SUPERVISION' };
  }

  /** Diferencia en minutos redondeados entre dos timestamps ISO. Siempre ≥ 0. */
  private diffMin(from: string | null | undefined, to: string | null | undefined): number {
    if (!from || !to) return 0;
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.max(0, Math.round(diff / 60_000));
  }

  /** Formatea minutos como "5m", "1h 12m", etc. */
  private fmtDur(min: number): string {
    if (min <= 0) return '< 1m';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  /**
   * Normaliza un item de lista enriqueciéndolo con datos del eventoMap.
   * El eventoMap se puebla al inicio desde EventoService.getEventos()
   * y proporciona: prioridad, descPedido, numeEvento, que /Pedido no devuelve en lista.
   */
  private normalizarListItem(item: any): DtoPedidoListItem {
    const ev = this.eventoMap[String(item?.id ?? '')];
    return {
      id:               String(item?.id ?? ''),
      sitioGraba:       Number(item?.sitioGraba  ?? item?.sitio_graba  ?? 0),
      numeLlamada:      item?.numeLlamada  ?? item?.nume_llamada  ?? null,
      horaCaso:         item?.horaCaso     ?? item?.hora_caso     ?? null,
      numeTelefono:     item?.numeTelefono ?? item?.nume_telefono ?? null,
      direCaso:         String(item?.direCaso  ?? item?.dire_caso  ?? ''),
      estado:           String(item?.estado    ?? ''),
      enviar:           String(item?.enviar    ?? 'N'),
      codiPedido:       String(item?.codiPedido  ?? item?.codi_pedido  ?? ''),
      codiPedido2:      String(item?.codiPedido2 ?? item?.codi_pedido2 ?? ''),
      comentario:       String(item?.comentario ?? ''),
      // usernameCreacion: preferimos el valor del pedido; si está vacío, intentamos el del evento
      usernameCreacion: String(
        (item?.usernameCreacion ?? item?.username_creacion ?? '').trim() ||
        (ev?.usernameCreacion ?? '')
      ),
      fechaCreacion:  item?.fechaCreacion ?? item?.fecha_creacion ?? null,
      // ── Enriquecimiento desde EventoService ──────────────────────────────
      prioridad:   item?.prioridad  || ev?.prioridad  || undefined,
      // origen: el listado de /Pedido no lo devuelve; viene del eventoMap (cad_eventos.origen)
      origen:      item?.origen     || ev?.origen     || undefined,
      numeEvento:  ev?.numeEvento   ?? undefined,
      descPedido:  item?.descPedido ?? ev?.descPedido ?? undefined,
      descPedido2: item?.descPedido2 ?? undefined,
    } as DtoPedidoListItem;
  }

  /**
   * Normaliza el detalle completo combinando el DTO del backend con los campos
   * enriquecidos del listItem correspondiente (numeEvento, prioridad, origen).
   */
  private normalizarDetalle(item: any, listItem?: DtoPedidoListItem | null): DtoPedidoDetalle {
    const base = this.normalizarListItem(item);
    // numeEvento y origen: pueden venir del listItem (eventoMap) si el detalle no los trae
    const numeEvento = base.numeEvento ?? listItem?.numeEvento ?? undefined;
    const origen     = base.origen     ?? listItem?.origen     ?? undefined;

    return {
      ...base,
      prioridad:  String(item?.prioridad ?? listItem?.prioridad ?? ''),
      origen,
      numeEvento,
      propTelefono:     String(item?.propTelefono  ?? item?.prop_telefono  ?? ''),
      nombLlamante:     String(item?.nombLlamante  ?? item?.nomb_llamante  ?? ''),
      barrio:           String(item?.barrio  ?? ''),
      ciudad:           String(item?.ciudad  ?? ''),
      direLlamante:     String(item?.direLlamante  ?? item?.dire_llamante  ?? ''),
      latitudCaso:      String(item?.latitudCaso   ?? item?.latitud_caso   ?? ''),
      longitudCaso:     String(item?.longitudCaso  ?? item?.longitud_caso  ?? ''),
      cordx:            String(item?.cordx ?? ''),
      cordy:            String(item?.cordy ?? ''),
      tiposhape:        String(item?.tiposhape ?? ''),
      radio:            Number(item?.radio ?? 0),
      tipoPedido:       String(item?.tipoPedido  ?? item?.tipo_pedido  ?? ''),
      caliPedido:       String(item?.caliPedido  ?? item?.cali_pedido  ?? ''),
      importancia:      String(item?.importancia ?? ''),
      dispTelefonico:   String(item?.dispTelefonico  ?? item?.disp_telefonico  ?? ''),
      celdaMarcacion:   String(item?.celdaMarcacion  ?? item?.celda_marcacion  ?? ''),
      canales:          String(item?.canales ?? ''),
      canalFuerza:      String(item?.canalFuerza ?? item?.canal_fuerza ?? ''),
      pedidoPadreSitio: item?.pedidoPadreSitio ?? item?.pedido_padre_sitio ?? null,
      pedidoPadreNum:   item?.pedidoPadreNum   ?? item?.pedido_padre_num   ?? null,
      descPedido:       String(item?.descPedido  ?? item?.desc_pedido  ?? listItem?.descPedido  ?? ''),
      descPedido2:      String(item?.descPedido2 ?? item?.desc_pedido2 ?? listItem?.descPedido2 ?? ''),
      anotaciones: (item?.anotaciones ?? []).map((a: any) => ({
        id:               Number(a?.id ?? 0),
        idPedido:         Number(a?.idPedido ?? a?.id_pedido ?? 0),
        titulo:           String(a?.titulo ?? ''),
        anotacion:        String(a?.anotacion ?? ''),
        tipoAnotacion:    String(a?.tipoAnotacion ?? a?.tipo_anotacion ?? 'GENERAL'),
        usuarioCreacion:  a?.usuarioCreacion ?? a?.usuario_creacion ?? null,
        usernameCreacion: String(a?.usernameCreacion ?? a?.username_creacion ?? ''),
        fechaCreacion:    a?.fechaCreacion ?? a?.fecha_creacion ?? null,
        maquinaCreacion:  String(a?.maquinaCreacion ?? a?.maquina_creacion ?? ''),
      })),
    };
  }
}
