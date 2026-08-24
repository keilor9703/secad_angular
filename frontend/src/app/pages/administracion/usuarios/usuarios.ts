import { Component, OnDestroy, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DtoCivilUsuarioRequest, DtoRolCatalogo, UsuarioAdminService, UsuarioListadoItem, UsuarioLocalResult } from '../../../core/services/administracion/usuario-admin.service';
import { DtoCanalFuerza, DtoFuerza, DtoUsuarioOperacionRequest, FuerzaService } from '../../../core/services/administracion/fuerza.service';

type TabKey = 'datos' | 'roles' | 'operacion';
type TipoCreacion = 'policia' | 'civil';
type RolEstado = 'Vigente' | 'Vencido' | 'Retirado';

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
  /** ID local en ctr_usuarios (Snowflake como string). Necesario para endpoints de operación. */
  idUsuario: string;
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
  imports: [FormsModule, RouterModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss']
})
export class UsuariosComponent implements OnInit, OnDestroy {
  constructor(
    private toast: ToastService,
    private usuarioAdminService: UsuarioAdminService,
    private fuerzaService: FuerzaService
  ) {}

  minimized = false;
  visible = true;
  loading = false;
  savingRole = false;

  // ── Modo de creación ────────────────────────────────────────────
  /** Controla si se crea un funcionario Policía (vía PIP) o Civil / Otra entidad */
  tipoCreacion: TipoCreacion = 'policia';
  modoCreacionActivo = false;

  /** Formulario para usuario civil / otra entidad */
  civilForm: DtoCivilUsuarioRequest = {
    username: '',
    password: '',
    identificacion: '',
    nombres: '',
    apellidos: '',
    email: '',
    entidad: '',
    cargo: '',
    activo: true
  };
  showPassword = false;

  // ── Datos operacionales (tab Operación) ────────────────────────────
  fuerzasDisponibles: DtoFuerza[] = [];
  canalesDisponibles: DtoCanalFuerza[] = [];
  loadingOperacion = false;
  savingOperacion  = false;
  operacionForm: DtoUsuarioOperacionRequest = { cadcanaFuerzaId: 0, cadcanaCodigo: 0, acd: 0 };
  operacionActual: { fuerzaDescripcion?: string; canalDescripcion?: string } = {};

  deletingRoleId: number | null = null;
  deletingUser = false;
  loadingListado = false;
  showDeleteUserModal = false;
  deleteConfirmText = '';
  deletingTarget: UsuarioListadoItem | null = null;
  searchNombreListado = '';
  private searchNombreTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly minSearchChars = 6;
  readonly pageSize = 10;
  currentPage = 1;
  isSearchMode = false;
  activeTab: TabKey = 'datos';
  searchIdentification = '';
  user: UserProfile | null = null;
  usuariosListado: UsuarioListadoItem[] = [];
  rolesCatalogo: DtoRolCatalogo[] = [];
  showAddRoleForm = false;
  newRole: NewRoleForm = {
    rolId: null,
    justificacion: '',
    fechaFin: ''
  };

  ngOnInit(): void {
    this.cargarListadoUsuarios();
    this.cargarFuerzas();
  }

  ngOnDestroy(): void {
    if (this.searchNombreTimeout) {
      clearTimeout(this.searchNombreTimeout);
    }
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }

  prepararNuevoUsuario(): void {
    this.user = null;
    this.activeTab = 'datos';
    this.searchIdentification = '';
    this.showAddRoleForm = false;
    this.newRole = { rolId: null, justificacion: '', fechaFin: '' };
    this.rolesCatalogo = [];
    this.modoCreacionActivo = true;
    this.tipoCreacion = 'policia';
    this.resetCivilForm();
  }

  cancelarNuevoUsuario(): void {
    this.modoCreacionActivo = false;
    this.user = null;
    this.resetCivilForm();
  }

