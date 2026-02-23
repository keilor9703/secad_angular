import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { UsuarioAdminService } from '../../core/services/usuario-admin.service';

type TabKey = 'datos' | 'roles';
type RolEstado = 'Vigente' | 'Vencido';

interface UserRole {
  id: string;
  nombre: string;
  fechaExpiracion: string;
  estado: RolEstado;
  justificacion: string;
}

interface UserProfile {
  identificacion: string;
  grado: string;
  nombreCompleto: string;
  usuarioEmpresarial: string;
  email: string;
  telefono: string;
  situacionLaboral: string;
  unidad: string;
  unidadFisica: string;
  cargo: string;
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
  activeTab: TabKey = 'datos';
  searchIdentification = '';
  user: UserProfile | null = null;

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
          grado: (funcionario.nombreGrado ?? funcionario.cargo ?? '').trim(),
          nombreCompleto,
          usuarioEmpresarial: (funcionario.usuario ?? '').trim(),
          email: (funcionario.correo ?? '').trim(),
          telefono: (funcionario.celular ?? '').trim(),
          situacionLaboral: (funcionario.situacionLaboral ?? '').trim(),
          unidad: (funcionario.dependencia ?? '').trim(),
          unidadFisica: (funcionario.siglaFisica ?? funcionario.siglaLaborando ?? '').trim(),
          cargo: (funcionario.cargo ?? '').trim(),
          activo: funcionario.activo ?? true,
          ultimoIngreso: 'Sin dato',
          fotoUrl: resp.fotoBase64 ?? undefined,
          roles: (resp.roles ?? []).map((rol) => ({
            id: String(rol.id),
            nombre: (rol.nombre ?? '').trim() || `Rol ${rol.id}`,
            fechaExpiracion: '',
            estado: 'Vigente' as RolEstado,
            justificacion: ''
          }))
        };

        this.loading = false;
        this.toast.success('Consulta exitosa', 'Se cargó la información del usuario.');
      },
      error: (err) => {
        this.loading = false;
        this.user = null;
        this.toast.error(
          'Consulta fallida',
          err?.error?.message ?? 'No fue posible consultar el usuario.'
        );
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
      this.toast.warning('Sin usuario', 'Primero consulta un usuario.');
      return;
    }
    const next = this.user.roles.length + 1;
    this.user.roles.push({
      id: `r${Date.now()}`,
      nombre: `Nuevo rol ${next}`,
      fechaExpiracion: '',
      estado: 'Vigente',
      justificacion: ''
    });
  }

  eliminarRol(index: number): void {
    if (!this.user) {
      return;
    }
    this.user.roles.splice(index, 1);
  }

  guardarDatosUsuario(): void {
    this.toast.success('Guardar datos', 'Cambios de datos personales listos para persistir.');
  }

  guardarRoles(): void {
    this.toast.success('Guardar roles', 'Cambios de roles y permisos listos para persistir.');
  }
}

