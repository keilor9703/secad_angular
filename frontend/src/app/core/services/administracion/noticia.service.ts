import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DtoNoticia {
  idNoticia: number;
  unidad: string;
  titulo: string;
  seccion: string;
  ciudad: string;
  imagenNoticia?: string | null;
  subtitulo?: string | null;
  contenido?: string | null;
  vigente: number;
  fechaCreacion: string;
  usuarioCreacion: string;
  maquinaCreacion?: string | null;
  fechaModifica?: string | null;
  usuarioModifica?: string | null;
  maquinaModifica?: string | null;
}

export interface DtoNoticiaRequest {
  unidad: string;
  titulo: string;
  seccion: string;
  ciudad: string;
  imagenNoticia?: string | null;
  subtitulo?: string | null;
  contenido?: string | null;
}

export interface DtoNoticiaApiResponse {
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
export class NoticiaService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Noticia`;
  private readonly uploadUrl = `${environment.apiBaseUrl}/NoticiaUpload`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DtoNoticia[]> {
    return this.http.get<DtoNoticia[]>(this.baseUrl);
  }

  getActivas(): Observable<DtoNoticia[]> {
    return this.http.get<DtoNoticia[]>(`${this.baseUrl}/activas`);
  }

  getById(id: number): Observable<DtoNoticia> {
    return this.http.get<DtoNoticia>(`${this.baseUrl}/${id}`);
  }

  create(payload: DtoNoticiaRequest): Observable<DtoNoticiaApiResponse> {
    return this.http.post<DtoNoticiaApiResponse>(this.baseUrl, payload);
  }

  update(id: number, payload: DtoNoticiaRequest): Observable<DtoNoticiaApiResponse> {
    return this.http.put<DtoNoticiaApiResponse>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<DtoNoticiaApiResponse> {
    return this.http.delete<DtoNoticiaApiResponse>(`${this.baseUrl}/${id}`);
  }

  uploadImage(file: File): Observable<DtoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DtoUploadResponse>(`${this.uploadUrl}/imagen`, formData);
  }
}