  setTipoCreacion(tipo: TipoCreacion): void {
    this.tipoCreacion = tipo;
    this.user = null;
    this.searchIdentification = '';
    this.resetCivilForm();
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  private resetCivilForm(): void {
    this.civilForm = {
      username: '',
      password: '',
      identificacion: '',
      nombres: '',
      apellidos: '',
      email: '',
      entidad: '',
      cargo: '',
      activo: true
    };
    this.showPassword = false;
  }

  guardarCivilUsuario(): void {
    const form = this.civilForm;
    const esEdicion = !!this.user;   // true cuando se editó desde el listado
    const titulo = esEdicion ? 'Editar usuario civil' : 'Crear usuario civil';

    if (!form.username?.trim()) {
      this.toast.warning(titulo, 'El nombre de usuario (username) es obligatorio.');
      return;
    }
    // Contraseña obligatoria solo en creación; en edición, vacío = sin cambio
    const password = form.password?.trim() ?? '';
    if (!esEdicion && password.length < 8) {
      this.toast.warning(titulo, 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (esEdicion && password.length > 0 && password.length < 8) {
      this.toast.warning(titulo, 'La nueva contraseña debe tener al menos 8 caracteres (o déjala vacía para no cambiarla).');
      return;
    }
    if (!form.nombres?.trim() || !form.apellidos?.trim()) {
      this.toast.warning(titulo, 'Nombre y apellidos son obligatorios.');
      return;
    }

    this.loading = true;
    this.usuarioAdminService.createCivilUsuario({
      username: form.username.trim(),
      password: password,           // backend ignora hash si viene vacío (ON CONFLICT no cambia hash)
      identificacion: form.identificacion?.trim() || undefined,
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      email: form.email?.trim() || undefined,
      entidad: form.entidad?.trim() || undefined,
      cargo: form.cargo?.trim() || undefined,
      activo: form.activo
    }).subscribe({
      next: (resp) => {
        this.loading = false;
        if (!resp?.success) {
          this.toast.warning(titulo, resp?.message || 'No fue posible guardar.');
          return;
        }
        this.toast.success(titulo, resp.message || 'Usuario civil guardado correctamente.');
        this.resetCivilForm();
        this.modoCreacionActivo = false;
        this.user = null;
        this.cargarListadoUsuarios();
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(titulo,
          err?.error?.message ?? err?.error?.detail ?? 'Se presentó un error guardando el usuario civil.'
        );
      }
    });
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
          idUsuario: String(funcionario.idUsuario ?? '0'),
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
          roles: (resp.rolesAsignados ?? []).map((rol) => this.mapAssignedRole(rol))
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
    if (tab === 'operacion' && this.user?.idUsuario) {
      this.cargarOperacion();
    }
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

    // Si estamos en modo civil (editando desde el panel civil), delegar a guardarCivilUsuario()
    if (this.tipoCreacion === 'civil' && this.modoCreacionActivo) {
      this.guardarCivilUsuario();
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
        this.cargarListadoUsuarios();
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
        this.recargarUsuarioActual();
        this.cargarListadoUsuarios();
      },
      error: (err) => {
        this.savingRole = false;
        this.toast.error('Roles', err?.error?.detail ?? err?.error?.message ?? 'Error asignando rol.');
      }
    });
  }

  eliminarRol(rol: UserRole): void {
    if (!this.user) {
      this.toast.warning('Roles', 'Consulta un usuario primero.');
      return;
    }

    const confirmar = confirm(`¿Deseas retirar el rol "${rol.nombre}" del usuario?`);
    if (!confirmar) {
      return;
    }

    this.deletingRoleId = rol.id;
    this.usuarioAdminService.eliminarRol(rol.id, this.user.usuarioEmpresarial, this.user.identificacion).subscribe({
      next: (resp) => {
        this.deletingRoleId = null;
        if (!resp?.success) {
          // El backend devuelve 200 con success:false cuando el rol ya no estaba vigente
          this.toast.warning('Roles', resp?.message || 'No hay roles vigentes para retirar.');
          return;
        }
        this.toast.success('Roles', resp.message || 'Rol retirado correctamente.');
        this.recargarUsuarioActual();
        this.cargarListadoUsuarios();
      },
      error: (err) => {
        this.deletingRoleId = null;
        this.toast.error('Roles', err?.error?.detail ?? err?.error?.message ?? 'Error retirando rol.');
      }
    });
  }

  /**
   * Recarga los datos del usuario actualmente seleccionado usando el método
   * apropiado según su tipo (civil → BD local, policia → PIP vía searchIdentification).
   * Evita llamar a consultarUsuario() cuando searchIdentification no está definido
   * (usuarios cargados desde el listado o civiles).
   */
  private recargarUsuarioActual(): void {
    if (!this.user) return;

    if (this.tipoCreacion === 'civil') {
      // Usuario civil / otra entidad: recargar desde BD local
      const username = this.user.usuarioEmpresarial;
      if (!username) return;
      this.cargarUsuarioCivil({
        idUsuario:      Number(this.user.idUsuario) || 0,
        identificacion: this.user.identificacion,
        username,
        nombreCompleto: this.user.nombreCompleto,
        rol:            '',
        tipoUsuario:    'CIVIL'
      });
    } else if (this.searchIdentification?.trim()) {
      // Policía cargado desde el campo de búsqueda por identificación
      this.consultarUsuario();
    }
    // Si no aplica ninguno de los dos casos, no se hace nada
    // (evita el toast "Documento requerido" cuando searchIdentification está vacío)
  }

  cargarListadoUsuarios(): void {
    this.loadingListado = true;
    const term = (this.searchNombreListado ?? '').trim();
    const hasSearchTerm = term.length > 0;

    if (hasSearchTerm && term.length < this.minSearchChars) {
      this.isSearchMode = true;
      this.usuariosListado = [];
      this.currentPage = 1;
      this.loadingListado = false;
      return;
    }

    this.isSearchMode = hasSearchTerm;
    const query = this.isSearchMode ? term : '';

    this.usuarioAdminService.getListadoUsuarios(query).subscribe({
      next: (items) => {
        this.usuariosListado = (items ?? []).map((x) => ({
          ...x,
          fechaFinRol: this.normalizeDateString(x?.fechaFinRol ?? '')
        }));
        this.currentPage = 1;
        this.loadingListado = false;
      },
      error: () => {
        this.usuariosListado = [];
        this.currentPage = 1;
        this.loadingListado = false;
      }
    });
  }

  onSearchNombreListadoChange(): void {
    if (this.searchNombreTimeout) {
      clearTimeout(this.searchNombreTimeout);
    }

    this.searchNombreTimeout = setTimeout(() => {
      this.cargarListadoUsuarios();
    }, 350);
  }

  get totalUsuariosListado(): number {
    return this.usuariosListado.length;
  }

  get totalPaginasListado(): number {
    return Math.max(1, Math.ceil(this.totalUsuariosListado / this.pageSize));
  }

  get usuariosListadoPaginado(): UsuarioListadoItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.usuariosListado.slice(start, start + this.pageSize);
  }

