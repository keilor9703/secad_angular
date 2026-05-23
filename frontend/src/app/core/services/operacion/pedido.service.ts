import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface DtoPedidoListItem {
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
  usernameCreacion: string;
  fechaCreacion: string | null;
}

export interface DtoAnotacion {
  id: number;
  idPedido: number;
  titulo: string;
  anotacion: string;
  tipoAnotacion: string;
  usuarioCreacion: number | null;
  usernameCreacion: string;
  fechaCreacion: string | null;
  maquinaCreacion: string;
}

export interface DtoPedidoDetalle extends DtoPedidoListItem {
  propTelefono: string;
  nombLlamante: string;
  barrio: string;
  ciudad: string;
  direLlamante: string;
  latitudCaso: string;
  longitudCaso: string;
  cordx: string;
  cordy: string;
  tiposhape: string;
  radio: number;
  tipoPedido: string;
  caliPedido: string;
  importancia: string;
  prioridad: string;
  dispTelefonico: string;
  celdaMarcacion: string;
  canales: string;
  canalFuerza: string;
  pedidoPadreSitio: number | null;
  pedidoPadreNum: number | null;
  anotaciones: DtoAnotacion[];
}

export interface DtoPedidoRequest {
  sitioGraba: number;
  numeLlamada: number;
  horaCaso: string;
  numeTelefono: number;
  propTelefono: string;
  nombLlamante: string;
  barrio: string;
  ciudad: string;
  direLlamante: string;
  direCaso: string;
  latitudCaso: string;
  longitudCaso: string;
  cordx: string;
  cordy: string;
  tiposhape: string;
  radio: number;
  comentario: string;
  codiPedido: string;
  codiPedido2: string;
  tipoPedido: string;
  caliPedido: string;
  importancia: string;
  prioridad: string;
  dispTelefonico: string;
  celdaMarcacion: string;
  canalesSeleccionados: number[];
  canalFuerza: string;
  enviar: string;
  estado: string;
  pedidoPadreSitio: number | null;
  pedidoPadreNum: number | null;
}

export interface DtoCerrarRapidoRequest {
  comentario: string;
  codiPedido: string;
  enviar: string;
}

export interface DtoAnotacionRequest {
  titulo: string;
  anotacion: string;
  tipoAnotacion: string;
}

export interface DtoPedidoResult {
  success: boolean;
  id: number;
  message: string;
}

export interface DtoPedidoAsociar {
  id: number;
  numeLlamada: number | null;
  horaCaso: string;
  numeTelefono: number | null;
  caliPedido: string;
  ciudad: string;
  nombLlamante: string;
  direCaso: string;
  codiPedido: string;
  estado: string;
  sitioGraba: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Pedido`;

  constructor(private http: HttpClient) {}

  getList(estado?: string, sitioGraba?: number): Observable<DtoPedidoListItem[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    if (sitioGraba != null) params = params.set('sitioGraba', sitioGraba.toString());
    return this.http.get<DtoPedidoListItem[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<DtoPedidoDetalle> {
    return this.http.get<DtoPedidoDetalle>(`${this.baseUrl}/${id}`);
  }

  create(request: DtoPedidoRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(this.baseUrl, request);
  }

  update(id: number, request: DtoPedidoRequest): Observable<DtoPedidoResult> {
    return this.http.put<DtoPedidoResult>(`${this.baseUrl}/${id}`, request);
  }

  cerrarRapido(id: number, request: DtoCerrarRapidoRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(`${this.baseUrl}/${id}/cerrar-rapido`, request);
  }

  setEstado(id: number, estado: string): Observable<DtoPedidoResult> {
    return this.http.put<DtoPedidoResult>(`${this.baseUrl}/${id}/estado`, { estado });
  }

  getAnotaciones(id: number): Observable<DtoAnotacion[]> {
    return this.http.get<DtoAnotacion[]>(`${this.baseUrl}/${id}/anotaciones`);
  }

  createAnotacion(id: number, request: DtoAnotacionRequest): Observable<DtoPedidoResult> {
    return this.http.post<DtoPedidoResult>(`${this.baseUrl}/${id}/anotaciones`, request);
  }

  buscarAsociar(sitioGraba: number): Observable<DtoPedidoAsociar[]> {
    const params = new HttpParams().set('sitioGraba', sitioGraba.toString());
    return this.http.get<DtoPedidoAsociar[]>(`${this.baseUrl}/buscar-asociar`, { params });
  }
}
