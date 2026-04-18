import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DtoVideoInstitucional {
  idVideoInst: number;
  titulo: string;
  descripcion?: string | null;
  urlYoutube: string;
  embedUrl: string;
  vigente: number;
  usuarioCreacion: string;
  fechaCreacion: string;
  usuarioModifica?: string | null;
  maquinaModifica?: string | null;
  fechaModifica?: string | null;
}

export interface DtoVideoInstitucionalRequest {
  titulo: string;
  descripcion?: string | null;
  urlYoutube: string;
}

export interface VideoInstitucionalApiResponse {
  success: boolean;
  message: string;
  id?: number;
}

export interface VideoInstitucionalCurrentResponse {
  hasVideo: boolean;
  data?: DtoVideoInstitucional;
}

@Injectable({ providedIn: 'root' })
export class VideoInstitucionalService {
  private readonly baseUrl = `${environment.apiBaseUrl}/VideoInstitucional`;

  constructor(private http: HttpClient) {}

  getCurrent(): Observable<VideoInstitucionalCurrentResponse> {
    return this.http.get<VideoInstitucionalCurrentResponse>(`${this.baseUrl}/current`);
  }

  create(payload: DtoVideoInstitucionalRequest): Observable<VideoInstitucionalApiResponse> {
    return this.http.post<VideoInstitucionalApiResponse>(this.baseUrl, payload);
  }

  update(id: number, payload: DtoVideoInstitucionalRequest): Observable<VideoInstitucionalApiResponse> {
    return this.http.put<VideoInstitucionalApiResponse>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<VideoInstitucionalApiResponse> {
    return this.http.delete<VideoInstitucionalApiResponse>(`${this.baseUrl}/${id}`);
  }
}
