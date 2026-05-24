import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

// ─── Constantes de dominio ─────────────────────────────────────────────────────

/** Clase de turno: correlación con horario oficial de vigilancia */
export const CLASE_TURNO = {
  PRIMERO:  1,   // 06:00 – 14:00
  SEGUNDO:  2,   // 14:00 – 22:00
  TERCERO:  3    // 22:00 – 06:00
} as const;
export type ClaseTurno = typeof CLASE_TURNO[keyof typeof CLASE_TURNO];

/** Estado del turno */
export const ESTADO_TURNO = {
  ACTIVO:  'A',
  CERRADO: 'C',
  ANULADO: 'V'
} as const;
export type EstadoTurno = typeof ESTADO_TURNO[keyof typeof ESTADO_TURNO];

/** Estado operativo de un medio en turno */
export const ESTADO_MEDIO = {
  LIBRE:           27,
  OCUPADO:         28,
  FUERA_SERVICIO:  29,
  EN_RUTA:         30,
  EN_BASE:         31
} as const;
export type EstadoMedio = typeof ESTADO_MEDIO[keyof typeof ESTADO_MEDIO];

/** Tipo de medio/recurso */
export const TIPO_MEDIO = {
  MOTOCICLETA:     20,
  BICICLETA:       21,
  PATRULLA:        22,
  AMBULANCIA:      23,
  CAMION_BOMBEROS: 24,
  HELICOPTERO:     25,
  LANCHA:          26
} as const;
export type TipoMedio = typeof TIPO_MEDIO[keyof typeof TIPO_MEDIO];

// ─── DTOs ──────────────────────────────────────────────────────────────────────

/** Ítem de la grilla de turnos (lista resumida) */
export interface DtoTurnoListItem {
  id:             number;
  claseTurno:     ClaseTurno;
  claseTurnoDesc: string;
  fuerzaDesc:     string;
  horaInicia:     string;   // dd/MM/yyyy HH:mm
  horaTermina:    string;
  estado:         EstadoTurno;
  totalUnidades:  number;
  totalMedios:    number;
  siviccSync:     boolean;
}

/** Detalle completo del turno (header) */
export interface DtoTurno {
  id:                 number;
  sitioGraba:         number;
  fuerzaId:           number;
  fuerzaDescripcion:  string;
  claseTurno:         ClaseTurno;
  claseTurnoDesc:     string;
  tipoTurno?:         number;
  tipoTurnoDesc:      string;
  horaInicia:         string;
  horaTermina:        string;
  diaInicia:          string;   // dd/MM/yyyy
  consignas?:         string;
  estado:             EstadoTurno;
  siviccSincronizado: boolean;
  siviccFechaSync?:   string;
  fechaCreacion:      string;
  usuarioCrea?:       string;
  totalUnidades:      number;
  totalMedios:        number;
}

/** Unidad/estación dentro de un turno */
export interface DtoTurnoUnidad {
  id:                 number;
  turnoId:            number;
  unidadCodigo:       string;
  unidadDesc:         string;
  fuerzaId?:          number;
  consignas?:         string;
  origen:             'MANUAL' | 'SIVICC';
  siviccMinutaId?:    number;
  siviccConsecutivo?: number;
  totalMedios:        number;
}

/** Policía asignado a un medio */
export interface DtoPersonalMedio {
  ceduEmpleado:    string;
  nombrePolicial?: string;
  descCargo?:      string;
}

/**
 * Medio disponible en turno — versión completa para el panel de despacho.
 * Incluye posición GPS y personal asignado.
 */
export interface DtoMedioDisponible {
  id:              number;
  sitioGraba:      number;
  turnoId:         number;
  turnoUnidadId?:  number;
  unidadCodigo?:   string;
  fuerzaId?:       number;

  // Canal de radio
  canalFuerzaId?:  number;
  canalCodigo?:    number;
  canalDesc:       string;

  // Identificación del recurso
  patrullaCodigo:  string;
  patrullaDesc:    string;
  tipoMedio:       TipoMedio;
  tipoMedioDesc:   string;

  // Estado operativo
  estado:          EstadoMedio;
  estadoDesc:      string;

