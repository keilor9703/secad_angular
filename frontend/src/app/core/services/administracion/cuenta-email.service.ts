import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DtoCuentaEmail {
  idCuenta: number;
  idDominioGrupo: number;
  nombreCuenta: string;
  email: string;
  servidorSmtp: string;
  puerto: number;
  usuarioSmtp: string;
  claveSmtp: string;
  usarSsl: number;
  vigente: number;
  nombreGrupo?: string;
  firmaHtml?: string | null;
  imagenEncabezado?: string | null;
}

export interface DtoCuentaEmailRequest {
  IdDominioGrupo: number;
  NombreCuenta: string;
  Email: string;
  ServidorSmtp: string;
  Puerto: number;
  UsuarioSmtp: string;
  ClaveSmtp: string;
  UsarSsl: number;
  Vigente: number;
  FirmaHtml?: string | null;
  ImagenEncabezado?: string | null;
}

export interface DtoCuentaEmailUsuario {
  idCuentaUsuario: number;
  idCuenta: number;
  nombreCuenta: string;
  email: string;
  idUsuario: number;
  usuarioLogin: string;
  nombreCompleto: string;
  identificacion: string;
  vigente: number;
}

export interface DtoCuentaEmailUsuarioRequest {
  idCuenta: number;
  idUsuario: number;
}

export interface DtoCuentaEmailUsuarioEstadoRequest {
  vigente: number;
}

@Injectable({
  providedIn: 'root'
})
export class CuentaEmailService {
  private baseUrl = `${environment.apiBaseUrl}/CuentaEmail`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<DtoCuentaEmail[]> {
    return this.http.get<DtoCuentaEmail[]>(this.baseUrl);
  }

  getById(id: number): Observable<DtoCuentaEmail> {
    return this.http.get<DtoCuentaEmail>(`${this.baseUrl}/${id}`);
  }

  create(request: DtoCuentaEmailRequest): Observable<any> {
    return this.http.post(this.baseUrl, request);
  }

  update(id: number, request: DtoCuentaEmailRequest): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getMisCuentas(): Observable<DtoCuentaEmail[]> {
    return this.http.get<DtoCuentaEmail[]>(`${this.baseUrl}/mis-cuentas`);
  }

  getAutorizaciones(idCuenta?: number, idUsuario?: number, vigente?: number): Observable<DtoCuentaEmailUsuario[]> {
    const params: any = {};
    if (idCuenta !== undefined) params.idCuenta = idCuenta;
    if (idUsuario !== undefined) params.idUsuario = idUsuario;
    if (vigente !== undefined) params.vigente = vigente;
    return this.http.get<DtoCuentaEmailUsuario[]>(`${this.baseUrl}/autorizaciones`, { params });
  }

  crearAutorizacion(payload: DtoCuentaEmailUsuarioRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/autorizaciones`, payload);
  }

  actualizarAutorizacion(idCuentaUsuario: number, payload: DtoCuentaEmailUsuarioEstadoRequest): Observable<any> {
    return this.http.put(`${this.baseUrl}/autorizaciones/${idCuentaUsuario}`, payload);
  }

  eliminarAutorizacion(idCuentaUsuario: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/autorizaciones/${idCuentaUsuario}`);
  }

  uploadImagenEncabezado(file: File): Observable<{ success: boolean; url: string; fileName: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; url: string; fileName: string }>(
      `${environment.apiBaseUrl}/CuentaEmailUpload/imagen`, formData
    );
  }
}
