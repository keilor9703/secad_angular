import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── Constantes de estado de actuación ────────────────────────────────────────
export const ESTADO_ACTUACION = {
  PENDIENTE:  'P',   // asignada, sin despachar
  DESPACHADA: 'D',   // unidad en camino
  ATENDIDA:   'A',   // unidad en el lugar del hecho
  CERRADA:    'C',   // actuación finalizada
  ANULADA:    'V'    // no fue necesaria / error
} as const;
export type EstadoActuacion = typeof ESTADO_ACTUACION[keyof typeof ESTADO_ACTUACION];

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface DtoCodigoCierreActuacion {
  orden:             number;
  codigoCierre:      string;
  tipoCodigo:        'CIERRE' | 'DISPOSICION' | 'NOVEDAD';
  descripcionLibre?: string;
}

export interface DtoActuacionUnidad {
  id:               number;
  unidadCodigo:     string;
  placa?:           string;
  tipoUnidad?:      string;
  estado:           'D' | 'A' | 'L' | 'V';
  fechaDespacho?:   string;
  fechaLlegada?:    string;
  fechaLiberacion?: string;
  observacion?:     string;
}

export interface DtoActuacionNota {
  id:               number;
  nota:             string;
  tipoNota:         'GENERAL' | 'NOVEDAD' | 'ALERTA' | 'CIERRE';
  usuarioRegistra:  string;
  fechaRegistra:    string;
}

/** DTO completo — usado en el panel de detalle del despachador */
export interface DtoActuacion {
  id:                    number;
  eventoId:              number;
  pedidoId?:             number;
  sitioGraba:            number;
  fuerzaId?:             number;
  canalCodigo?:          number;
  fuerzaDescripcion:     string;
  canalDescripcion:      string;
  despachadorUsuario?:   string;
  tipoDespachador?:      string;
  unidadAsignada?:       string;
  placaUnidad?:          string;
  estado:                EstadoActuacion;
  fechaCreacion:         string;
  fechaDespacho?:        string;
  fechaLlegada?:         string;
  fechaCierre?:          string;
  codigoCierrePrimario?: string;
  clasifCierre?:         string;
  observacionCierre?:    string;
  caliPedido?:           string;
  fechaModificacion?:    string;
  usuarioModifica?:      string;
  codigosCierre:         DtoCodigoCierreActuacion[];
  unidades:              DtoActuacionUnidad[];
  notas:                 DtoActuacionNota[];
}

/** Item reducido para la grilla de actuaciones de un evento */
export interface DtoActuacionListItem {
  id:              number;
  eventoId:        number;
  fuerzaDesc:      string;
  canalDesc:       string;
  unidadAsignada?: string;
  estado:          EstadoActuacion;
  fechaCreacion:   string;
  fechaDespacho?:  string;
  fechaLlegada?:   string;
  fechaCierre?:    string;
  caliPedido?:     string;
  totalUnidades?:  number;
  totalNotas?:     number;
}

/** Request: avanzar estado operativo (D o A) */
export interface DtoActualizarEstadoActuacionRequest {
  estado:          'D' | 'A';
  unidadAsignada?: string;
  placaUnidad?:    string;
}

/** Request: cerrar la actuación con códigos */
export interface DtoCierreActuacionRequest {
  estado:             'C' | 'V';
  clasifCierre?:      string;
  observacionCierre?: string;
  codigosCierre:      DtoCodigoCierreActuacion[];
}

/** Request: agregar nota de campo */
export interface DtoAgregarNotaActuacionRequest {
  nota:     string;
  tipoNota: 'GENERAL' | 'NOVEDAD' | 'ALERTA' | 'CIERRE';
}

/** Request: registrar unidad adicional */
export interface DtoAgregarUnidadActuacionRequest {
  unidadCodigo: string;
  placa?:       string;
  tipoUnidad?:  string;
  observacion?: string;
}

/** Respuesta genérica de operaciones sobre actuaciones */
export interface DtoActuacionResult {
  success:     boolean;
  message:     string;
  actuacionId: number;
  subId?:      number;  // ID del sub-registro creado (nota, unidad)
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ActuacionesService {
  private readonly base = `${environment.apiBaseUrl}/Actuaciones`;

  constructor(private http: HttpClient) {}

  // ── Consultas ─────────────────────────────────────────────────────────────────

  /**
   * Lista todas las actuaciones de un evento (una por agencia/canal).
   * Incluye conteo de notas y unidades por actuación.
   */
  getActuacionesEvento(eventoId: number): Observable<{ success: boolean; data: DtoActuacionListItem[] }> {
    return this.http.get<{ success: boolean; data: DtoActuacionListItem[] }>(
      `${this.base}/evento/${eventoId}`
    );
  }

  /**
   * Detalle completo de una actuación: datos base + códigos + unidades + notas.
   */
  getActuacion(id: number): Observable<{ success: boolean; data: DtoActuacion }> {
    return this.http.get<{ success: boolean; data: DtoActuacion }>(
      `${this.base}/${id}`
    );
  }

  // ── Ciclo operativo ───────────────────────────────────────────────────────────

  /**
   * Marca la actuación como Despachada (D) o Atendida (A).
   * Registra automáticamente el timestamp correspondiente.
   */
  actualizarEstado(
    id: number,
    req: DtoActualizarEstadoActuacionRequest
  ): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.base}/${id}/estado`,
      req
    );
  }

  /**
   * Cierra la actuación (C=Cerrada / V=Anulada) con sus códigos.
   * El trigger de BD recalcula el estado global del evento.
   */
  cerrarActuacion(
    id: number,
    req: DtoCierreActuacionRequest
  ): Observable<DtoActuacionResult> {
    return this.http.post<DtoActuacionResult>(
      `${this.base}/${id}/cerrar`,
      req
    );
  }

  // ── Sub-registros ─────────────────────────────────────────────────────────────

  /**
   * Agrega una nota de campo a la actuación.
   * tipoNota: GENERAL | NOVEDAD | ALERTA | CIERRE
   */
  agregarNota(
    id: number,
    req: DtoAgregarNotaActuacionRequest
  ): Observable<DtoActuacionResult> {
    return this.http.post<DtoActuacionResult>(
      `${this.base}/${id}/notas`,
      req
    );
  }

  /**
   * Registra una unidad adicional despachada dentro de la actuación.
   * Usar cuando la agencia envía más de un recurso al mismo incidente.
   */
  agregarUnidad(
    id: number,
    req: DtoAgregarUnidadActuacionRequest
  ): Observable<DtoActuacionResult> {
    return this.http.post<DtoActuacionResult>(
      `${this.base}/${id}/unidades`,
      req
    );
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────────

  /** Etiqueta legible para el estado de una actuación */
  etiquetaEstado(estado: EstadoActuacion): string {
    const map: Record<EstadoActuacion, string> = {
      P: 'Pendiente',
      D: 'En camino',
      A: 'En sitio',
      C: 'Cerrada',
      V: 'Anulada'
    };
    return map[estado] ?? estado;
  }

  /** Clase CSS para el badge de estado */
  claseEstado(estado: EstadoActuacion): string {
    const map: Record<EstadoActuacion, string> = {
      P: 'badge-warning',
      D: 'badge-info',
      A: 'badge-success',
      C: 'badge-secondary',
      V: 'badge-danger'
    };
    return map[estado] ?? '';
  }
}