  // Ubicación GPS (última posición GESPO)
  latitud?:        number;
  longitud?:       number;
  velocidadKmh?:   number;
  rumboGrados?:    number;
  fechaUbicacion?: string;
  /** true si la última posición tiene menos de 10 minutos */
  gpsActivo:       boolean;

  // Incidente activo (si estado es Ocupado/En ruta)
  eventoId?:       number;
  actuacionId?:    number;

  // Personal asignado
  personal:        DtoPersonalMedio[];

  // Distancia calculada al incidente activo
  distanciaKm?:    number;
}

/**
 * Versión reducida para polling rápido desde el panel de despacho.
 * Minimiza el payload enviado al cliente.
 */
export interface DtoMedioDisponibleResumen {
  id:              number;
  patrullaCodigo:  string;
  patrullaDesc:    string;
  tipoMedio:       TipoMedio;
  estado:          EstadoMedio;
  estadoDesc:      string;
  canalDesc:       string;
  lat?:            number;
  lng?:            number;
  gpsActivo:       boolean;
  eventoId?:       number;
  distanciaKm?:    number;
  /** "Cédula1 / Cédula2" — personal concatenado */
  personalResumen: string;
}

// ─── Request DTOs ──────────────────────────────────────────────────────────────

/** Request: crear un nuevo turno */
export interface DtoCrearTurnoRequest {
  sitioGraba:   number;
  fuerzaId:     number;
  claseTurno:   ClaseTurno;
  tipoTurno?:   number;
  /** Formato: dd/MM/yyyy HH:mm */
  horaInicia:   string;
  horaTermina:  string;
  consignas?:   string;
}

/** Request: copiar turno existente a nueva franja horaria */
export interface DtoCopiarTurnoRequest {
  turnoOrigenId: number;
  claseTurno:    ClaseTurno;
  tipoTurno?:    number;
  horaInicia:    string;
  horaTermina:   string;
}

/** Request: agregar unidad/estación al turno */
export interface DtoAgregarUnidadRequest {
  turnoId:           number;
  unidadCodigo:      string;
  unidadDesc?:       string;
  fuerzaId?:         number;
  consignas?:        string;
  origen?:           'MANUAL' | 'SIVICC';
  siviccMinutaId?:   number;
  siviccConsecutivo?: number;
}

/** Request: agregar medio/patrulla al turno */
export interface DtoAgregarMedioRequest {
  turnoId:        number;
  turnoUnidadId?: number;
  unidadCodigo?:  string;
  fuerzaId?:      number;
  canalFuerzaId?: number;
  canalCodigo?:   number;
  patrullaCodigo: string;
  patrullaDesc?:  string;
  tipoMedio:      TipoMedio;
  personal:       DtoPersonalMedio[];
}

/** Request: importar medios desde minuta SIVICC */
export interface DtoImportarSiviccRequest {
  turnoId:           number;
  siviccMinutaId:    number;
  siviccConsecutivo: number;
  canalCodigo?:      number;
  canalFuerzaId?:    number;
  fuerzaId:          number;
  sitioGraba:        number;
}

/** Request: cambiar estado operativo de un medio */
export interface DtoCambiarEstadoMedioRequest {
  nuevoEstado:   EstadoMedio;
  eventoId?:     number;
  actuacionId?:  number;
  observacion?:  string;
}

/** Posición GPS de una patrulla recibida desde GESPO */
export interface DtoGespoUbicacion {
  patrullaCodigo: string;
  latitud:        number;
  longitud:       number;
  velocidadKmh?:  number;
  rumboGrados?:   number;
  /** ISO-8601 */
  fechaGps:       string;
}

