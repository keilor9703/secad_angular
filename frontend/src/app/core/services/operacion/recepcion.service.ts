import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ─── Constantes de origen (deben coincidir con el CHECK en cad_eventos.origen) ─
export const ORIGEN_EVENTO = {
  CTI:         'CTI',
  RECEPCION:   'RECEPCION',
  APP_MOVIL:   'APP_MOVIL',
  INTEGRACION: 'INTEGRACION',
  SIEDCO:      'SIEDCO',
  INTERNO:     'INTERNO',
  MANUAL:      'MANUAL'
} as const;
export type OrigenEvento = typeof ORIGEN_EVENTO[keyof typeof ORIGEN_EVENTO];

// ─── Constantes de estado del evento ────────────────────────────────────────────
export const ESTADO_EVENTO = {
  PENDIENTE:  'P',
  DESPACHADO: 'D',
  ATENDIDO:   'A',
  CERRADO:    'C',
  ANULADO:    'V'
} as const;
export type EstadoEvento = typeof ESTADO_EVENTO[keyof typeof ESTADO_EVENTO];

// ─── DTOs de recepción ───────────────────────────────────────────────────────────

export interface DtoLlamadaEntrante {
  NUME_LLAMADA:  number;
  NUME_TELEFONO: number;
  CORDX:         string;
  CORDY:         string;
  TIPOSHAPE:     string;
  RADIO:         number;
  FECHAGMLC:     string;
  OPERADOR:      string;
}

export interface DtoCasoItem {
  CODIGO_CASO:             string;
  DESCRIPCION_CASO:        string;
  /** ID (string) de la categoría del Asistente vinculada. Null = sin asistente. */
  ID_CATEGORIA_ASISTENTE?: string | null;
  /** Código corto de la categoría (ej: HURTO, RINA). Usado para seleccionar plantilla narrativa. */
  CATEGORIA_CODIGO?:       string | null;
  /** Descripción legible de la categoría (JOIN informativo). */
  CATEGORIA_DESCRIPCION?:  string | null;
}

export interface DtoCanalRecepcion {
  codigo:        number;
  descripcion:   string;
  fuerza:        string;
  seleccionado?: boolean;   // UI only — no se envía al backend
}

export interface DtoReferenciaSecad {
  Nombre:      string;
  Codigo:      string;
  Descripcion: string;
  Abreviatura: string;
}

export interface DtoBusquedaAsociarLlamada {
  sitioGraba:  number;
  horaCaso:    string;
  numeLlamada: number;
}

export interface DtoLlamadaAsociar {
  NUME_LLAMADA:  number;
  HORA_CASO:     string;
  NUME_TELEFONO: number;
  CALI_PEDIDO:   string;
  CIUDAD:        string;
  NOMB_LLAMANTE: string;
  DIRE_CASO:     string;
  CODI_PEDIDO:   string;
  ESTADO:        string;
  SITIO_GRABA:   number;
}

export interface DtoRecepcion {
  SITIO_GRABA:          number;
  NUME_LLAMADA:         number;
  HORA_CASO:            string;
  NUME_TELEFONO:        number;
  PROP_TELEFONO:        string;
  NOMB_LLAMANTE:        string;
  DIRE_LLAMANTE:        string;
  TIPO_PEDIDO:          string;
  CALI_PEDIDO:          string;
  BARRIO:               string;
  CIUDAD:               string;
  DIRE_CASO:            string;
  LATITUD_CASO:         string;
  LONGITUD_CASO:        string;
  COMENTARIO:           string;
  CODI_PEDIDO:          string;
  CODI_PEDIDO2:         string;
  IMPORTANCIA:          string;
  PRIORIDAD:            string;
  DISP_TELEFONICO:      string;
  OPERADOR:             string;
  ESTADO:               string;
  ENVIAR:               string;
  /** Origen del evento a registrar. Por defecto 'RECEPCION'; usar 'CTI' si la
   *  llamada llega de la centralita telefónica, 'APP_MOVIL', etc. */
  Origen:               OrigenEvento;
  CANALES_SELECCIONADOS: number[];
  CANAL_FUERZA:         number | null;
  CADPEDI_SITIO_GRABA:  string | null;
  CADPEDI_NUME_LLAMADA: string | null;
}

export interface RecepcionApiResponse<T = unknown> {
  success: boolean;
  data:    T;
  message: string;
}

// ─── DTOs de eventos ─────────────────────────────────────────────────────────────

export interface DtoCodigoCierreEvento {
  orden:            number;
  codigoCierre:     string;
  tipoCodigo:       'CIERRE' | 'DISPOSICION' | 'NOVEDAD';
  descripcionLibre?: string;
}

export interface DtoEvento {
  id:                   number;
  sitioGraba:           number;
  origen:               OrigenEvento;
  origenReferenciaExt?: string;
  integracionClienteId?: number;
  integracionNombre?:   string;
  pedidoId?:            number;
  pedidoSitioGraba?:    number;
  horaCasoPedido:       string;
  direccionCaso:        string;
  codiPedido:           string;
  caliPedido:           string;
  fuerzaId?:            number;
  fuerzaDescripcion:    string;
  canalCodigo?:         number;
  canalDescripcion:     string;
  ceduEmpleado?:        string;
  usuarioGenera:        string;
  tipoDespachador?:     string;
  estado:               EstadoEvento;
  fechaCreacion:        string;
  fechaDespacho?:       string;
  fechaLlegada?:        string;
  fechaCierre?:         string;
  codigoCierrePrimario?: string;
  clasifCierre?:        string;
  observacionCierre?:   string;
  codigosCierre:        DtoCodigoCierreEvento[];
}

