// ...existing code...
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DtoPersonajeMes {
  idPersonajeMes: number;  
  identificacion: string;
  nombres: string;
  apellidos: string;
  grado: string;
  cargo: string;
  unidad: string;
  idCategoria: number;
  numeroActa: string;
  vigente: number;
  fotoModificada?: string | null;
  mes?: number;
  anio?: number;
  Mes?: number;
  Anio?: number;
  idPersonajeGrupo?: number;
}

type PersonajeMesApiResponse = Partial<DtoPersonajeMes> & {
  IdPersonajeMes?: number;
  Identificacion?: string;
  Nombres?: string;
  Apellidos?: string;
  Grado?: string;
  Cargo?: string;
  Unidad?: string;
  IdCategoria?: number;
  NumeroActa?: string;
  Vigente?: number;
  FotoModificada?: string | null;
};

export interface DtoPersonajeMesRequest {
    identificacion: string;
    nombres: string;
    apellidos: string;
    grado: string;
    cargo: string;
    unidad: string;
    IdCategoria: number;
    NumeroActa: string;
    FotoModificada?: string | null;
    Mes: number;
    Anio: number;
    IdPersonajeGrupo?: number;
 }

 export interface DtoPersonajeGrupoRequest {
    NombreGrupo: string;
    FotoGrupo?: string;
    NumeroActa: string;
    Mes: number;
    Anio: number;
 }

export interface DtoPersonajeMesResult {
  success: boolean;
  message: string;
  id?: number;
}

export interface DtoUploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  message: string;
}

export interface DtoPersonajeMesBulkResult {
  success: boolean;
  message: string;
  totalProcesados?: number;
  totalExitosos?: number;
}

export const CATEGORIA_PRIORIDAD: Record<string, number> = {
  'oficial': 1,
  'suboficial': 2,
  'nivel ejecutivo': 3,
  'patrullero': 4,
  'agente': 5,
  'estudiante': 6,
  'auxiliar': 7,
  'no uniformado': 8,
};

const CATEGORIA_CLAVE: Record<string, string> = {
  'oficiales': 'oficial',
  'suboficial': 'suboficial',
  'mandos de nivel ejecutivo': 'nivel ejecutivo',
  'nivel ejecutivo': 'nivel ejecutivo',
  'patrulleros': 'patrullero',
  'agentes': 'agente',
  'estudiantes': 'estudiante',
  'auxiliares de policia': 'auxiliar',
  'no uniformados': 'no uniformado',
};

export const GRADO_ORDEN_OFICIAL = [
  'General',
  'Teniente General',
  'Mayor General',
  'Brigadier General',
  'Coronel',
  'Teniente Coronel',
  'Mayor',
  'Capitán',
  'Teniente',
  'Subteniente',
];

export const GRADO_ORDEN_SUBOFICIAL = [
  'Sargento Mayor',
  'Sargento Primero',
  'Sargento Viceprimero',
  'Sargento Segundo',
  'Cabo Primero',
  'Cabo Segundo',
];

export const GRADO_ORDEN_NIVEL_EJECUTIVO = [
  'Comisario',
  'Subcomisario',
  'Intendente Jefe',
  'Intendente',
  'Subintendente',
];

export const GRADO_ORDEN_PATRULLEROS = [
  'Patrullero',
  'Patrullero De Policía',
];

