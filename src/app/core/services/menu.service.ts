import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DbMenuItem {
  idMenu: number;
  descripcion: string;
  idPadre: number;
  posicion: number;
  tipo: string;
  icono?: string | null;
  vigente: number;
  detalle?: string | null;
}

export interface MenuSaveRequest {
  idMenu?: number | null;
  descripcion: string;
  idPadre: number;
  posicion: number;
  tipo: string;
  icono?: string | null;
  vigente: number;
  detalle?: string | null;
}

export interface MenuEstadoRequest {
  vigente: number;
}

export interface MenuApiResponse {
  success: boolean;
  id: number;
  message: string;
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  constructor(private http: HttpClient) {}

  getByUser(idUsuario: number): Observable<DbMenuItem[]> {
    return this.http.get<DbMenuItem[]>(`${environment.apiBaseUrl}/menu/by-user/${idUsuario}`);
  }

  getMyMenu(): Observable<DbMenuItem[]> {
    return this.http.get<DbMenuItem[]>(`${environment.apiBaseUrl}/menu/me`);
  }

  getAdminMenu(): Observable<DbMenuItem[]> {
    return this.http.get<DbMenuItem[]>(`${environment.apiBaseUrl}/menu/admin`);
  }

  saveAdminMenu(payload: MenuSaveRequest): Observable<MenuApiResponse> {
    return this.http.post<MenuApiResponse>(`${environment.apiBaseUrl}/menu/admin`, payload);
  }

  setEstadoAdminMenu(idMenu: number, payload: MenuEstadoRequest): Observable<MenuApiResponse> {
    return this.http.patch<MenuApiResponse>(`${environment.apiBaseUrl}/menu/admin/${idMenu}/estado`, payload);
  }
}
