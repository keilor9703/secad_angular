import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DtoAnotacion, DtoAnotacionRequest, DtoPedidoDetalle, DtoPedidoResult } from './pedido.service';

// ─── Eventos-specific DTOs ─────────────────────────────────────────────────────

export interface DtoEventoListItem {
  id: number;
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
  getById(id: number): Observable<DtoPedidoDetalle> {
    return this.http.get<DtoPedidoDetalle>(`${this.baseUrl}/${id}`);
  }

  /** Change management state (P=Pendiente, E=En proceso, T=Seguimiento, R=Revisión). */
  setEstado(id: number, estado: string): Observable<DtoPedidoResult> {
    return this.http.put<DtoPedidoResult>(`${this.baseUrl}/${id}/estado`, { estado });
  }

  /** Add an annotation / note to an event. */
  createAnotacion(id: number, request: DtoAnotacionRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(`${this.baseUrl}/${id}/anotaciones`, request);
  }

  /** Retrieve all annotations for an event. */
  getAnotaciones(id: number): Observable<DtoAnotacion[]> {
    return this.http.get<DtoAnotacion[]>(`${this.baseUrl}/${id}/anotaciones`);
  }

  /** Quick-close an event. */
  cerrar(id: number, request: DtoCerrarRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(`${this.baseUrl}/${id}/cerrar`, request);
  }

  /** Available channels for a site (used by the canal selector). */
  getCanales(sitioGraba?: number): Observable<DtoCanalItem[]> {
    let params = new HttpParams();
    if (sitioGraba != null && sitioGraba > 0)
      params = params.set('sitioGraba', sitioGraba.toString());
    return this.http.get<DtoCanalItem[]>(`${this.baseUrl}/canales`, { params });
  }
}
