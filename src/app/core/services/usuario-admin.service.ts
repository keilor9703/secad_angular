import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DtoFuncionario {
  identificacion?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  situacionLaboral?: string | null;
  correo?: string | null;
  usuario?: string | null;
  celular?: string | null;
  dependencia?: string | null;
  siglaFisica?: string | null;
  siglaLaborando?: string | null;
  nombreGrado?: string | null;
  cargo?: string | null;
  activo?: boolean;
}

export interface DtoRolCatalogo {
  id: number;
  nombre?: string | null;
}

export interface UsuarioConsultaResult {
  funcionario: DtoFuncionario;
  fotoBase64: string | null;
  roles: DtoRolCatalogo[];
}

@Injectable({ providedIn: 'root' })
export class UsuarioAdminService {
  private readonly baseUrl = `${environment.apiBaseUrl}/Usuario`;

  constructor(private http: HttpClient) {}

  consultarUsuarioPorIdentificacion(identificacion: string): Observable<UsuarioConsultaResult> {
    const id = identificacion.trim();

    return forkJoin({
      funcionario: this.http.get<DtoFuncionario>(`${this.baseUrl}/Funcionario`, {
        params: { identificacion: id }
      }),
      fotoBase64: this.http
        .get(`${this.baseUrl}/Foto`, {
          params: { identificacion: id },
          responseType: 'text'
        })
        .pipe(
          map((raw) => this.normalizeFotoResponse(raw)),
          catchError(() => of(null))
        ),
      roles: this.http.get<DtoRolCatalogo[]>(`${this.baseUrl}/Roles`).pipe(catchError(() => of([])))
    });
  }

  private normalizeFotoResponse(raw: string | null): string | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    // Si backend responde JSON string ("..."), quitar envoltura.
    let decoded = trimmed;
    try {
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        decoded = JSON.parse(trimmed);
      }
    } catch {
      decoded = trimmed;
    }

    if (!decoded || decoded.length < 20) {
      return null;
    }

    if (decoded.startsWith('data:image/')) {
      return decoded;
    }

    return `data:image/jpeg;base64,${decoded}`;
  }
}
