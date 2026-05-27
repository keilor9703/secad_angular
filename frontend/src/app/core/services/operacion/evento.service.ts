import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DtoAnotacion, DtoAnotacionRequest, DtoPedidoDetalle, DtoPedidoResult } from './pedido.service';

// ─── Eventos-specific DTOs ─────────────────────────────────────────────────────

export interface DtoEventoListItem {
  /** Snowflake ID serializado como string para preservar precisión en JavaScript. */
  id: string;
  sitioGraba: number;
  numeLlamada: number | null;
  horaCaso: string | null;
  numeTelefono: number | null;
  direCaso: string;
  estado: string;
  enviar: string;
  codiPedido: string;
  codiPedido2: string;
  comentario: string;
  prioridad: string;
  caliPedido: string;
  ciudad: string;
  usernameCreacion: string;
  fechaCreacion: string | null;
  /** Descripción del código de caso principal (JOIN cad_casos). */
  descPedido: string;
  /** Número de actuaciones en estado activo (P/D/A) para este evento. */
  totalActuacionesActivas: number;
  /**
   * Timestamp del primer acceso por un despachador.
   * NULL = nadie ha abierto el evento todavía.
   * Usado para la semaforización SLA (Épica 5).
   */
  fechaPrimerAcceso: string | null;
  /**
   * Snowflake ID del registro en cad_eventos (≠ id que es cad_pedidos.id).
   * Este es el número oficial del evento para el despachador.
   * Serializado como string para preservar precisión en JavaScript.
   */
  numeEvento?: string | null;
}

/** Contadores por estado para los badges de los filtros del canal. */
export interface DtoEventoConteos {
  total:          number;   // activos (cualquier estado != C)
  activos:        number;   // estado = 'A'
  pendientes:     number;   // estado = 'P'
  enProceso:      number;   // estado = 'E'
  seguimiento:    number;   // estado = 'T'
  revision:       number;   // estado = 'R'
  cerradosTurno:  number;   // estado = 'C' solo del turno vigente
  turnoActual:    string;   // "1ro" | "2do" | "3ro"
  turnoDesde:     string;   // ISO-8601 inicio del turno
}

/** Un umbral SLA de la tabla cad_config_sla. */
export interface DtoSlaConfig {
  id: number;
  nombre: string;
  umbralMinutos: number;
  colorHex: string;
  descripcion: string;
  orden: number;
}

export interface DtoCanalItem {
  codigo: number;
  fuerzaId: number;
  descripcion: string;
  fuerzaDesc: string;
}

export interface DtoEstadoRequest {
  estado: string;
}

export interface DtoCerrarRequest {
  comentario: string;
  codiPedido: string;
  enviar: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EventoService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Evento`;

  constructor(private http: HttpClient) {}

  /**
   * Returns the dispatcher's event queue filtered by canal.
   * If canalId is 0 or omitted the backend reads it from the JWT.
   */
  getEventos(canalId?: number, fuerzaId?: number, estado?: string): Observable<DtoEventoListItem[]> {
    let params = new HttpParams();
    if (canalId  != null && canalId  > 0) params = params.set('canalId',  canalId.toString());
    if (fuerzaId != null && fuerzaId > 0) params = params.set('fuerzaId', fuerzaId.toString());
    if (estado) params = params.set('estado', estado);
    return this.http.get<DtoEventoListItem[]>(this.baseUrl, { params });
  }

  /** Full detail for one event including annotations. */
  getById(id: string): Observable<DtoPedidoDetalle> {
    return this.http.get<DtoPedidoDetalle>(`${this.baseUrl}/${id}`);
  }

  /** Change management state (P=Pendiente, E=En proceso, T=Seguimiento, R=Revisión). */
  setEstado(id: string, estado: string): Observable<DtoPedidoResult> {
    return this.http.put<DtoPedidoResult>(`${this.baseUrl}/${id}/estado`, { estado });
  }

  /** Add an annotation / note to an event. */
  createAnotacion(id: string, request: DtoAnotacionRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(`${this.baseUrl}/${id}/anotaciones`, request);
  }

  /** Retrieve all annotations for an event. */
  getAnotaciones(id: string): Observable<DtoAnotacion[]> {
    return this.http.get<DtoAnotacion[]>(`${this.baseUrl}/${id}/anotaciones`);
  }

  /** Quick-close an event. */
  cerrar(id: string, request: DtoCerrarRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(`${this.baseUrl}/${id}/cerrar`, request);
  }

  /** Available channels for a site (used by the canal selector). */
  getCanales(sitioGraba?: number): Observable<DtoCanalItem[]> {
    let params = new HttpParams();
    if (sitioGraba != null && sitioGraba > 0)
      params = params.set('sitioGraba', sitioGraba.toString());
    return this.http.get<DtoCanalItem[]>(`${this.baseUrl}/canales`, { params });
  }

  /**
   * Returns per-state event counts for the dispatcher's filter badges.
   * Closed events only count those within the current surveillance shift.
   * Lightweight single-query endpoint — safe to poll every 15 s.
   */
  getConteos(canalId?: number, fuerzaId?: number): Observable<DtoEventoConteos> {
    let params = new HttpParams();
    if (canalId  != null && canalId  > 0) params = params.set('canalId',  canalId.toString());
    if (fuerzaId != null && fuerzaId > 0) params = params.set('fuerzaId', fuerzaId.toString());
    return this.http.get<DtoEventoConteos>(`${this.baseUrl}/conteos`, { params });
  }

  /**
   * Returns active SLA thresholds from the backend.
   * Used for color-coding the dispatcher queue — values are DB-configurable,
   * never hardcoded in the frontend.
   */
  getSlaConfig(): Observable<DtoSlaConfig[]> {
    return this.http.get<DtoSlaConfig[]>(`${this.baseUrl}/sla-config`);
  }
}
