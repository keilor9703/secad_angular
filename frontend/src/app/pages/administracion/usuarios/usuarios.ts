import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { DtoRolCatalogo, UsuarioAdminService } from '../../../core/services/administracion/usuario-admin.service';

type TabKey = 'datos' | 'roles';
type RolEstado = 'Vigente' | 'Vencido';

interface UserRole {
  id: number;
  nombre: string;
  fechaExpiracion: string;
  estado: RolEstado;
  justificacion: string;
}

interface NewRoleForm {
  rolId: number | null;
  justificacion: string;
  fechaFin: string;
}

interface UserProfile {
  identificacion: string;
  nombres: string;
  apellidos: string;
  grado: string;
  nombreCompleto: string;
  usuarioEmpresarial: string;
  email: string;
  telefono: string;
  situacionLaboral: string;
  unidad: string;
  unidadFisica: string;
  cargo: string;
  gradAlfabetico: string;
  funcionarioCodigo: string;
  undeLaborandoCodigo: string;
  codigoCargo: string;
  activo: boolean;
  ultimoIngreso: string;
  fotoUrl?: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss']
})
export class UsuariosComponent {
  constructor(
    private toast: ToastService,
    private usuarioAdminService: UsuarioAdminService
  ) {}

  minimized = false;
  visible = true;
  loading = false;
  savingRole = false;
  activeTab: TabKey = 'datos';
  searchIdentification = '';
  user: UserProfile | null = null;
  rolesCatalogo: DtoRolCatalogo[] = [];
  showAddRoleForm = false;
  newRole: NewRoleForm = {
    rolId: null,
    justificacion: '',
    fechaFin: ''
  };

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }

  consultarUsuario(): void {
    const documento = this.searchIdentification.trim();
    if (!documento) {
      this.toast.warning('Documento requerido', 'Digite una identificación para consultar.');
      return;
    }

    this.loading = true;
    this.toast.info('Consulta', 'Buscando información empresarial...');

    this.usuarioAdminService.consultarUsuarioPorIdentificacion(documento).subscribe({
      next: (resp) => {
        const funcionario = resp.funcionario ?? {};
        const nombres = (funcionario.nombres ?? '').trim();
        const apellidos = (funcionario.apellidos ?? '').trim();
        const nombreCompleto = `${nombres} ${apellidos}`.trim() || 'SIN NOMBRE';

        this.user = {
          identificacion: (funcionario.identificacion ?? documento).trim(),
          nombres,
          apellidos,
          grado: (funcionario.nombreGrado ?? funcionario.cargo ?? '').trim(),
          nombreCompleto,
          usuarioEmpresarial: (funcionario.usuario ?? '').trim(),
          email: (funcionario.correo ?? '').trim(),
          telefono: (funcionario.celular ?? '').trim(),
          situacionLaboral: (funcionario.situacionLaboral ?? '').trim(),
          unidad: (funcionario.dependencia ?? '').trim(),
          unidadFisica: (funcionario.siglaFisica ?? funcionario.siglaLaborando ?? '').trim(),
          cargo: (funcionario.cargo ?? '').trim(),
          gradAlfabetico: (funcionario.gradAlfabetico ?? funcionario.nombreGrado ?? '').trim(),
          funcionarioCodigo: (funcionario.funcionarioCodigo ?? '').trim(),
          undeLaborandoCodigo: (funcionario.undeLaborandoCodigo ?? '').trim(),
          codigoCargo: (funcionario.codigoCargo ?? '').trim(),
          activo: funcionario.activo ?? true,
          ultimoIngreso: 'Sin dato',
          fotoUrl: resp.fotoBase64 ?? undefined,
          roles: (resp.rolesAsignados ?? []).map((rol) => ({
            id: Number(rol.id),
            nombre: (rol.rol ?? '').trim() || `Rol ${rol.id}`,
            fechaExpiracion: (rol.fechaFin ?? '').trim(),
            estado: ((rol.estado ?? 'Vigente').toLowerCase().includes('venc') ? 'Vencido' : 'Vigente') as RolEstado,
            justificacion: (rol.justificacion ?? '').trim()
          }))
        };
        this.rolesCatalogo = (resp.rolesCatalogo ?? []).filter((r) => Number(r.id) > 0);
        this.showAddRoleForm = false;
        this.newRole = { rolId: null, justificacion: '', fechaFin: '' };

        this.loading = false;
        this.toast.success('Consulta exitosa', 'Se cargó la información del usuario.');
      },
      error: (err) => {
        this.loading = false;
        this.user = null;
        const errorResponse = err?.error;
        const errorMsg = 
          errorResponse?.message ?? 
          (errorResponse?.success === false ? 'Operación fallida' : null) ??
          'No fue posible consultar el usuario.';
        this.toast.error('Consulta fallida', errorMsg);
      }
    });
  }

  setTab(tab: TabKey): void {
    this.activeTab = tab;
  }

  toggleEstadoUsuario(): void {
    if (!this.user) {
      return;
    }
    this.user.activo = !this.user.activo;
  }

  get activeRolesCount(): number {
    return this.user?.roles.filter((r) => r.estado === 'Vigente').length ?? 0;
  }

  agregarRol(): void {
    if (!this.user) {
      this.toast.warning('Roles', 'Consulta un usuario antes de asignar roles.');
      return;
    }

    if (this.rolesCatalogo.length === 0) {
      this.toast.warning('Roles', 'No hay catálogo de roles disponible.');
      return;
    }

    this.showAddRoleForm = true;
  }

  cancelarNuevoRol(): void {
    this.showAddRoleForm = false;
    this.newRole = { rolId: null, justificacion: '', fechaFin: '' };
  }

  guardarDatosUsuario(): void {
    if (!this.user) {
      this.toast.warning('Guardar datos', 'Primero consulta un usuario.');
      return;
    }

    if (!this.user.identificacion?.trim()) {
      this.toast.warning('Guardar datos', 'La identificación está vacía; vuelve a consultar el usuario.');
      return;
    }

    const payload = {
      username: this.user.usuarioEmpresarial || this.user.identificacion,
      identificacion: this.user.identificacion,
      nombres: this.user.nombres,
      apellidos: this.user.apellidos,
      email: this.user.email,
      gradAlfabetico: this.user.gradAlfabetico || this.user.grado,
      funcionario: this.user.funcionarioCodigo,
      undeLaborando: this.user.undeLaborandoCodigo,
      codigoCargo: this.user.codigoCargo,
      activo: this.user.activo
    };

    this.loading = true;
    this.usuarioAdminService.guardarUsuario(payload).subscribe({
      next: (resp) => {
        this.loading = false;
        if (!resp?.success) {
          this.toast.warning('Guardar datos', resp?.message || 'No fue posible guardar.');
          return;
        }
        this.toast.success('Guardar datos', resp.message || 'Usuario guardado correctamente.');
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(
          'Guardar datos',
          err?.error?.detail ?? err?.error?.message ?? 'Se presentó un error guardando el usuario.'
        );
      }
    });
  }

  guardarRoles(): void {
    if (!this.user) {
      this.toast.warning('Roles', 'Consulta un usuario primero.');
      return;
    }

    if (!this.showAddRoleForm) {
      this.toast.info('Roles', 'No hay cambios pendientes en roles.');
      return;
    }

    if (!this.newRole.rolId || this.newRole.rolId <= 0) {
      this.toast.warning('Roles', 'Selecciona un rol.');
      return;
    }

    if (!this.newRole.justificacion.trim()) {
      this.toast.warning('Roles', 'La justificación es obligatoria.');
      return;
    }

    if (!this.newRole.fechaFin) {
      this.toast.warning('Roles', 'La fecha fin es obligatoria.');
      return;
    }

    this.savingRole = true;
    this.usuarioAdminService.asignarRol({
      usuarioId: 0,
      usuario: this.user.usuarioEmpresarial,
      identificacion: this.user.identificacion,
      rolId: this.newRole.rolId,
      justificacion: this.newRole.justificacion.trim(),
      fechaFin: this.newRole.fechaFin,
      vigente: 1
    }).subscribe({
      next: (resp) => {
        this.savingRole = false;
        if (!resp?.success) {
          this.toast.warning('Roles', resp?.message || 'No fue posible asignar el rol.');
          return;
        }

        this.toast.success('Roles', resp.message || 'Rol asignado correctamente.');
        this.cancelarNuevoRol();
        this.consultarUsuario();
      },
      error: (err) => {
        this.savingRole = false;
        this.toast.error('Roles', err?.error?.detail ?? err?.error?.message ?? 'Error asignando rol.');
      }
    });
  }
}