  canGoPrevListado(): boolean {
    return this.currentPage > 1;
  }

  canGoNextListado(): boolean {
    return this.currentPage < this.totalPaginasListado;
  }

  prevPaginaListado(): void {
    if (!this.canGoPrevListado()) {
      return;
    }
    this.currentPage -= 1;
  }

  nextPaginaListado(): void {
    if (!this.canGoNextListado()) {
      return;
    }
    this.currentPage += 1;
  }

  editarDesdeListado(item: UsuarioListadoItem): void {
    const tipo = (item?.tipoUsuario ?? 'POLICIA').toUpperCase();

    if (tipo === 'CIVIL') {
      // Usuarios civiles: cargar desde BD local, nunca desde PIP
      this.cargarUsuarioCivil(item);
    } else {
      // Funcionarios policiales: flujo normal vía PIP
      const identificacion = String(item?.identificacion ?? '').trim();
      if (!identificacion) {
        this.toast.warning('Usuarios', 'El registro no tiene identificación para cargar edición.');
        return;
      }
      this.modoCreacionActivo = false;
      this.user = null;
      this.searchIdentification = identificacion;
      this.activeTab = 'datos';
      this.consultarUsuario();
    }
  }

  private cargarUsuarioCivil(item: UsuarioListadoItem): void {
    const username = String(item?.username ?? '').trim();
    if (!username) {
      this.toast.warning('Usuarios', 'El registro no tiene username para cargar edición.');
      return;
    }

    this.loading = true;
    this.modoCreacionActivo = true;
    this.tipoCreacion = 'civil';
    this.user = null;
    this.activeTab = 'datos';

    this.usuarioAdminService.getLocalUsuario(username).subscribe({
      next: (resp: UsuarioLocalResult) => {
        const u = resp.usuario;
        this.civilForm = {
          username: u.username ?? '',
          password: '',               // no se pre-carga la contraseña por seguridad
          identificacion: u.identificacion ?? '',
          nombres: u.nombres ?? '',
          apellidos: u.apellidos ?? '',
          email: u.email ?? '',
          entidad: u.entidad ?? '',
          cargo: u.cargo ?? '',
          activo: u.activo
        };
        // Cargar roles para mostrárselos (usando el panel de roles existente)
        // Reutilizamos el user profile como contenedor mínimo para los roles
        this.user = {
          idUsuario: String(u.idUsuario ?? '0'),
          identificacion: u.identificacion ?? u.username,
          nombres: u.nombres ?? '',
          apellidos: u.apellidos ?? '',
          grado: 'CIVIL',
          nombreCompleto: `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim() || u.username,
          usuarioEmpresarial: u.username,
          email: u.email ?? '',
          telefono: '',
          situacionLaboral: 'CIVIL / OTRA ENTIDAD',
          unidad: u.entidad ?? '',
          unidadFisica: '',
          cargo: u.cargo ?? '',
          gradAlfabetico: '',
          funcionarioCodigo: '',
          undeLaborandoCodigo: '',
          codigoCargo: '',
          activo: u.activo,
          ultimoIngreso: 'Sin dato',
          roles: (resp.rolesAsignados ?? []).map((rol) => this.mapAssignedRole(rol))
        };
        // Pre-cargar datos operacionales del civil si están disponibles en el DTO
        this.operacionForm = {
          cadcanaFuerzaId: u.cadcanaFuerzaId ?? 0,
          cadcanaCodigo:   u.cadcanaCodigo ?? 0,
          acd:             u.acd ?? 0
        };
        if ((u.cadcanaFuerzaId ?? 0) > 0) {
          this.onFuerzaOperacionChange(u.cadcanaFuerzaId!);
        }
        this.rolesCatalogo = (resp.rolesCatalogo ?? []).filter((r) => Number(r.id) > 0);
        this.loading = false;
        this.toast.success('Usuario civil', 'Datos cargados. Edite y guarde los cambios.');
      },
      error: (err) => {
        this.loading = false;
        this.modoCreacionActivo = false;
        this.toast.error('Usuarios', err?.error?.message ?? 'No fue posible cargar el usuario civil.');
      }
    });
  }

  abrirModalEliminarUsuario(item: UsuarioListadoItem): void {
    this.deletingTarget = item;
    this.deleteConfirmText = '';
    this.showDeleteUserModal = true;
  }

  cerrarModalEliminarUsuario(): void {
    if (this.deletingUser) {
      return;
    }
    this.showDeleteUserModal = false;
    this.deleteConfirmText = '';
    this.deletingTarget = null;
  }

  confirmarEliminarUsuario(): void {
    if (!this.deletingTarget) {
      return;
    }

    if (this.deleteConfirmText.trim().toUpperCase() !== 'ELIMINAR') {
      this.toast.warning('Usuarios', 'Debes escribir ELIMINAR para confirmar.');
      return;
    }

    this.deletingUser = true;
    this.usuarioAdminService.eliminarUsuario(this.deletingTarget.idUsuario).subscribe({
      next: (resp) => {
        this.deletingUser = false;
        if (!resp?.success) {
          this.toast.warning('Usuarios', resp?.message || 'No fue posible eliminar el usuario.');
          return;
        }
        this.toast.success('Usuarios', resp.message || 'Usuario eliminado correctamente.');
        this.cerrarModalEliminarUsuario();
        this.cargarListadoUsuarios();

        if (this.user?.identificacion?.trim() === String(this.deletingTarget?.identificacion ?? '').trim()) {
          this.user = null;
          this.activeTab = 'datos';
        }
      },
      error: (err) => {
        this.deletingUser = false;
        this.toast.error('Usuarios', err?.error?.detail ?? err?.error?.message ?? 'Error eliminando usuario.');
      }
    });
  }

  // ── Datos operacionales ────────────────────────────────────────────────────

  cargarFuerzas(): void {
    this.fuerzaService.getFuerzas().subscribe({
      next: (r) => { this.fuerzasDisponibles = (r.data ?? []).filter(f => f.vigente === 'S'); },
      error: () => { /* silencioso; las fuerzas son secundarias */ }
    });
  }

  onFuerzaOperacionChange(fuerzaId?: number): void {
    const id = fuerzaId ?? this.operacionForm.cadcanaFuerzaId;
    this.canalesDisponibles = [];
    this.operacionForm.cadcanaCodigo = 0;
    if (!id || id === 0) return;

    this.fuerzaService.getCanales(id).subscribe({
      next: (r) => {
        this.canalesDisponibles = (r.data ?? []).filter(c => c.vigente === 'S');
        // Si ya viene un canal preseleccionado, asegurarse de que esté en la lista
        if (fuerzaId !== undefined && this.operacionForm.cadcanaCodigo === 0) {
          // no restablecer, el form ya tiene el valor correcto
        }
      },
      error: () => { this.canalesDisponibles = []; }
    });
  }

  cargarOperacion(): void {
    if (!this.user?.idUsuario || this.user.idUsuario === '0') return;
    this.loadingOperacion = true;
    this.fuerzaService.getUsuarioOperacion(this.user.idUsuario).subscribe({
      next: (r) => {
        const op = r.data;
        this.operacionForm = {
          cadcanaFuerzaId: op.cadcanaFuerzaId ?? 0,
          cadcanaCodigo:   op.cadcanaCodigo ?? 0,
          acd:             op.acd ?? 0
        };
        this.operacionActual = {
          fuerzaDescripcion: op.fuerzaDescripcion,
          canalDescripcion:  op.canalDescripcion
        };
        // Cargar canales de la fuerza asignada
        if ((op.cadcanaFuerzaId ?? 0) > 0) {
          this.fuerzaService.getCanales(op.cadcanaFuerzaId).subscribe({
            next: (cr) => { this.canalesDisponibles = (cr.data ?? []).filter(c => c.vigente === 'S'); },
            error: () => {}
          });
        }
        this.loadingOperacion = false;
      },
      error: () => {
        this.loadingOperacion = false;
        this.toast.error('Operación', 'No se pudieron cargar los datos operacionales.');
      }
    });
  }

  guardarOperacion(): void {
    if (!this.user?.idUsuario || this.user.idUsuario === '0') {
      this.toast.warning('Operación', 'No hay usuario cargado para guardar datos operacionales.');
      return;
    }
    this.savingOperacion = true;
    this.fuerzaService.saveUsuarioOperacion(this.user.idUsuario, this.operacionForm).subscribe({
      next: (r) => {
        this.savingOperacion = false;
        if (r.success) {
          this.toast.success('Operación', r.message || 'Datos operacionales guardados.');
          this.cargarOperacion();
        } else {
          this.toast.warning('Operación', r.message);
        }
      },
      error: (err) => {
        this.savingOperacion = false;
        this.toast.error('Operación', err?.error?.message ?? 'Error guardando datos operacionales.');
      }
    });
  }

  private mapAssignedRole(rol: any): UserRole {
    const fechaExpiracion = this.normalizeDateString(rol?.fechaFin ?? rol?.fecha_fin ?? '');
    const estadoBase = String(rol?.estado ?? '').trim().toLowerCase();

    let estado: RolEstado;
    if (estadoBase.includes('retir') || estadoBase.includes('eliminad') || estadoBase.includes('removid')) {
      estado = 'Retirado';
    } else if (estadoBase.includes('venc')) {
      estado = 'Vencido';
    } else {
      estado = 'Vigente';
    }

    return {
      id: Number(rol?.id ?? 0),
      nombre: String(rol?.rol ?? '').trim() || `Rol ${rol?.id}`,
      fechaExpiracion,
      estado,
      justificacion: String(rol?.justificacion ?? '').trim()
    };
  }

  private normalizeDateString(raw: string): string {
    const value = String(raw ?? '').trim();
    if (!value) {
      return '';
    }

    const onlyDate = value.includes('T') ? value.split('T')[0] : value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) {
      return onlyDate;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
