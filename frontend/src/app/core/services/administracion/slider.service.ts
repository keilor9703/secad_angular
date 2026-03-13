import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DtoSliders {
  idSlider: number;
  titulo?: string | null;
  subtitulo?: string | null;
  urlImagen?: string | null;
  urlDestino?: string | null;
  orden: number;
  vigente: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface DtoSaveSliderRequest {
  idSlider?: number | null;
  titulo: string;
  subtitulo?: string | null;
  urlImagen: string;
  urlDestino?: string | null;
  orden: number;
  vigente: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface DtoSetEstadoSliderRequest {
  idSlider: number;
  vigente: number;
}

export interface SliderApiResponse {
  success: boolean;
  id: number;
  message: string;
  detail?: string;
}

export interface SliderUploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  message: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class SliderService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Slider`;

  constructor(private http: HttpClient) {}

  getPublicos(): Observable<DtoSliders[]> {
    return this.http.get<DtoSliders[]>(`${this.baseUrl}/Publicos`);
  }

  getAdmin(): Observable<DtoSliders[]> {
    return this.http.get<DtoSliders[]>(this.baseUrl);
  }

  save(payload: DtoSaveSliderRequest): Observable<SliderApiResponse> {
    return this.http.post<SliderApiResponse>(this.baseUrl, payload);
  }

  setEstado(payload: DtoSetEstadoSliderRequest): Observable<SliderApiResponse> {
    return this.http.patch<SliderApiResponse>(`${this.baseUrl}/Estado`, payload);
  }

  upload(file: File): Observable<SliderUploadResponse> {
    const formData = new FormData();
    formData.append('File', file);
    return this.http.post<SliderUploadResponse>(`${this.baseUrl}/Upload`, formData);
  }
}

