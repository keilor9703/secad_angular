import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DtoRadioEmisora {
  idEmisora: number;
  nombre: string;
  streamUrl: string;
  logoUrl?: string | null;
  orden: number;
  activo: number;
}

export interface DtoRadioEmisoraRequest {
  nombre: string;
  streamUrl: string;
  logoUrl?: string | null;
  orden: number;
  activo?: number | null;
}

export interface DtoRadioEstadoRequest {
  activo: number;
}

export interface RadioApiResponse {
  id: number;
  success: boolean;
  message: string;
}

export interface RadioLogoUploadResponse {
  success: boolean;
  fileName: string;
  url: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class RadioService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Radio`;

  constructor(private http: HttpClient) {}

  getPublicas(): Observable<DtoRadioEmisora[]> {
    return this.http.get<DtoRadioEmisora[]>(this.baseUrl);
  }

  getAdmin(): Observable<DtoRadioEmisora[]> {
    return this.http.get<DtoRadioEmisora[]>(`${this.baseUrl}/admin`);
  }

  getById(id: number): Observable<DtoRadioEmisora> {
    return this.http.get<DtoRadioEmisora>(`${this.baseUrl}/${id}`);
  }

  create(payload: DtoRadioEmisoraRequest): Observable<RadioApiResponse> {
    return this.http.post<RadioApiResponse>(this.baseUrl, payload);
  }

  update(id: number, payload: DtoRadioEmisoraRequest): Observable<RadioApiResponse> {
    return this.http.put<RadioApiResponse>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: number): Observable<RadioApiResponse> {
    return this.http.delete<RadioApiResponse>(`${this.baseUrl}/${id}`);
  }

  setActivo(id: number, activo: number): Observable<RadioApiResponse> {
    const payload: DtoRadioEstadoRequest = { activo };
    return this.http.put<RadioApiResponse>(`${this.baseUrl}/${id}/activo`, payload);
  }

  uploadLogo(file: File): Observable<RadioLogoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<RadioLogoUploadResponse>(`${this.baseUrl}/upload-logo`, formData);
  }
}
