import { Component, ChangeDetectionStrategy, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsuariosComponent implements OnInit {
  private readonly toast               = inject(ToastService);
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly fuerzaService       = inject(FuerzaService);
  private readonly fb                  = inject(FormBuilder);

  readonly minimized   = signal(false);
  readonly visible     = signal(true);
  readonly loading     = signal(false);
  readonly savingRole  = signal(false);

  // ── Modo de creación ────────────────────────────────────────────
  /** Controla si se crea un funcionario Policía (vía PIP) o Civil / Otra entidad */
  readonly tipoCreacion       = signal<TipoCreacion>('policia');
  readonly modoCreacionActivo = signal(false);

  /** Formulario para usuario civil / otra entidad */
  readonly civilForm = this.fb.nonNullable.group({
    username:       ['', [Validators.required]],
    password:       [''],
    identificacion: [''],
    nombres:        ['', [Validators.required]],
    apellidos:      ['', [Validators.required]],
    email:          [''],
    entidad:        [''],
    cargo:          [''],
    activo:         [true]
  });
  readonly showPassword = signal(false);

  // ── Datos operacionales (tab Operación) ────────────────────────────
  readonly fuerzasDisponibles  = signal<DtoFuerza[]>([]);
  readonly canalesDisponibles  = signal<DtoCanalFuerza[]>([]);
  readonly loadingOperacion    = signal(false);
  readonly savingOperacion     = signal(false);
  readonly operacionForm = this.fb.nonNullable.group({
    cadcanaFuerzaId: [0],
    cadcanaCodigo:   [0],
    acd:             [0]
  });
  readonly operacionActual = signal<{ fuerzaDescripcion?: string; canalDescripcion?: string }>({});

  readonly deletingRoleId       = signal<number | null>(null);
  readonly deletingUser         = signal(false);
  readonly loadingListado       = signal(false);
  readonly showDeleteUserModal  = signal(false);
  readonly deleteConfirmText    = signal('');
  readonly deletingTarget       = signal<UsuarioListadoItem | null>(null);
  searchNombreListado = '';
  private searchNombreTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly minSearchChars = 6;
  readonly pageSize = 10;
  readonly currentPage       = signal(1);
  readonly isSearchMode      = signal(false);
  readonly activeTab         = signal<TabKey>('datos');
  searchIdentification = '';
  readonly user               = signal<UserProfile | null>(null);
  readonly usuariosListado     = signal<UsuarioListadoItem[]>([]);
  readonly rolesCatalogo       = signal<DtoRolCatalogo[]>([]);
  readonly showAddRoleForm     = signal(false);

  readonly newRole = this.fb.nonNullable.group({
    rolId:         this.fb.control<number | null>(null),
    justificacion: [''],
    fechaFin:      ['']
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchNombreTimeout) clearTimeout(this.searchNombreTimeout);
    });
  }

  ngOnInit(): void {
    this.cargarListadoUsuarios();
    this.cargarFuerzas();
  }

  toggleMinimize(): void {
    this.minimized.update(v => !v);
  }

  closePanel(): void {
    this.visible.set(false);
  }

  prepararNuevoUsuario(): void {
    this.user.set(null);
    this.activeTab.set('datos');
    this.searchIdentification = '';
    this.showAddRoleForm.set(false);
    this.newRole.reset({ rolId: null, justificacion: '', fechaFin: '' });
    this.rolesCatalogo.set([]);
    this.modoCreacionActivo.set(true);
    this.tipoCreacion.set('policia');
    this.resetCivilForm();
  }

  cancelarNuevoUsuario(): void {
    this.modoCreacionActivo.set(false);
    this.user.set(null);
    this.resetCivilForm();
  }

  setTipoCreacion(tipo: TipoCreacion): void {
    this.tipoCreacion.set(tipo);
    this.user.set(null);
    this.searchIdentification = '';
    this.resetCivilForm();
  }

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  private resetCivilForm(): void {
    this.civilForm.reset({
      username: '',
      password: '',
      identificacion: '',
      nombres: '',
      apellidos: '',
      email: '',
      entidad: '',
      cargo: '',
      activo: true
    });
    this.showPassword.set(false);
  }

  guardarCivilUsuario(): void {
    const form = this.civilForm.getRawValue();
    const esEdicion = !!this.user();   // true cuando se editó desde el listado
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

    this.loading.set(true);
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
        this.loading.set(false);
        if (!resp?.success) {
          this.toast.warning(titulo, resp?.message || 'No fue posible guardar.');
          return;
        }
        this.toast.success(titulo, resp.message || 'Usuario civil guardado correctamente.');
        this.resetCivilForm();
        this.modoCreacionActivo.set(false);
        this.user.set(null);
        this.cargarListadoUsuarios();
      },
      error: (err) => {
        this.loading.set(false);
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

    this.loading.set(true);
    this.toast.info('Consulta', 'Buscando información empresarial...');

    this.usuarioAdminService.consultarUsuarioPorIdentificacion(documento).subscribe({
      next: (resp) => {
        const funcionario = resp.funcionario ?? {};
        const nombres = (funcionario.nombres ?? '').trim();
        const apellidos = (funcionario.apellidos ?? '').trim();
        const nombreCompleto = `${nombres} ${apellidos}`.trim() || 'SIN NOMBRE';

        this.user.set({
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
        });
        this.rolesCatalogo.set((resp.rolesCatalogo ?? []).filter((r) => Number(r.id) > 0));
        this.showAddRoleForm.set(false);
        this.newRole.reset({ rolId: null, justificacion: '', fechaFin: '' });

        this.loading.set(false);
        this.toast.success('Consulta exitosa', 'Se cargó la información del usuario.');
      },
      error: (err) => {
        this.loading.set(false);
        this.user.set(null);
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
    this.activeTab.set(tab);
    if (tab === 'operacion' && this.user()?.idUsuario) {
      this.cargarOperacion();
    }
  }

  toggleEstadoUsuario(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    this.user.set({ ...u, activo: !u.activo });
  }

  readonly activeRolesCount = computed(() =>
    this.user()?.roles.filter((r) => r.estado === 'Vigente').length ?? 0
  );

  agregarRol(): void {
    if (!this.user()) {
      this.toast.warning('Roles', 'Consulta un usuario antes de asignar roles.');
      return;
    }

    if (this.rolesCatalogo().length === 0) {
      this.toast.warning('Roles', 'No hay catálogo de roles disponible.');
      return;
    }

    this.showAddRoleForm.set(true);
  }

  cancelarNuevoRol(): void {
    this.showAddRoleForm.set(false);
    this.newRole.reset({ rolId: null, justificacion: '', fechaFin: '' });
  }

  guardarDatosUsuario(): void {
    const u = this.user();
    if (!u) {
      this.toast.warning('Guardar datos', 'Primero consulta un usuario.');
      return;
    }

    // Si estamos en modo civil (editando desde el panel civil), delegar a guardarCivilUsuario()
    if (this.tipoCreacion() === 'civil' && this.modoCreacionActivo()) {
      this.guardarCivilUsuario();
      return;
    }

    if (!u.identificacion?.trim()) {
      this.toast.warning('Guardar datos', 'La identificación está vacía; vuelve a consultar el usuario.');
      return;
    }

    const payload = {
      username: u.usuarioEmpresarial || u.identificacion,
      identificacion: u.identificacion,
      nombres: u.nombres,
      apellidos: u.apellidos,
      email: u.email,
      gradAlfabetico: u.gradAlfabetico || u.grado,
      funcionario: u.funcionarioCodigo,
      undeLaborando: u.undeLaborandoCodigo,
      codigoCargo: u.codigoCargo,
      activo: u.activo
    };

    this.loading.set(true);
    this.usuarioAdminService.guardarUsuario(payload).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (!resp?.success) {
          this.toast.warning('Guardar datos', resp?.message || 'No fue posible guardar.');
          return;
        }
        this.toast.success('Guardar datos', resp.message || 'Usuario guardado correctamente.');
        this.cargarListadoUsuarios();
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(
          'Guardar datos',
          err?.error?.detail ?? err?.error?.message ?? 'Se presentó un error guardando el usuario.'
        );
      }
    });
  }

  guardarRoles(): void {
    const u = this.user();
    if (!u) {
      this.toast.warning('Roles', 'Consulta un usuario primero.');
      return;
    }

    if (!this.showAddRoleForm()) {
      this.toast.info('Roles', 'No hay cambios pendientes en roles.');
      return;
    }

    const v = this.newRole.getRawValue();
    if (!v.rolId || v.rolId <= 0) {
      this.toast.warning('Roles', 'Selecciona un rol.');
      return;
    }

    if (!v.justificacion.trim()) {
      this.toast.warning('Roles', 'La justificación es obligatoria.');
      return;
    }

    if (!v.fechaFin) {
      this.toast.warning('Roles', 'La fecha fin es obligatoria.');
      return;
    }

    this.savingRole.set(true);
    this.usuarioAdminService.asignarRol({
      usuarioId: 0,
      usuario: u.usuarioEmpresarial,
      identificacion: u.identificacion,
      rolId: v.rolId,
      justificacion: v.justificacion.trim(),
      fechaFin: v.fechaFin,
      vigente: 1
    }).subscribe({
      next: (resp) => {
        this.savingRole.set(false);
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
        this.savingRole.set(false);
        this.toast.error('Roles', err?.error?.detail ?? err?.error?.message ?? 'Error asignando rol.');
      }
    });
  }

  eliminarRol(rol: UserRole): void {
    const u = this.user();
    if (!u) {
      this.toast.warning('Roles', 'Consulta un usuario primero.');
      return;
    }

    const confirmar = confirm(`¿Deseas retirar el rol "${rol.nombre}" del usuario?`);
    if (!confirmar) {
      return;
    }

    this.deletingRoleId.set(rol.id);
    this.usuarioAdminService.eliminarRol(rol.id, u.usuarioEmpresarial, u.identificacion).subscribe({
      next: (resp) => {
        this.deletingRoleId.set(null);
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
        this.deletingRoleId.set(null);
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
    const u = this.user();
    if (!u) return;

    if (this.tipoCreacion() === 'civil') {
      // Usuario civil / otra entidad: recargar desde BD local
      const username = u.usuarioEmpresarial;
      if (!username) return;
      this.cargarUsuarioCivil({
        idUsuario:      Number(u.idUsuario) || 0,
        identificacion: u.identificacion,
        username,
        nombreCompleto: u.nombreCompleto,
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
    this.loadingListado.set(true);
    const term = (this.searchNombreListado ?? '').trim();
    const hasSearchTerm = term.length > 0;

    if (hasSearchTerm && term.length < this.minSearchChars) {
      this.isSearchMode.set(true);
      this.usuariosListado.set([]);
      this.currentPage.set(1);
      this.loadingListado.set(false);
      return;
    }

    this.isSearchMode.set(hasSearchTerm);
    const query = this.isSearchMode() ? term : '';

    this.usuarioAdminService.getListadoUsuarios(query).subscribe({
      next: (items) => {
        this.usuariosListado.set((items ?? []).map((x) => ({
          ...x,
          fechaFinRol: this.normalizeDateString(x?.fechaFinRol ?? '')
        })));
        this.currentPage.set(1);
        this.loadingListado.set(false);
      },
      error: () => {
        this.usuariosListado.set([]);
        this.currentPage.set(1);
        this.loadingListado.set(false);
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

  readonly totalUsuariosListado = computed(() => this.usuariosListado().length);

  readonly totalPaginasListado = computed(() =>
    Math.max(1, Math.ceil(this.totalUsuariosListado() / this.pageSize))
  );

  readonly usuariosListadoPaginado = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.usuariosListado().slice(start, start + this.pageSize);
  });

  canGoPrevListado(): boolean {
    return this.currentPage() > 1;
  }

  canGoNextListado(): boolean {
    return this.currentPage() < this.totalPaginasListado();
  }

  prevPaginaListado(): void {
    if (!this.canGoPrevListado()) {
      return;
    }
    this.currentPage.update(v => v - 1);
  }

  nextPaginaListado(): void {
    if (!this.canGoNextListado()) {
      return;
    }
    this.currentPage.update(v => v + 1);
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
      this.modoCreacionActivo.set(false);
      this.user.set(null);
      this.searchIdentification = identificacion;
      this.activeTab.set('datos');
      this.consultarUsuario();
    }
  }

  private cargarUsuarioCivil(item: UsuarioListadoItem): void {
    const username = String(item?.username ?? '').trim();
    if (!username) {
      this.toast.warning('Usuarios', 'El registro no tiene username para cargar edición.');
      return;
    }

    this.loading.set(true);
    this.modoCreacionActivo.set(true);
    this.tipoCreacion.set('civil');
    this.user.set(null);
    this.activeTab.set('datos');

    this.usuarioAdminService.getLocalUsuario(username).subscribe({
      next: (resp: UsuarioLocalResult) => {
        const u = resp.usuario;
        this.civilForm.reset({
          username: u.username ?? '',
          password: '',               // no se pre-carga la contraseña por seguridad
          identificacion: u.identificacion ?? '',
          nombres: u.nombres ?? '',
          apellidos: u.apellidos ?? '',
          email: u.email ?? '',
          entidad: u.entidad ?? '',
          cargo: u.cargo ?? '',
          activo: u.activo
        });
        // Cargar roles para mostrárselos (usando el panel de roles existente)
        // Reutilizamos el user profile como contenedor mínimo para los roles
        this.user.set({
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
        });
        // Pre-cargar datos operacionales del civil si están disponibles en el DTO
        this.operacionForm.reset({
          cadcanaFuerzaId: u.cadcanaFuerzaId ?? 0,
          cadcanaCodigo:   u.cadcanaCodigo ?? 0,
          acd:             u.acd ?? 0
        });
        if ((u.cadcanaFuerzaId ?? 0) > 0) {
          this.onFuerzaOperacionChange(u.cadcanaFuerzaId!);
        }
        this.rolesCatalogo.set((resp.rolesCatalogo ?? []).filter((r) => Number(r.id) > 0));
        this.loading.set(false);
        this.toast.success('Usuario civil', 'Datos cargados. Edite y guarde los cambios.');
      },
      error: (err) => {
        this.loading.set(false);
        this.modoCreacionActivo.set(false);
        this.toast.error('Usuarios', err?.error?.message ?? 'No fue posible cargar el usuario civil.');
      }
    });
  }

  abrirModalEliminarUsuario(item: UsuarioListadoItem): void {
    this.deletingTarget.set(item);
    this.deleteConfirmText.set('');
    this.showDeleteUserModal.set(true);
  }

  cerrarModalEliminarUsuario(): void {
    if (this.deletingUser()) {
      return;
    }
    this.showDeleteUserModal.set(false);
    this.deleteConfirmText.set('');
    this.deletingTarget.set(null);
  }

  confirmarEliminarUsuario(): void {
    const target = this.deletingTarget();
    if (!target) {
      return;
    }

    if (this.deleteConfirmText().trim().toUpperCase() !== 'ELIMINAR') {
      this.toast.warning('Usuarios', 'Debes escribir ELIMINAR para confirmar.');
      return;
    }

    this.deletingUser.set(true);
    this.usuarioAdminService.eliminarUsuario(target.idUsuario).subscribe({
      next: (resp) => {
        this.deletingUser.set(false);
        if (!resp?.success) {
          this.toast.warning('Usuarios', resp?.message || 'No fue posible eliminar el usuario.');
          return;
        }
        this.toast.success('Usuarios', resp.message || 'Usuario eliminado correctamente.');
        this.cerrarModalEliminarUsuario();
        this.cargarListadoUsuarios();

        if (this.user()?.identificacion?.trim() === String(target.identificacion ?? '').trim()) {
          this.user.set(null);
          this.activeTab.set('datos');
        }
      },
      error: (err) => {
        this.deletingUser.set(false);
        this.toast.error('Usuarios', err?.error?.detail ?? err?.error?.message ?? 'Error eliminando usuario.');
      }
    });
  }

  // ── Datos operacionales ────────────────────────────────────────────────────

  cargarFuerzas(): void {
    this.fuerzaService.getFuerzas().subscribe({
      next: (r) => { this.fuerzasDisponibles.set((r.data ?? []).filter(f => f.vigente === 'S')); },
      error: () => { /* silencioso; las fuerzas son secundarias */ }
    });
  }

  onFuerzaOperacionChange(fuerzaId?: number): void {
    const id = fuerzaId ?? this.operacionForm.controls.cadcanaFuerzaId.value;
    this.canalesDisponibles.set([]);
    this.operacionForm.controls.cadcanaCodigo.setValue(0);
    if (!id || id === 0) return;

    this.fuerzaService.getCanales(id).subscribe({
      next: (r) => {
        this.canalesDisponibles.set((r.data ?? []).filter(c => c.vigente === 'S'));
      },
      error: () => { this.canalesDisponibles.set([]); }
    });
  }

  cargarOperacion(): void {
    const u = this.user();
    if (!u?.idUsuario || u.idUsuario === '0') return;
    this.loadingOperacion.set(true);
    this.fuerzaService.getUsuarioOperacion(u.idUsuario).subscribe({
      next: (r) => {
        const op = r.data;
        this.operacionForm.reset({
          cadcanaFuerzaId: op.cadcanaFuerzaId ?? 0,
          cadcanaCodigo:   op.cadcanaCodigo ?? 0,
          acd:             op.acd ?? 0
        });
        this.operacionActual.set({
          fuerzaDescripcion: op.fuerzaDescripcion,
          canalDescripcion:  op.canalDescripcion
        });
        // Cargar canales de la fuerza asignada
        if ((op.cadcanaFuerzaId ?? 0) > 0) {
          this.fuerzaService.getCanales(op.cadcanaFuerzaId).subscribe({
            next: (cr) => { this.canalesDisponibles.set((cr.data ?? []).filter(c => c.vigente === 'S')); },
            error: () => {}
          });
        }
        this.loadingOperacion.set(false);
      },
      error: () => {
        this.loadingOperacion.set(false);
        this.toast.error('Operación', 'No se pudieron cargar los datos operacionales.');
      }
    });
  }

  guardarOperacion(): void {
    const u = this.user();
    if (!u?.idUsuario || u.idUsuario === '0') {
      this.toast.warning('Operación', 'No hay usuario cargado para guardar datos operacionales.');
      return;
    }
    this.savingOperacion.set(true);
    const request: DtoUsuarioOperacionRequest = this.operacionForm.getRawValue();
    this.fuerzaService.saveUsuarioOperacion(u.idUsuario, request).subscribe({
      next: (r) => {
        this.savingOperacion.set(false);
        if (r.success) {
          this.toast.success('Operación', r.message || 'Datos operacionales guardados.');
          this.cargarOperacion();
        } else {
          this.toast.warning('Operación', r.message);
        }
      },
      error: (err) => {
        this.savingOperacion.set(false);
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
