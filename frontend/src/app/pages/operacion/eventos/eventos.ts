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
import { Subscription, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

import { EventoService, DtoEventoListItem, DtoCanalItem } from '../../../core/services/operacion/evento.service';
import { DtoAnotacionRequest, DtoPedidoDetalle, DtoAnotacion } from '../../../core/services/operacion/pedido.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  TurnosService,
  DtoMedioDisponibleResumen,
  DtoCambiarEstadoMedioRequest,
  ESTADO_MEDIO
} from '../../../core/services/operacion/turnos.service';

// Leaflet is loaded via CDN (index.html) – type-only reference
declare const L: any;

type SemaforoColor = 'semaforo-verde' | 'semaforo-amarillo' | 'semaforo-rojo';
type PanelMode = 'list' | 'detail';
type EstadoEvento = 'A' | 'P' | 'E' | 'T' | 'R' | 'C';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './eventos.html',
  styleUrls: ['./eventos.scss']
})
export class EventosComponent implements OnInit, OnDestroy, AfterViewChecked {

  // ─── Services ────────────────────────────────────────────────────────────────
  private eventoSvc  = inject(EventoService);
  private turnosSvc  = inject(TurnosService);
  private authSvc    = inject(AuthService);
  private cdr        = inject(ChangeDetectorRef);

  // ─── JWT claims ──────────────────────────────────────────────────────────────
  canalId    = 0;
  fuerzaId   = 0;
  sitioGraba = 0;

  // ─── Canal selector ──────────────────────────────────────────────────────────
  canalesDisponibles: DtoCanalItem[] = [];
  canalSeleccionado  = 0;
  canalNombre        = '';
  mostrarSelectorCanal = false;

  /** sessionStorage key – persists canal choice across navigations within the same tab */
  private readonly CANAL_KEY = 'ev_canal_sel';

  // ─── List state ──────────────────────────────────────────────────────────────
  eventos: DtoEventoListItem[] = [];
  filtroTexto   = '';
  filtroEstado  = '';        // '' = todos | 'A'=Activos | 'P'=Pendientes | etc.
  cargando      = false;
  errorCarga    = '';

  // ─── Detail panel ────────────────────────────────────────────────────────────
  panelMode: PanelMode = 'list';
  detalle: DtoPedidoDetalle | null = null;
  cargandoDetalle = false;

  // ─── Annotation form ─────────────────────────────────────────────────────────
  nuevaAnotacion: DtoAnotacionRequest = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
  guardandoAnotacion = false;
  mensajeAnotacion   = '';

  // ─── Close-event modal ───────────────────────────────────────────────────────
  modalCerrarVisible = false;
  cerrarComentario   = '';
  cerrarCodiPedido   = '';
  cerrandoEvento     = false;

  // ─── Estado change ───────────────────────────────────────────────────────────
  cambiandoEstado = false;

  // ─── Semáforo reactive tick ──────────────────────────────────────────────────
  tick = 0;

  // ─── Leaflet map ─────────────────────────────────────────────────────────────
  private mapaDetalle: any = null;
  private mapaInicializado = false;
  private pendingMapInit    = false;

  // ─── Recursos en turno (panel de despacho) ───────────────────────────────────
  recursos:                 DtoMedioDisponibleResumen[] = [];
  cargandoRecursos          = false;
  errorRecursos             = '';
  ultimaActRecursos:        Date | null = null;
  asignandoMedioId:         number | null = null;
  private recursoMarkers:   any[]  = [];
  private recursosSub:      Subscription | null = null;

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

    // Priority: JWT claim > sessionStorage > 0
    if (this.canalId > 0) {
      this.canalSeleccionado = this.canalId;
    } else {
      // Restore the canal chosen in a previous navigation within this tab session
      const stored = Number(sessionStorage.getItem(this.CANAL_KEY) ?? '0');
      if (stored > 0) {
        this.canalSeleccionado = stored;
      }
    }

    // Load available channels for the selector
    this.cargarCanales();

    // Semáforo tick every 60s
    this.subs.add(
      interval(60_000).subscribe(() => {
        this.tick++;
        this.cdr.markForCheck();
      })
    );

