import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface DtoLlamadaEntrante {
  NUME_LLAMADA: number;
  NUME_TELEFONO: number;
  CORDX: string;
  CORDY: string;
  TIPOSHAPE: string;
  RADIO: number;
  FECHAGMLC: string;
  OPERADOR: string;
}

export interface DtoCasoItem {
  CODIGO_CASO: string;
  DESCRIPCION_CASO: string;
}

export interface DtoCanalRecepcion {
  Codigo: number;
  Descripcion: string;
  Fuerza: string;
  /** runtime toggle – not from API */
  seleccionado?: boolean;
}

export interface DtoReferenciaSecad {
  Nombre: string;
  Codigo: string;
  Descripcion: string;
  Abreviatura: string;
}

export interface DtoBusquedaAsociarLlamada {
  sitioGraba: number;
  horaCaso: string;
  numeLlamada: number;
}

export interface DtoLlamadaAsociar {
  NUME_LLAMADA: number;
  HORA_CASO: string;
  NUME_TELEFONO: number;
  CALI_PEDIDO: string;
  CIUDAD: string;
  NOMB_LLAMANTE: string;
  DIRE_CASO: string;
  CODI_PEDIDO: string;
  ESTADO: string;
  SITIO_GRABA: number;
}

export interface DtoRecepcion {
  SITIO_GRABA: number;
  NUME_LLAMADA: number;
  HORA_CASO: string;
  NUME_TELEFONO: number;
  PROP_TELEFONO: string;
  NOMB_LLAMANTE: string;
  DIRE_LLAMANTE: string;
  TIPO_PEDIDO: string;
  CALI_PEDIDO: string;
  BARRIO: string;
  CIUDAD: string;
  DIRE_CASO: string;
  LATITUD_CASO: string;
  LONGITUD_CASO: string;
  COMENTARIO: string;
  CODI_PEDIDO: string;
  CODI_PEDIDO2: string;
  IMPORTANCIA: string;
  PRIORIDAD: string;
  DISP_TELEFONICO: string;
  OPERADOR: string;
  ESTADO: string;
  ENVIAR: string;
  CANALES_SELECCIONADOS: number[];
  CANAL_FUERZA: number | null;
  CADPEDI_SITIO_GRABA: string | null;
  CADPEDI_NUME_LLAMADA: string | null;
}

export interface RecepcionApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly base = `${environment.apiBaseUrl}/Recepcion`;

  constructor(private http: HttpClient) {}

  /** Poll for incoming call */
  getLlamada(): Observable<RecepcionApiResponse<DtoLlamadaEntrante | null>> {
    return this.http.get<RecepcionApiResponse<DtoLlamadaEntrante | null>>(
      `${this.base}/llamada`
    );
  }

  /** Allocate next call-sequence number */
  getConsecutivo(): Observable<RecepcionApiResponse<number>> {
    return this.http.post<RecepcionApiResponse<number>>(`${this.base}/consecutivo`, {});
  }

  /** Dispatch channels for the operator's site */
  getCanales(sitioGraba?: number): Observable<DtoCanalRecepcion[]> {
    const qs = sitioGraba != null ? `?sitioGraba=${sitioGraba}` : '';
    return this.http.get<DtoCanalRecepcion[]>(`${this.base}/canales${qs}`);
  }

  /** Reference catalog (TIPO_PEDIDO, CALI_PEDIDO, etc.) */
  getReferencias(nombre: string): Observable<DtoReferenciaSecad[]> {
    return this.http.get<DtoReferenciaSecad[]>(`${this.base}/referencias?nombre=${encodeURIComponent(nombre)}`);
  }

  /** Full-text case search */
  buscarCasos(busqueda: string): Observable<RecepcionApiResponse<DtoCasoItem[]>> {
    return this.http.post<RecepcionApiResponse<DtoCasoItem[]>>(
      `${this.base}/casos-intel`,
      { Busqueda: busqueda }
    );
  }

  /** Exact-code case lookup */
  getCasoPorCodigo(codigo: string): Observable<RecepcionApiResponse<DtoCasoItem | null>> {
    return this.http.post<RecepcionApiResponse<DtoCasoItem | null>>(
      `${this.base}/caso-por-codigo`,
      { Codigo: codigo }
    );
  }

  /** Recent calls eligible for association */
  buscarAsociar(dto: DtoBusquedaAsociarLlamada): Observable<RecepcionApiResponse<DtoLlamadaAsociar[]>> {
    return this.http.post<RecepcionApiResponse<DtoLlamadaAsociar[]>>(
      `${this.base}/buscar-asociar`,
      dto
    );
  }

  /** Save full reception form */
  guardar(datos: DtoRecepcion): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.base}/guardar`,
      datos
    );
  }

  /** Quick-close call */
  cerrarRapido(datos: DtoRecepcion): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.base}/cerrar-rapido`,
      datos
    );
  }
}