export interface DtoEventoListItem {
  id:            number;
  origen:        OrigenEvento;
  estado:        EstadoEvento;
  pedidoId?:     number;
  direccionCaso: string;
  codiPedido:    string;
  caliPedido:    string;
  fuerzaDesc:    string;
  canalDesc:     string;
  fechaCreacion: string;
  fechaDespacho?: string;
  fechaCierre?:   string;
}

export interface DtoCierreEventoRequest {
  eventoId:          number;
  estado:            'C' | 'V';
  clasifCierre?:     string;
  observacionCierre?: string;
  codigosCierre:     DtoCodigoCierreEvento[];
}

export interface DtoEventoIntegracionRequest {
  origen:               OrigenEvento;
  integracionClienteId: number;
  origenReferenciaExt?: string;
  sitioGraba:           number;
  direccionCaso:        string;
  ciudad:               string;
  barrio:               string;
  latitudCaso?:         string;
  longitudCaso?:        string;
  codiPedido:           string;
  caliPedido:           string;
  comentario:           string;
  nombReportante:       string;
  telefonoReportante?:  string;
  canalesSugeridos:     number[];
}

export interface DtoEventoResult {
  success:  boolean;
  message:  string;
  eventoId: number;
  pedidoId?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly base = `${environment.apiBaseUrl}/Recepcion`;

  constructor(private http: HttpClient) {}

  // ── CTI / Incoming call ──────────────────────────────────────────────────────

  /** Poll para llamada entrante desde centralita */
  getLlamada(): Observable<RecepcionApiResponse<DtoLlamadaEntrante | null>> {
    return this.http.get<RecepcionApiResponse<DtoLlamadaEntrante | null>>(
      `${this.base}/llamada`
    );
  }

  /** Genera un ID Snowflake para la llamada (sin round-trip a BD) */
  getConsecutivo(): Observable<RecepcionApiResponse<number>> {
    return this.http.post<RecepcionApiResponse<number>>(`${this.base}/consecutivo`, {});
  }

  // ── Catalogs ─────────────────────────────────────────────────────────────────

  getCanales(sitioGraba?: number): Observable<DtoCanalRecepcion[]> {
    const qs = sitioGraba != null ? `?sitioGraba=${sitioGraba}` : '';
    return this.http.get<DtoCanalRecepcion[]>(`${this.base}/canales${qs}`);
  }

  getReferencias(nombre: string): Observable<DtoReferenciaSecad[]> {
    return this.http.get<DtoReferenciaSecad[]>(
      `${this.base}/referencias?nombre=${encodeURIComponent(nombre)}`
    );
  }

  buscarCasos(busqueda: string): Observable<RecepcionApiResponse<DtoCasoItem[]>> {
    return this.http.post<RecepcionApiResponse<DtoCasoItem[]>>(
      `${this.base}/casos-intel`,
      { Busqueda: busqueda }
    );
  }

  getCasoPorCodigo(codigo: string): Observable<RecepcionApiResponse<DtoCasoItem | null>> {
    return this.http.post<RecepcionApiResponse<DtoCasoItem | null>>(
      `${this.base}/caso-por-codigo`,
      { Codigo: codigo }
    );
  }

  buscarAsociar(dto: DtoBusquedaAsociarLlamada): Observable<RecepcionApiResponse<DtoLlamadaAsociar[]>> {
    return this.http.post<RecepcionApiResponse<DtoLlamadaAsociar[]>>(
      `${this.base}/buscar-asociar`,
      dto
    );
  }

  // ── Save / close ─────────────────────────────────────────────────────────────

  /** Guarda la llamada completa. Escribe en cad_pedidos + cad_eventos + cad_pedidos_canales */
  guardar(datos: DtoRecepcion): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.base}/guardar`,
      datos
    );
  }

  /** Cierre rápido: crea pedido + evento anulado sin despachar */
  cerrarRapido(datos: DtoRecepcion): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.base}/cerrar-rapido`,
      datos
    );
  }

  // ── Event lifecycle (usado desde módulo Eventos — despachador) ────────────────

  /** Detalle completo de un evento con sus códigos de cierre */
  getEvento(id: number): Observable<{ success: boolean; data: DtoEvento }> {
    return this.http.get<{ success: boolean; data: DtoEvento }>(
      `${this.base}/evento/${id}`
    );
  }

  /** Eventos asociados a un pedido (llamada) */
  getEventosPorPedido(pedidoId: number): Observable<{ success: boolean; data: DtoEventoListItem[] }> {
    return this.http.get<{ success: boolean; data: DtoEventoListItem[] }>(
      `${this.base}/evento/pedido/${pedidoId}`
    );
  }

  /** Marca el evento como Despachado (D) o Atendido (A) */
  actualizarEstadoEvento(id: number, estado: 'D' | 'A'): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.base}/evento/${id}/estado`,
      { Estado: estado }
    );
  }

  /** Cierra el evento con uno o más códigos de cierre */
  cerrarEvento(req: DtoCierreEventoRequest): Observable<DtoEventoResult> {
    return this.http.post<DtoEventoResult>(
      `${this.base}/evento/cerrar`,
      req
    );
  }

  // ── External integration ──────────────────────────────────────────────────────

  /** Crea un evento desde un sistema externo (app móvil, API, SIEDCO, etc.) */
  crearEventoIntegracion(req: DtoEventoIntegracionRequest): Observable<DtoEventoResult> {
    return this.http.post<DtoEventoResult>(
      `${this.base}/integracion/evento`,
      req
    );
  }
}
