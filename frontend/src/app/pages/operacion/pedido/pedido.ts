import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../core/services/toast.service';
import {
  PedidoService,
  DtoPedidoListItem,
  DtoPedidoDetalle,
  DtoPedidoRequest,
  DtoCerrarRapidoRequest,
  DtoAnotacionRequest
} from '../../../core/services/operacion/pedido.service';

declare const L: any;

type PanelMode    = 'list' | 'form' | 'detail';
type SemaforoColor = 'semaforo-verde' | 'semaforo-amarillo' | 'semaforo-rojo';

@Component({
  selector:    'app-pedido',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterModule],
  templateUrl: './pedido.html',
  styleUrls:   ['./pedido.scss']
})
export class PedidoComponent implements OnInit, OnDestroy {

  // ─── UI state ──────────────────────────────────────────────────────────────
  visible   = true;
  minimized = false;
  panelMode: PanelMode = 'list';
  loading   = false;
  saving    = false;

  /** Incremented every 60 s — forces Angular to re-evaluate semáforo getters */
  tick = 0;

  // ─── Filters ───────────────────────────────────────────────────────────────
  filtroEstado = 'A';
  filtroTexto  = '';
  filtroSitio: number | undefined = undefined;

  // ─── Data ──────────────────────────────────────────────────────────────────
  listaPedidos: DtoPedidoListItem[] = [];
  selectedId:   number | null = null;
  detalle:      DtoPedidoDetalle | null = null;
  editingId:    number | null = null;

  // ─── Form ──────────────────────────────────────────────────────────────────
  form: DtoPedidoRequest = this.emptyForm();

  // ─── Quick-close modal ─────────────────────────────────────────────────────
  showCerrarModal = false;
  cerrarForm: DtoCerrarRapidoRequest = { comentario: '', codiPedido: '', enviar: 'N' };
  cerrarTargetId: number | null = null;

  // ─── Annotation form ───────────────────────────────────────────────────────
  anotacionForm: DtoAnotacionRequest = this.emptyAnotacion();
  savingAnotacion = false;

  // ─── Map ───────────────────────────────────────────────────────────────────
  private mapDetalle: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private readonly pedidoService: PedidoService,
    private readonly toast: ToastService
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargarLista();

    // Auto-refresh activos every 30 s
    interval(30_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { if (this.filtroEstado === 'A') this.cargarLista(); });

