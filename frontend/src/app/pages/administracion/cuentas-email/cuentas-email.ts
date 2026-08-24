import { Component, HostListener, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService, DtoDominio } from '../../../core/services/administracion/dominio.service';
import { CuentaEmailService, DtoCuentaEmail, DtoCuentaEmailRequest, DtoCuentaEmailUsuario } from '../../../core/services/administracion/cuenta-email.service';
import { UsuarioAdminService, UsuarioListadoItem } from '../../../core/services/administracion/usuario-admin.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-cuentas-email',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './cuentas-email.html',
  styleUrls: ['./cuentas-email.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CuentasEmailComponent implements OnInit {
  private readonly toast               = inject(ToastService);
  private readonly dominioService      = inject(DominioService);
  private readonly cuentaEmailService  = inject(CuentaEmailService);
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly fb                  = inject(FormBuilder);

  readonly loading = signal(false);
  readonly saving  = signal(false);

  readonly listaCuentas       = signal<DtoCuentaEmail[]>([]);
  readonly listaAutorizados   = signal<DtoCuentaEmailUsuario[]>([]);
  readonly resultadosUsuarios = signal<UsuarioListadoItem[]>([]);
  readonly gruposCOEST        = signal<DtoDominio[]>([]);
  readonly cuentaSeleccionadaAutorizacion = signal<DtoCuentaEmail | null>(null);
  readonly buscadorUsuarios          = signal('');
  readonly loadingAutorizados        = signal(false);
  readonly loadingBusquedaUsuarios   = signal(false);
  readonly savingAutorizacion        = signal(false);
  readonly autorizadoPendienteEliminar = signal<DtoCuentaEmailUsuario | null>(null);

  readonly editingId                 = signal<number | null>(null);
  readonly imagenEncabezadoPreview   = signal('');
  readonly subiendoImagenEncabezado  = signal(false);
  /** No es un campo del formulario visible — se sube por separado (onChangeImagenEncabezado). */
  private imagenEncabezado: string | null = null;

  readonly form = this.fb.nonNullable.group({
    idDominioGrupo: [0, [Validators.min(1)]],
    nombreCuenta:   ['', [Validators.required]],
    email:          ['', [Validators.required, Validators.email]],
    claveSmtp:      [''],
    vigente:        [1]
  });

  ngOnInit(): void {
    this.cargarGrupos();
    this.cargarCuentas();
  }

  cargarGrupos(): void {
    this.dominioService.getAll().subscribe({
      next: (data) => {
        const todos = (data ?? []).map(d => ({
          idDominio: d.idDominio ?? (d as any).IdDominio,
          descripcion: d.descripcion ?? (d as any).Descripcion,
          idPadre: d.idPadre ?? (d as any).IdPadre
        } as DtoDominio));

        const organigrama = todos.find(d =>
          d.descripcion.toUpperCase() === 'ORGANIGRAMA COEST'
        );

        if (organigrama) {
          const grupos: DtoDominio[] = [];
          this.obtenerDescendencia(organigrama.idDominio, todos, 0, grupos);
          this.gruposCOEST.set(grupos);
        }
      }
    });
  }

  private obtenerDescendencia(idPadre: number, todos: DtoDominio[], nivel: number, out: DtoDominio[]): void {
    const hijos = todos.filter(d => d.idPadre === idPadre);
    hijos.forEach(h => {
      const sangria = '--'.repeat(nivel);
      out.push({ ...h, descripcion: `${sangria} ${h.descripcion}` });
      this.obtenerDescendencia(h.idDominio, todos, nivel + 1, out);
    });
  }

  cargarCuentas(): void {
    this.loading.set(true);
    this.cuentaEmailService.getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => { this.listaCuentas.set(data ?? []); },
        error: () => this.toast.error('Error', 'No se pudieron cargar las cuentas de correo')
      });
  }

  nuevo(): void {
    this.editingId.set(null);
    this.imagenEncabezadoPreview.set('');
    this.imagenEncabezado = null;
    this.form.reset({
      idDominioGrupo: 0,
      nombreCuenta: '',
      email: '',
      claveSmtp: '',
      vigente: 1
    });
  }

  onChangeImagenEncabezado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.subiendoImagenEncabezado.set(true);
    this.cuentaEmailService.uploadImagenEncabezado(file)
      .pipe(finalize(() => this.subiendoImagenEncabezado.set(false)))
      .subscribe({
        next: (resp) => {
          if (!resp?.success) { this.toast.warning('Encabezado', 'No fue posible cargar la imagen.'); return; }
          this.imagenEncabezado = resp.url;
          this.imagenEncabezadoPreview.set(resp.url);
          this.toast.success('Encabezado', 'Imagen cargada correctamente.');
        },
        error: () => this.toast.error('Encabezado', 'Error al subir la imagen.')
      });
  }

  quitarImagenEncabezado(): void {
    this.imagenEncabezado = null;
    this.imagenEncabezadoPreview.set('');
  }

  editar(item: DtoCuentaEmail): void {
    this.editingId.set(item.idCuenta);
    this.imagenEncabezadoPreview.set(item.imagenEncabezado ?? '');
    this.imagenEncabezado = item.imagenEncabezado ?? null;
    this.form.reset({
      idDominioGrupo: item.idDominioGrupo,
      nombreCuenta: item.nombreCuenta,
      email: item.email,
      claveSmtp: item.claveSmtp,
      vigente: item.vigente
    });
  }

  guardar(): void {
    const v = this.form.getRawValue();
    if (!v.nombreCuenta || !v.email || v.idDominioGrupo === 0) {
      this.form.markAllAsTouched();
      this.toast.warning('Validación', 'Por favor complete los campos obligatorios');
      return;
    }

    this.saving.set(true);
    const request: DtoCuentaEmailRequest = {
      IdDominioGrupo: v.idDominioGrupo,
      NombreCuenta: v.nombreCuenta,
      Email: v.email,
      ServidorSmtp: 'smtp.office365.com',
      Puerto: 587,
      UsuarioSmtp: v.email,
      ClaveSmtp: v.claveSmtp,
      UsarSsl: 1,
      Vigente: v.vigente,
      ImagenEncabezado: this.imagenEncabezado
    };

    const editingId = this.editingId();
    const op$ = editingId
      ? this.cuentaEmailService.update(editingId, request)
      : this.cuentaEmailService.create(request);

    op$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.success('Éxito', editingId ? 'Cuenta actualizada correctamente' : 'Cuenta creada correctamente');
        this.nuevo();
        this.cargarCuentas();
      },
      error: () => this.toast.error('Error', 'No se pudo guardar la cuenta')
    });
  }

  eliminar(item: DtoCuentaEmail): void {
    if (!confirm(`¿Está seguro de eliminar la cuenta "${item.nombreCuenta}"?`)) return;
    this.cuentaEmailService.delete(item.idCuenta).subscribe({
      next: () => { this.toast.success('Éxito', 'Cuenta eliminada'); this.cargarCuentas(); },
      error: () => this.toast.error('Error', 'No se pudo eliminar la cuenta')
    });
  }

  abrirAutorizaciones(item: DtoCuentaEmail): void {
    this.cuentaSeleccionadaAutorizacion.set(item);
    this.buscadorUsuarios.set('');
    this.resultadosUsuarios.set([]);
    this.cargarAutorizaciones();
  }

  cerrarAutorizaciones(): void {
    this.cuentaSeleccionadaAutorizacion.set(null);
    this.listaAutorizados.set([]);
    this.resultadosUsuarios.set([]);
    this.buscadorUsuarios.set('');
  }

  cargarAutorizaciones(): void {
    const cuenta = this.cuentaSeleccionadaAutorizacion();
    if (!cuenta) return;
    this.loadingAutorizados.set(true);
    this.cuentaEmailService.getAutorizaciones(cuenta.idCuenta, undefined, 1)
      .pipe(finalize(() => this.loadingAutorizados.set(false)))
      .subscribe({
        next: (data) => this.listaAutorizados.set(data ?? []),
        error: () => this.toast.error('Error', 'No se pudieron cargar los usuarios autorizados')
      });
  }

  buscarUsuarios(): void {
    const term = this.buscadorUsuarios().trim();
    if (term.length < 3) { this.toast.warning('Búsqueda', 'Escribe al menos 3 caracteres'); return; }
    this.loadingBusquedaUsuarios.set(true);
    this.usuarioAdminService.getListadoUsuarios(term)
      .pipe(finalize(() => this.loadingBusquedaUsuarios.set(false)))
      .subscribe({
        next: (data) => this.resultadosUsuarios.set(data ?? []),
        error: () => this.toast.error('Error', 'No se pudo consultar usuarios')
      });
  }

  agregarAutorizado(user: UsuarioListadoItem): void {
    const cuenta = this.cuentaSeleccionadaAutorizacion();
    if (!cuenta) return;
    if (this.listaAutorizados().some(x => x.idUsuario === user.idUsuario)) {
      this.toast.warning('Autorizaciones', 'El usuario ya está autorizado en esta cuenta');
      return;
    }
    this.savingAutorizacion.set(true);
    this.cuentaEmailService.crearAutorizacion({ idCuenta: cuenta.idCuenta, idUsuario: user.idUsuario })
      .pipe(finalize(() => this.savingAutorizacion.set(false)))
      .subscribe({
        next: () => { this.toast.success('Éxito', 'Usuario autorizado correctamente'); this.cargarAutorizaciones(); },
        error: (err) => this.toast.error('Error', err?.error?.message ?? 'No se pudo autorizar el usuario')
      });
  }

  solicitarQuitarAutorizado(item: DtoCuentaEmailUsuario): void { this.autorizadoPendienteEliminar.set(item); }
  cancelarQuitarAutorizado(): void { this.autorizadoPendienteEliminar.set(null); }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.autorizadoPendienteEliminar() && !this.savingAutorizacion()) this.cancelarQuitarAutorizado();
  }

  confirmarQuitarAutorizado(): void {
    const item = this.autorizadoPendienteEliminar();
    if (!item) return;
    this.savingAutorizacion.set(true);
    this.cuentaEmailService.eliminarAutorizacion(item.idCuentaUsuario)
      .pipe(finalize(() => this.savingAutorizacion.set(false)))
      .subscribe({
        next: () => { this.toast.success('Éxito', 'Autorización removida'); this.autorizadoPendienteEliminar.set(null); this.cargarAutorizaciones(); },
        error: (err) => this.toast.error('Error', err?.error?.message ?? 'No se pudo quitar la autorización')
      });
  }

  getNombreGrupo(idDominio: number): string {
    const grupo = this.gruposCOEST().find(g => g.idDominio === idDominio);
    if (!grupo) return 'Desconocido';
    return grupo.descripcion.replace(/^-+ /, '');
  }
}
