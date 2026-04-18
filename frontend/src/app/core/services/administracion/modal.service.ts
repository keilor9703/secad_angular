import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface DtoModal {
  idModal: number;
  titulo: string;
  descripcion: string;
  tipoRecurso: string;
  rutaRecurso: string;
  tipoAccion: string;
  fechaInicio: string;
  fechaFin: string;
  unidad: string;
  orden: number;
  conteoVistas: number;
  conteoAceptados: number;
  conteoCerrados: number;
  vigente: number;
  fechaCreacion: string;
  usuarioCreacion: string;
  maquinaCreacion: string;
  fechaModifica?: string;
  usuarioModifica: string;
  maquinaModifica: string;
}

export interface DtoModalActivo {
  idModal: number;
  titulo: string;
  descripcion: string;
  tipoRecurso: string;
  rutaRecurso: string;
  tipoAccion: string;
  fechaInicio: string;
  fechaFin: string;
  unidad: string;
  orden: number;
}

export interface DtoModalRequest {
  Titulo: string;
  Descripcion: string;
  TipoRecurso: string;
  RutaRecurso: string;
  TipoAccion: string;
  FechaInicio: string;
  FechaFin: string;
  Unidad: string;
  Orden: number;
  Vigente: number;
}

export interface DtoModalToggleRequest {
  Vigente: number;
}

export interface DtoModalResult {
  id: number;
  success: boolean;
  message: string;
}

export interface DtoModalInteraccion {
  idInteraccion: number;
  idModal: number;
  tipoAccion: string;
  usuario: string;
  maquina: string;
  fechaInteraccion: string;
}

export interface DtoInteraccionRequest {
  IdModal: number;
  TipoAccion: string;
}

export interface ModalUploadResponse {
  success: boolean;
  url: string;
  fileName: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Modal`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DtoModal[]> {
    return this.http.get<DtoModal[]>(this.baseUrl);
  }

  getById(id: number): Observable<DtoModal> {
    return this.http.get<DtoModal>(`${this.baseUrl}/${id}`);
  }

  getActivos(): Observable<DtoModalActivo[]> {
    return this.http.get<DtoModalActivo[]>(`${this.baseUrl}/activos`);
  }

  create(request: DtoModalRequest): Observable<DtoModalResult> {
    return this.http.post<DtoModalResult>(this.baseUrl, request).pipe(timeout(30000));
  }

  update(id: number, request: DtoModalRequest): Observable<DtoModalResult> {
    return this.http.put<DtoModalResult>(`${this.baseUrl}/${id}`, request).pipe(timeout(30000));
  }

  delete(id: number): Observable<DtoModalResult> {
    return this.http.delete<DtoModalResult>(`${this.baseUrl}/${id}`).pipe(timeout(15000));
  }

  toggleVigente(id: number, vigente: number): Observable<DtoModalResult> {
    return this.http.patch<DtoModalResult>(`${this.baseUrl}/${id}/vigente`, { Vigente: vigente }).pipe(timeout(15000));
  }

  getInteracciones(id: number): Observable<DtoModalInteraccion[]> {
    return this.http.get<DtoModalInteraccion[]>(`${this.baseUrl}/${id}/interacciones`);
  }

  registrarInteraccion(request: DtoInteraccionRequest): Observable<DtoModalResult> {
    return this.http.post<DtoModalResult>(`${this.baseUrl}/interaccion`, request);
  }

  uploadRecurso(file: File): Observable<ModalUploadResponse> {
    const formData = new FormData();
    formData.append('File', file);
    return this.http.post<ModalUploadResponse>(`${this.baseUrl}/upload`, formData);
  }
}