export function getCategoriaClaveYPrioridad(descripcion: string): { clave: string; prioridad: number } {
  let d = (descripcion ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  d = d.replace(/^categoria\s+/, '').trim();
  const clave = CATEGORIA_CLAVE[d] ?? '';
  return { clave, prioridad: CATEGORIA_PRIORIDAD[clave] ?? 99 };
}

export function getGradoOrdenEnCategoria(grado: string, claveCategoria: string): number {
  const g = (grado ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const GRADO_INDICES: Record<string, string[]> = {
    'oficial': GRADO_ORDEN_OFICIAL.map(r => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
    'suboficial': GRADO_ORDEN_SUBOFICIAL.map(r => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
    'nivel ejecutivo': GRADO_ORDEN_NIVEL_EJECUTIVO.map(r => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
    'patrullero': GRADO_ORDEN_PATRULLEROS.map(r => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
  };

  const ordenes = GRADO_INDICES[claveCategoria];
  if (!ordenes) return 999;
  const idx = ordenes.findIndex(r => g === r);
  return idx >= 0 ? idx : 999;
}

export function sortPersonajesMes(lista: DtoPersonajeMes[], categorias: { idDominio: number; descripcion: string }[]): DtoPersonajeMes[] {
  const mapaCategorias = new Map<number, string>();
  for (const cat of categorias) {
    mapaCategorias.set(Number(cat.idDominio), cat.descripcion ?? '');
  }

  return lista.slice().sort((a, b) => {
    const catA = mapaCategorias.get(Number(a.idCategoria)) ?? '';
    const catB = mapaCategorias.get(Number(b.idCategoria)) ?? '';

    const { clave: claveA, prioridad: prioA } = getCategoriaClaveYPrioridad(catA);
    const { clave: claveB, prioridad: prioB } = getCategoriaClaveYPrioridad(catB);
    if (prioA !== prioB) return prioA - prioB;

    const ordGradoA = getGradoOrdenEnCategoria(a.grado ?? '', claveA);
    const ordGradoB = getGradoOrdenEnCategoria(b.grado ?? '', claveB);
    if (ordGradoA !== ordGradoB) return ordGradoA - ordGradoB;

    return `${a.nombres ?? ''} ${a.apellidos ?? ''}`.localeCompare(`${b.nombres ?? ''} ${b.apellidos ?? ''}`);
  });
}

@Injectable({ providedIn: 'root' })
export class PersonajeMesService {
    /**
     * Obtiene los personajes del mes asociados a un grupo específico
     */
    getByGrupo(idGrupo: number) {
      return this.http.get<DtoPersonajeMes[]>(`${this.baseUrl}?idPersonajeGrupo=${idGrupo}`);
    }
  private readonly baseUrl = `${environment.apiBaseUrl}/PersonajeMes`;
  private readonly uploadUrl = `${environment.apiBaseUrl}/PersonajeMesUpload`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DtoPersonajeMes[]> {
    return this.http.get<PersonajeMesApiResponse[]>(this.baseUrl).pipe(
      map((items) => (items ?? []).map((item) => this.normalizeItem(item)))
    );
  }

  private normalizeItem(item: PersonajeMesApiResponse | null | undefined): DtoPersonajeMes {
    const mes = Number(item?.mes ?? item?.Mes ?? 0);
    const anio = Number(item?.anio ?? item?.Anio ?? 0);

    return {
      idPersonajeMes: Number(item?.idPersonajeMes ?? item?.IdPersonajeMes ?? 0),
      identificacion: item?.identificacion ?? item?.Identificacion ?? '',
      nombres: item?.nombres ?? item?.Nombres ?? '',
      apellidos: item?.apellidos ?? item?.Apellidos ?? '',
      grado: item?.grado ?? item?.Grado ?? '',
      cargo: item?.cargo ?? item?.Cargo ?? '',
      unidad: item?.unidad ?? item?.Unidad ?? '',
      idCategoria: Number(item?.idCategoria ?? item?.IdCategoria ?? 0),
      numeroActa: item?.numeroActa ?? item?.NumeroActa ?? '',
      vigente: Number(item?.vigente ?? item?.Vigente ?? 0),
      fotoModificada: item?.fotoModificada ?? item?.FotoModificada ?? null,
      mes,
      anio,
      Mes: mes,
      Anio: anio,
      idPersonajeGrupo: typeof (item as any)?.IdPersonajeGrupo !== 'undefined' ? Number((item as any)?.IdPersonajeGrupo) : (typeof item?.idPersonajeGrupo !== 'undefined' ? Number(item?.idPersonajeGrupo) : 0)
    };
  }

  create(payload: DtoPersonajeMesRequest): Observable<DtoPersonajeMesResult> {
    return this.http.post<DtoPersonajeMesResult>(this.baseUrl, payload);
  }

  update(id: number, payload: DtoPersonajeMesRequest): Observable<DtoPersonajeMesResult> {
    return this.http.put<DtoPersonajeMesResult>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<DtoPersonajeMesResult> {
    return this.http.delete<DtoPersonajeMesResult>(`${this.baseUrl}/${id}`);
  }

  setVigente(id: number, vigente: number): Observable<DtoPersonajeMesResult> {
    return this.http.put<DtoPersonajeMesResult>(`${this.baseUrl}/${id}/vigente`, { vigente });
  }

uploadImage(file: File): Observable<DtoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DtoUploadResponse>(`${this.uploadUrl}/imagen`, formData);
  }

   createBulk(items: DtoPersonajeMesRequest[]): Observable<DtoPersonajeMesBulkResult> {
     return this.http.post<DtoPersonajeMesBulkResult>(`${this.baseUrl}/Bulk`, { items });
   }

   createGrupo(request: DtoPersonajeGrupoRequest): Observable<DtoPersonajeMesResult> {
     return this.http.post<DtoPersonajeMesResult>(`${this.baseUrl}/grupo`, request);
   }

  getAllGrupo(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/grupo`);
  }
}