/** Respuesta genérica de operaciones sobre turnos */
export interface DtoTurnoResult {
  success: boolean;
  message: string;
  id:      number;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TurnosService {
  private readonly base = `${environment.apiBaseUrl}/Turnos`;

  constructor(private http: HttpClient) {}

  // ── Consultas — Turnos ────────────────────────────────────────────────────────

  /**
   * Lista los turnos de una fuerza en una fecha (dd/MM/yyyy).
   * Si se omite fecha, el backend retorna los del día actual.
   */
  getTurnos(
    fuerzaId:   number,
    fecha?:     string,
    sitioGraba: number = 1
  ): Observable<DtoTurnoListItem[]> {
    let params = new HttpParams().set('fuerzaId', fuerzaId).set('sitioGraba', sitioGraba);
    if (fecha) params = params.set('fecha', fecha);
    return this.http
      .get<{ success: boolean; data: DtoTurnoListItem[] }>(this.base, { params })
      .pipe(map(r => r.data));
  }

  /**
   * Detalle completo de un turno.
   */
  getTurno(id: number): Observable<DtoTurno> {
    return this.http
      .get<{ success: boolean; data: DtoTurno }>(`${this.base}/${id}`)
      .pipe(map(r => r.data));
  }

  /**
   * Lista las unidades/estaciones de un turno.
   */
  getUnidades(turnoId: number): Observable<DtoTurnoUnidad[]> {
    return this.http
      .get<{ success: boolean; data: DtoTurnoUnidad[] }>(`${this.base}/${turnoId}/unidades`)
      .pipe(map(r => r.data));
  }

  /**
   * Lista los medios/patrullas de un turno.
   * Opcionalmente filtra por turnoUnidadId para ver los de una unidad específica.
   */
  getMedios(turnoId: number, turnoUnidadId?: number): Observable<DtoMedioDisponible[]> {
    let params = new HttpParams();
    if (turnoUnidadId != null) params = params.set('turnoUnidadId', turnoUnidadId);
    return this.http
      .get<{ success: boolean; data: DtoMedioDisponible[] }>(
        `${this.base}/${turnoId}/medios`, { params }
      )
      .pipe(map(r => r.data));
  }

  // ── Panel de despacho (Módulo de Eventos) ─────────────────────────────────────

  /**
   * Retorna los recursos activos en turno para un canal de radio.
   * Versión completa — incluye GPS y personal.
   * Usada para cargar inicialmente el panel de despacho.
   */
  getRecursosCanal(
    canalCodigo: number,
    sitioGraba:  number = 1
  ): Observable<DtoMedioDisponible[]> {
    const params = new HttpParams().set('sitioGraba', sitioGraba);
    return this.http
      .get<{ success: boolean; data: DtoMedioDisponible[] }>(
        `${this.base}/canal/${canalCodigo}/recursos`, { params }
      )
      .pipe(map(r => r.data));
  }

  /**
   * Versión compacta de recursos activos por canal.
   * Usada para el polling periódico (cada 5-10 s) del panel de despacho.
   */
  getResumenRecursosCanal(
    canalCodigo: number,
    sitioGraba:  number = 1
  ): Observable<DtoMedioDisponibleResumen[]> {
    const params = new HttpParams().set('sitioGraba', sitioGraba);
    return this.http
      .get<{ success: boolean; data: DtoMedioDisponibleResumen[] }>(
        `${this.base}/canal/${canalCodigo}/recursos/resumen`, { params }
      )
      .pipe(map(r => r.data));
  }

  // ── Creación / edición de turnos ──────────────────────────────────────────────

  /**
   * Crea un nuevo turno de vigilancia.
   * Valida: duración 6-9h, unicidad clase_turno por día+fuerza, sin solapamiento.
   */
  crearTurno(req: DtoCrearTurnoRequest): Observable<DtoTurnoResult> {
    return this.http.post<DtoTurnoResult>(this.base, req);
  }

  /**
   * Copia un turno a una nueva franja horaria, duplicando toda la jerarquía.
   */
  copiarTurno(req: DtoCopiarTurnoRequest): Observable<DtoTurnoResult> {
    return this.http.post<DtoTurnoResult>(`${this.base}/copiar`, req);
  }

  // ── Unidades ──────────────────────────────────────────────────────────────────

  /**
   * Agrega una unidad/estación al turno de forma manual.
   */
  agregarUnidad(
    turnoId: number,
    req:     DtoAgregarUnidadRequest
  ): Observable<DtoTurnoResult> {
    return this.http.post<DtoTurnoResult>(`${this.base}/${turnoId}/unidades`, req);
  }

  // ── Medios disponibles ────────────────────────────────────────────────────────

  /**
   * Agrega un medio (patrulla/moto/etc.) al turno de forma manual.
   * Acepta hasta 2 policías en el campo `personal`.
   */
  agregarMedio(
    turnoId: number,
    req:     DtoAgregarMedioRequest
  ): Observable<DtoTurnoResult> {
    return this.http.post<DtoTurnoResult>(`${this.base}/${turnoId}/medios`, req);
  }

  /**
   * Importa medios y personal desde la minuta oficial SIVICC.
   * Marca el turno como sincronizado con SIVICC al finalizar.
   */
  importarSivicc(
    turnoId: number,
    req:     DtoImportarSiviccRequest
  ): Observable<DtoTurnoResult> {
    return this.http.post<DtoTurnoResult>(`${this.base}/${turnoId}/sivicc`, req);
  }

  // ── Estado de medios ──────────────────────────────────────────────────────────

  /**
   * Cambia el estado operativo de un medio en tiempo real.
   * Al asignar estado Ocupado (28) o En ruta (30), vincula al evento/actuación.
   * Al liberar (27/29/31), limpia la asociación de evento automáticamente.
   */
  cambiarEstadoMedio(
    medioId: number,
    req:     DtoCambiarEstadoMedioRequest
  ): Observable<DtoTurnoResult> {
    return this.http.put<DtoTurnoResult>(
      `${this.base}/medios/${medioId}/estado`,
      req
    );
  }

  /**
   * Envía un lote de posiciones GPS al backend para que actualice
   * las coordenadas de los medios en turno.
   * Retorna el número de medios efectivamente actualizados.
   */
  actualizarUbicacionesGespo(
    ubicaciones: DtoGespoUbicacion[]
  ): Observable<{ success: boolean; actualizados: number; total: number }> {
    return this.http.post<{ success: boolean; actualizados: number; total: number }>(
      `${this.base}/gespo/ubicaciones`,
      ubicaciones
    );
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────────

  /** Etiqueta legible para la clase de turno */
  etiquetaClaseTurno(clase: ClaseTurno): string {
    const map: Record<ClaseTurno, string> = {
      1: 'Primer Turno  (06:00 – 14:00)',
      2: 'Segundo Turno (14:00 – 22:00)',
      3: 'Tercer Turno  (22:00 – 06:00)'
    };
    return map[clase] ?? `Turno ${clase}`;
  }

  /** Etiqueta corta de clase de turno para chips/badges */
  etiquetaClaseTurnoCorta(clase: ClaseTurno): string {
    const map: Record<ClaseTurno, string> = { 1: '1°T', 2: '2°T', 3: '3°T' };
    return map[clase] ?? `T${clase}`;
  }

  /** Etiqueta legible para el estado del turno */
  etiquetaEstadoTurno(estado: EstadoTurno): string {
    const map: Record<EstadoTurno, string> = {
      A: 'Activo',
      C: 'Cerrado',
      V: 'Anulado'
    };
    return map[estado] ?? estado;
  }

  /** Etiqueta legible para el estado de un medio */
  etiquetaEstadoMedio(estado: EstadoMedio): string {
    const map: Record<EstadoMedio, string> = {
      27: 'Libre',
      28: 'Ocupado',
      29: 'Fuera de servicio',
      30: 'En ruta',
      31: 'En base'
    };
    return map[estado] ?? `Estado ${estado}`;
  }

  /** Clase CSS (badge/chip) para el estado de un medio */
  claseEstadoMedio(estado: EstadoMedio): string {
    const map: Record<EstadoMedio, string> = {
      27: 'badge-success',    // Libre  — verde
      28: 'badge-danger',     // Ocupado — rojo
      29: 'badge-dark',       // Fuera servicio — oscuro
      30: 'badge-warning',    // En ruta — amarillo
      31: 'badge-secondary'   // En base — gris
    };
    return map[estado] ?? '';
  }

  /** Icono Material para el tipo de medio */
  iconoTipoMedio(tipo: TipoMedio): string {
    const map: Record<TipoMedio, string> = {
      20: 'two_wheeler',         // Motocicleta
      21: 'pedal_bike',          // Bicicleta
      22: 'local_police',        // Patrulla
      23: 'local_hospital',      // Ambulancia
      24: 'fire_truck',          // Camión Bomberos
      25: 'flight',              // Helicóptero
      26: 'directions_boat'      // Lancha
    };
    return map[tipo] ?? 'directions_car';
  }

  /**
   * Formatea la distancia para mostrar en la UI.
   * < 1 km → en metros; >= 1 km → en km con 1 decimal.
   */
  formatearDistancia(km?: number): string {
    if (km == null) return '—';
    if (km < 1)     return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }
}
