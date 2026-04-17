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

@Injectable({ providedIn: 'root' })
export class PersonajeMesService {
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
      Anio: anio
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
}
