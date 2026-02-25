import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface VideoUnidadInfo {
  hasVideo: boolean;
  url: string;
  fileName: string;
  sizeBytes: number;
  lastModifiedUtc?: string | null;
}

export interface VideoUnidadUploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  sizeBytes: number;
  message: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class VideoUnidadService {
  private readonly baseUrl = `${environment.apiBaseUrl}/VideoUnidad`;

  constructor(private http: HttpClient) {}

  getCurrent(): Observable<VideoUnidadInfo> {
    return this.http.get<VideoUnidadInfo>(`${this.baseUrl}/current`);
  }

  upload(file: File): Observable<VideoUnidadUploadResponse> {
    const formData = new FormData();
    formData.append('File', file);
    return this.http.post<VideoUnidadUploadResponse>(`${this.baseUrl}/upload`, formData);
  }
}