    // Semáforo tick every 60 s
    interval(60_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.tick++);
  }

  ngOnDestroy(): void {
    this.destroyMapDetalle();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Filtered list
  // ──────────────────────────────────────────────────────────────────────────

  get listadoFiltrado(): DtoPedidoListItem[] {
    const txt = (this.filtroTexto ?? '').toLowerCase().trim();
    if (!txt) return this.listaPedidos;
    return this.listaPedidos.filter(p =>
      p.direCaso?.toLowerCase().includes(txt)      ||
      p.codiPedido?.toLowerCase().includes(txt)    ||
      p.codiPedido2?.toLowerCase().includes(txt)   ||
      p.usernameCreacion?.toLowerCase().includes(txt) ||
      String(p.id).includes(txt)
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Semaforización (§6.11)
  //  FLASH    → rojo siempre
  //  INMEDIATA→ amarillo < 30 min | rojo >= 30 min
  //  RUTINA   → verde < 30 min | amarillo 30-60 | rojo >= 60 min
  // ──────────────────────────────────────────────────────────────────────────

  getSemaforoClass(item: DtoPedidoListItem | DtoPedidoDetalle): SemaforoColor {
    void this.tick; // reactive dependency — do not remove
    if (item.estado === 'C') return 'semaforo-verde';
    const prio = ((item as any).prioridad ?? '').toUpperCase().trim();
    const min  = this.getMinutosTranscurridos(item);
    if (prio === 'FLASH')     return 'semaforo-rojo';
    if (prio === 'INMEDIATA') return min >= 30 ? 'semaforo-rojo' : 'semaforo-amarillo';
    // RUTINA o sin prioridad
    if (min >= 60) return 'semaforo-rojo';
    if (min >= 30) return 'semaforo-amarillo';
    return 'semaforo-verde';
  }

  getMinutosTranscurridos(item: DtoPedidoListItem): number {
    const ref = item.horaCaso ?? item.fechaCreacion;
    if (!ref) return 0;
    return Math.floor((Date.now() - new Date(ref).getTime()) / 60_000);
  }

  getElapsedLabel(item: DtoPedidoListItem): string {
    const m = this.getMinutosTranscurridos(item);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
  }

  getPrioridadLabel(p: string): string {
    switch ((p ?? '').toUpperCase()) {
      case 'FLASH':     return 'FLASH';
      case 'INMEDIATA': return 'INMEDIATA';
      case 'RUTINA':    return 'RUTINA';
      default:          return p || '—';
    }
  }

  getPrioridadClass(p: string): string {
    switch ((p ?? '').toUpperCase()) {
      case 'FLASH':     return 'prio-flash';
      case 'INMEDIATA': return 'prio-inmediata';
      case 'RUTINA':    return 'prio-rutina';
      default:          return 'prio-default';
    }
  }

  getTipoAnotacionIcon(tipo: string): string {
    switch ((tipo ?? '').toUpperCase()) {
      case 'OPERATIVA':        return 'fa-solid fa-shield-halved';
      case 'PREVENTIVA':       return 'fa-solid fa-triangle-exclamation';
      case 'DESPACHO':         return 'fa-solid fa-paper-plane';
      case 'NOVEDAD_PERSONAL': return 'fa-solid fa-user-shield';
      case 'CIERRE':           return 'fa-solid fa-flag-checkered';
      default:                 return 'fa-solid fa-comment';
    }
  }

  getTipoAnotacionLabel(tipo: string): string {
    switch ((tipo ?? '').toUpperCase()) {
      case 'GENERAL':          return 'General';
      case 'OPERATIVA':        return 'Operativa';
      case 'PREVENTIVA':       return 'Preventiva';
      case 'DESPACHO':         return 'Despacho';
      case 'NOVEDAD_PERSONAL': return 'Nov. Personal';
      case 'CIERRE':           return 'Cierre';
      default:                 return tipo || 'General';
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  List
  // ──────────────────────────────────────────────────────────────────────────

  cargarLista(): void {
    this.loading = true;
    this.pedidoService.getList(this.filtroEstado || undefined, this.filtroSitio).subscribe({
      next: (data) => {
        this.listaPedidos = (data ?? []).map(p => this.normalizarListItem(p as any));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Pedidos', 'No se pudieron cargar los casos.');
      }
    });
  }

  seleccionarCaso(item: DtoPedidoListItem): void {
    if (this.selectedId === item.id && this.panelMode === 'detail') return;
    this.selectedId = item.id;
    this.panelMode  = 'detail';
    this.loading    = true;
    this.destroyMapDetalle();

    this.pedidoService.getById(item.id).subscribe({
      next: (data) => {
        this.detalle = this.normalizarDetalle(data as any);
        this.loading = false;
        setTimeout(() => this.initMapaDetalle(), 150);
      },
      error: () => {
        this.loading = false;
        this.toast.error('Pedidos', 'No se pudo cargar el detalle del caso.');
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Create / Edit
  // ──────────────────────────────────────────────────────────────────────────

  nuevoCaso(): void {
    this.destroyMapDetalle();
    this.editingId = null;
    this.form      = this.emptyForm();
    this.panelMode = 'form';
  }

  editarCaso(item: DtoPedidoListItem): void {
    this.loading = true;
    this.destroyMapDetalle();
    this.pedidoService.getById(item.id).subscribe({
      next: (data) => {
        const d = this.normalizarDetalle(data as any);
        this.editingId = d.id;
        this.form = {
          sitioGraba:           d.sitioGraba,
          numeLlamada:          d.numeLlamada ?? 0,
          horaCaso:             d.horaCaso ?? '',
          numeTelefono:         d.numeTelefono ?? 0,
          propTelefono:         d.propTelefono,
          nombLlamante:         d.nombLlamante,
          barrio:               d.barrio,
          ciudad:               d.ciudad,
          direLlamante:         d.direLlamante,
          direCaso:             d.direCaso,
          latitudCaso:          d.latitudCaso,
          longitudCaso:         d.longitudCaso,
          cordx:                d.cordx,
          cordy:                d.cordy,
          tiposhape:            d.tiposhape,
          radio:                d.radio,
          comentario:           d.comentario,
          codiPedido:           d.codiPedido,
          codiPedido2:          d.codiPedido2,
          tipoPedido:           d.tipoPedido,
          caliPedido:           d.caliPedido,
          importancia:          d.importancia,
          prioridad:            d.prioridad,
          dispTelefonico:       d.dispTelefonico,
          celdaMarcacion:       d.celdaMarcacion,
          canalesSeleccionados: d.canales
            ? d.canales.split(',').map(Number).filter(n => !isNaN(n))
            : [],
          canalFuerza:          d.canalFuerza,
          enviar:               d.enviar,
          estado:               d.estado,
          pedidoPadreSitio:     d.pedidoPadreSitio,
          pedidoPadreNum:       d.pedidoPadreNum
        };
        this.loading   = false;
        this.panelMode = 'form';
      },
      error: () => {
        this.loading = false;
        this.toast.error('Pedidos', 'No se pudo cargar el caso para editar.');
      }
    });
  }

  guardar(): void {
    if (!this.form.direCaso?.trim() && !this.form.codiPedido?.trim()) {
      this.toast.warning('Guardar', 'Ingrese al menos la dirección del caso o el código de pedido.');
      return;
    }
    this.saving = true;
    const obs = this.editingId
      ? this.pedidoService.update(this.editingId, this.form)
      : this.pedidoService.create(this.form);

    obs.subscribe({
      next: (resp) => {
        this.saving = false;
        if (resp.success) {
          this.toast.success('Guardar', resp.message || 'Caso guardado correctamente.');
          this.cancelar();
          this.cargarLista();
        } else {
          this.toast.warning('Guardar', resp.message);
        }
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('Guardar', err?.error?.detail ?? err?.error?.message ?? 'Error guardando caso.');
      }
    });
  }

  cancelar(): void {
    this.destroyMapDetalle();
    this.editingId  = null;
    this.form       = this.emptyForm();
    this.panelMode  = 'list';
    this.selectedId = null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Quick close
  // ──────────────────────────────────────────────────────────────────────────

  abrirCerrarModal(id: number): void {
    this.cerrarTargetId = id;
    this.cerrarForm     = { comentario: '', codiPedido: '', enviar: 'N' };
    this.showCerrarModal = true;
  }

  confirmarCerrar(): void {
    if (!this.cerrarTargetId) return;
    this.saving = true;
    this.pedidoService.cerrarRapido(this.cerrarTargetId, this.cerrarForm).subscribe({
      next: (resp) => {
        this.saving = false;
        this.showCerrarModal = false;
        if (resp.success) {
          this.toast.success('Cerrar caso', resp.message || 'Caso cerrado.');
          if (this.detalle?.id === this.cerrarTargetId) this.detalle.estado = 'C';
          this.cargarLista();
        } else {
          this.toast.warning('Cerrar caso', resp.message);
        }
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('Cerrar caso', err?.error?.detail ?? err?.error?.message ?? 'Error cerrando caso.');
      }
    });
  }

  cancelarCerrar(): void {
    this.showCerrarModal = false;
    this.cerrarTargetId  = null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Annotations
  // ──────────────────────────────────────────────────────────────────────────

  guardarAnotacion(): void {
    if (!this.detalle || !this.anotacionForm.anotacion?.trim()) {
      this.toast.warning('Anotación', 'El texto de la anotación es requerido.');
      return;
    }
    this.savingAnotacion = true;
    this.pedidoService.createAnotacion(this.detalle.id, this.anotacionForm).subscribe({
      next: (resp) => {
        this.savingAnotacion = false;
        if (resp.success) {
          this.toast.success('Anotación', resp.message || 'Anotación registrada.');
          this.anotacionForm = this.emptyAnotacion();
          this.pedidoService.getAnotaciones(this.detalle!.id).subscribe({
            next: (data) => { if (this.detalle) this.detalle.anotaciones = data; }
          });
        } else {
          this.toast.warning('Anotación', resp.message);
        }
      },
      error: (err) => {
        this.savingAnotacion = false;
        this.toast.error('Anotación', err?.error?.detail ?? err?.error?.message ?? 'Error guardando anotación.');
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Map (Leaflet CDN)
  // ──────────────────────────────────────────────────────────────────────────

  private initMapaDetalle(): void {
    if (!this.detalle) return;
    const lat = parseFloat(this.detalle.latitudCaso);
    const lng = parseFloat(this.detalle.longitudCaso);
    const hasCoords = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    const cLat = hasCoords ? lat : 4.7110;
    const cLng = hasCoords ? lng : -74.0721;

    const el = document.getElementById('mapaDetalle');
    if (!el || typeof L === 'undefined') return;

    try {
      this.destroyMapDetalle();
      this.mapDetalle = L.map('mapaDetalle', { zoomControl: true }).setView([cLat, cLng], hasCoords ? 15 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.mapDetalle);

      if (hasCoords) {
        const icon = L.divIcon({
          className: '',
          html: '<span style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</span>',
          iconSize: [28, 28], iconAnchor: [14, 28]
        });
        L.marker([lat, lng], { icon })
          .addTo(this.mapDetalle)
          .bindPopup(`<strong>Caso #${this.detalle.id}</strong><br>${this.detalle.direCaso || ''}`)
          .openPopup();
      }
    } catch { /* map element not ready */ }
  }

  private destroyMapDetalle(): void {
    try {
      if (this.mapDetalle) { this.mapDetalle.remove(); this.mapDetalle = null; }
    } catch { /* ignore */ }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────────────────────────────────

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'A': return 'Activo';
      case 'C': return 'Cerrado';
      case 'P': return 'Pendiente';
      default:  return estado;
    }
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'A': return 'ped-badge--activo';
      case 'C': return 'ped-badge--cerrado';
      case 'P': return 'ped-badge--pendiente';
      default:  return 'ped-badge--default';
    }
  }

  toggleMinimize(): void { this.minimized = !this.minimized; }
  closePanel():     void { this.visible = false; }

  // ──────────────────────────────────────────────────────────────────────────
  //  Private builders
  // ──────────────────────────────────────────────────────────────────────────

  private emptyForm(): DtoPedidoRequest {
    return {
      sitioGraba: 0, numeLlamada: 0,
      horaCaso: new Date().toISOString(),
      numeTelefono: 0, propTelefono: '', nombLlamante: '',
      barrio: '', ciudad: '', direLlamante: '', direCaso: '',
      latitudCaso: '', longitudCaso: '', cordx: '', cordy: '',
      tiposhape: '', radio: 0, comentario: '',
      codiPedido: '', codiPedido2: '',
      tipoPedido: '', caliPedido: '', importancia: '', prioridad: '',
      dispTelefonico: '', celdaMarcacion: '',
      canalesSeleccionados: [], canalFuerza: '',
      enviar: 'N', estado: 'A',
      pedidoPadreSitio: null, pedidoPadreNum: null
    };
  }

  private emptyAnotacion(): DtoAnotacionRequest {
    return { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
  }

  private normalizarListItem(item: any): DtoPedidoListItem {
    return {
      id:               Number(item?.id ?? 0),
      sitioGraba:       Number(item?.sitioGraba ?? item?.sitio_graba ?? 0),
      numeLlamada:      item?.numeLlamada ?? item?.nume_llamada ?? null,
      horaCaso:         item?.horaCaso ?? item?.hora_caso ?? null,
      numeTelefono:     item?.numeTelefono ?? item?.nume_telefono ?? null,
      direCaso:         String(item?.direCaso ?? item?.dire_caso ?? ''),
      estado:           String(item?.estado ?? ''),
      enviar:           String(item?.enviar ?? 'N'),
      codiPedido:       String(item?.codiPedido ?? item?.codi_pedido ?? ''),
      codiPedido2:      String(item?.codiPedido2 ?? item?.codi_pedido2 ?? ''),
      comentario:       String(item?.comentario ?? ''),
      usernameCreacion: String(item?.usernameCreacion ?? item?.username_creacion ?? ''),
      fechaCreacion:    item?.fechaCreacion ?? item?.fecha_creacion ?? null
    };
  }

  private normalizarDetalle(item: any): DtoPedidoDetalle {
    return {
      ...this.normalizarListItem(item),
      propTelefono:     String(item?.propTelefono ?? item?.prop_telefono ?? ''),
      nombLlamante:     String(item?.nombLlamante ?? item?.nomb_llamante ?? ''),
      barrio:           String(item?.barrio ?? ''),
      ciudad:           String(item?.ciudad ?? ''),
      direLlamante:     String(item?.direLlamante ?? item?.dire_llamante ?? ''),
      latitudCaso:      String(item?.latitudCaso ?? item?.latitud_caso ?? ''),
      longitudCaso:     String(item?.longitudCaso ?? item?.longitud_caso ?? ''),
      cordx:            String(item?.cordx ?? ''),
      cordy:            String(item?.cordy ?? ''),
      tiposhape:        String(item?.tiposhape ?? ''),
      radio:            Number(item?.radio ?? 0),
      tipoPedido:       String(item?.tipoPedido ?? item?.tipo_pedido ?? ''),
      caliPedido:       String(item?.caliPedido ?? item?.cali_pedido ?? ''),
      importancia:      String(item?.importancia ?? ''),
      prioridad:        String(item?.prioridad ?? ''),
      dispTelefonico:   String(item?.dispTelefonico ?? item?.disp_telefonico ?? ''),
      celdaMarcacion:   String(item?.celdaMarcacion ?? item?.celda_marcacion ?? ''),
      canales:          String(item?.canales ?? ''),
      canalFuerza:      String(item?.canalFuerza ?? item?.canal_fuerza ?? ''),
      pedidoPadreSitio: item?.pedidoPadreSitio ?? item?.pedido_padre_sitio ?? null,
      pedidoPadreNum:   item?.pedidoPadreNum   ?? item?.pedido_padre_num   ?? null,
      anotaciones: (item?.anotaciones ?? []).map((a: any) => ({
        id:               Number(a?.id ?? 0),
        idPedido:         Number(a?.idPedido ?? a?.id_pedido ?? 0),
        titulo:           String(a?.titulo ?? ''),
        anotacion:        String(a?.anotacion ?? ''),
        tipoAnotacion:    String(a?.tipoAnotacion ?? a?.tipo_anotacion ?? 'GENERAL'),
        usuarioCreacion:  a?.usuarioCreacion ?? a?.usuario_creacion ?? null,
        usernameCreacion: String(a?.usernameCreacion ?? a?.username_creacion ?? ''),
        fechaCreacion:    a?.fechaCreacion ?? a?.fecha_creacion ?? null,
        maquinaCreacion:  String(a?.maquinaCreacion ?? a?.maquina_creacion ?? '')
      }))
    };
  }
}