    // Auto-refresh the queue every 15s
    this.subs.add(
      interval(15_000)
        .pipe(
          startWith(0),
          switchMap(() => {
            this.cargando = true;
            return this.eventoSvc.getEventos(
              this.canalSeleccionado || undefined,
              this.fuerzaId || undefined,
              this.filtroEstado || undefined
            );
          })
        )
        .subscribe({
          next: (items) => {
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
    const found = this.canalesDisponibles.find(c => c.codigo === this.canalSeleccionado);
    this.canalNombre = found
      ? `${found.fuerzaDesc} – ${found.descripcion}`
      : this.canalSeleccionado > 0
        ? `Canal ${this.canalSeleccionado}`
        : 'Sin canal';
  }

  seleccionarCanal(codigo: number): void {
    this.canalSeleccionado    = codigo;
    this.mostrarSelectorCanal = false;
    this.toggleBodyModalClass(false);
    // Persist so the selector doesn't reappear on the next navigation within this session
    sessionStorage.setItem(this.CANAL_KEY, String(codigo));
    this.actualizarNombreCanal();
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
    const q = this.filtroTexto.toLowerCase();
    return this.eventos.filter(e =>
      e.direCaso?.toLowerCase().includes(q)      ||
      e.codiPedido?.toLowerCase().includes(q)     ||
      e.ciudad?.toLowerCase().includes(q)         ||
      String(e.numeLlamada ?? '').includes(q)     ||
      e.usernameCreacion?.toLowerCase().includes(q)
    );
  }

  get totalMostrados(): number { return this.eventosFiltrados.length; }

  // ─── Detail panel ─────────────────────────────────────────────────────────────

  abrirDetalle(evento: DtoEventoListItem): void {
    this.panelMode       = 'detail';
    this.detalle         = null;
    this.cargandoDetalle = true;
    this.mensajeAnotacion = '';
    this.nuevaAnotacion  = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
    this.pendingMapInit  = true;
    this.destroyMapaDetalle();
    this.detenerPollingRecursos();

    this.eventoSvc.getById(evento.id).subscribe({
      next: (d) => {
        this.detalle         = d;
        this.cargandoDetalle = false;
        // Map will init in ngAfterViewChecked once DOM is ready
        this.iniciarPollingRecursos();
      },
      error: () => {
        this.cargandoDetalle = false;
        this.errorCarga = 'No se pudo cargar el detalle del evento.';
      }
    });
  }

  volverLista(): void {
    this.destroyMapaDetalle();
    this.detenerPollingRecursos();
    this.panelMode = 'list';
    this.detalle   = null;
  }

  // ─── Estado change ────────────────────────────────────────────────────────────

  cambiarEstado(nuevoEstado: string): void {
    if (!this.detalle || this.cambiandoEstado) return;
    this.cambiandoEstado = true;

    this.eventoSvc.setEstado(this.detalle.id, nuevoEstado).subscribe({
      next: (r) => {
        this.cambiandoEstado = false;
        if (r.success && this.detalle) {
          this.detalle.estado = nuevoEstado;
          this.recargarAhora();
        }
      },
      error: () => { this.cambiandoEstado = false; }
    });
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

    this.eventoSvc.createAnotacion(this.detalle.id, this.nuevaAnotacion).subscribe({
      next: (r) => {
        this.guardandoAnotacion = false;
        if (r.success) {
          this.mensajeAnotacion = '✔ Anotación registrada.';
          this.nuevaAnotacion   = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
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

  getTipoAnotacionIcon(tipo: string): string {
    const map: Record<string, string> = {
      GENERAL:          '📝',
      OPERATIVA:        '🔧',
      PREVENTIVA:       '⚠️',
      DESPACHO:         '📡',
      NOVEDAD_PERSONAL: '👤',
      CIERRE:           '🔒'
    };
    return map[tipo] ?? '📝';
  }

  getTipoAnotacionLabel(tipo: string): string {
    const map: Record<string, string> = {
      GENERAL:          'General',
      OPERATIVA:        'Operativa',
      PREVENTIVA:       'Preventiva',
      DESPACHO:         'Despacho',
      NOVEDAD_PERSONAL: 'Novedad personal',
      CIERRE:           'Cierre'
    };
    return map[tipo] ?? tipo;
  }

  // ─── Close event modal ────────────────────────────────────────────────────────

  abrirModalCerrar(): void {
    this.cerrarComentario  = '';
    this.cerrarCodiPedido  = this.detalle?.codiPedido ?? '';
    this.modalCerrarVisible = true;
    this.toggleBodyModalClass(true);
  }

  cancelarCierre(): void {
    this.modalCerrarVisible = false;
    this.toggleBodyModalClass(false);
  }

  confirmarCierre(): void {
    if (!this.detalle || this.cerrandoEvento) return;
    this.cerrandoEvento = true;

    this.eventoSvc.cerrar(this.detalle.id, {
      comentario:  this.cerrarComentario,
      codiPedido:  this.cerrarCodiPedido,
      enviar:      'S'
    }).subscribe({
      next: (r) => {
        this.cerrandoEvento     = false;
        this.modalCerrarVisible = false;
        this.toggleBodyModalClass(false);
        if (r.success) {
          this.volverLista();
          this.recargarAhora();
        }
      },
      error: () => { this.cerrandoEvento = false; }
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

  // ─── Semáforo (§6.11) ────────────────────────────────────────────────────────

  getSemaforoClass(item: DtoEventoListItem | DtoPedidoDetalle): SemaforoColor {
    void this.tick;   // reactive dependency — re-evaluated each tick
    if (item.estado === 'C') return 'semaforo-verde';
    // Both DtoEventoListItem and DtoPedidoDetalle have 'prioridad'
    const prio = (item.prioridad ?? '').toUpperCase().trim();
    const min  = this.getMinutos(item);
    if (prio === 'FLASH')     return 'semaforo-rojo';
    if (prio === 'INMEDIATA') return min >= 30 ? 'semaforo-rojo' : 'semaforo-amarillo';
    if (min >= 60) return 'semaforo-rojo';
    if (min >= 30) return 'semaforo-amarillo';
    return 'semaforo-verde';
  }

  private getMinutos(item: DtoEventoListItem | DtoPedidoDetalle): number {
    // horaCaso is from DtoPedidoListItem (base of both); fechaCreacion is also on the base
    const raw = item.horaCaso ?? item.fechaCreacion;
    if (!raw) return 0;
    const diff = Date.now() - new Date(raw).getTime();
    return Math.floor(diff / 60_000);
  }

  getElapsedLabel(item: DtoEventoListItem | DtoPedidoDetalle): string {
    const min = this.getMinutos(item);
    if (min < 60)  return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
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
          this.canalSeleccionado, this.sitioGraba || 1
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

  /** Cambia estado de un medio a En ruta (30) vinculado al evento activo. */
  asignarMedioAlEvento(medioId: number): void {
    if (!this.detalle || this.asignandoMedioId) return;
    this.asignandoMedioId = medioId;
    const req: DtoCambiarEstadoMedioRequest = {
      nuevoEstado:  ESTADO_MEDIO.EN_RUTA,
      eventoId:     this.detalle.id,
      observacion:  `Asignado desde evento ${this.detalle.codiPedido ?? this.detalle.id}`
    };
    this.turnosSvc.cambiarEstadoMedio(medioId, req).subscribe({
      next: () => { this.asignandoMedioId = null; },
      error: ()=> { this.asignandoMedioId = null; }
    });
  }

  /** Libera un medio (Libre = 27). */
  liberarMedio(medioId: number): void {
    if (this.asignandoMedioId) return;
    this.asignandoMedioId = medioId;
    const req: DtoCambiarEstadoMedioRequest = { nuevoEstado: ESTADO_MEDIO.LIBRE };
    this.turnosSvc.cambiarEstadoMedio(medioId, req).subscribe({
      next: () => { this.asignandoMedioId = null; },
      error: ()=> { this.asignandoMedioId = null; }
    });
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

  trackById(_: number, item: DtoEventoListItem): number { return item.id; }
  trackByIdAnot(_: number, a: DtoAnotacion): number { return a.id; }
}
