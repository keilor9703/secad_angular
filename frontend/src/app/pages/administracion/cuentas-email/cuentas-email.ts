import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService, DtoDominio } from '../../../core/services/administracion/dominio.service';
import { CuentaEmailService, DtoCuentaEmail, DtoCuentaEmailRequest, DtoCuentaEmailUsuario } from '../../../core/services/administracion/cuenta-email.service';
import { UsuarioAdminService, UsuarioListadoItem } from '../../../core/services/administracion/usuario-admin.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-cuentas-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cuentas-email.html',
  styleUrls: ['./cuentas-email.scss']
})
export class CuentasEmailComponent implements OnInit {
  loading = false;
  saving = false;

  listaCuentas: DtoCuentaEmail[] = [];
  listaAutorizados: DtoCuentaEmailUsuario[] = [];
  resultadosUsuarios: UsuarioListadoItem[] = [];
  gruposCOEST: DtoDominio[] = [];
  cuentaSeleccionadaAutorizacion: DtoCuentaEmail | null = null;
  buscadorUsuarios = '';
  loadingAutorizados = false;
  loadingBusquedaUsuarios = false;
  savingAutorizacion = false;
  autorizadoPendienteEliminar: DtoCuentaEmailUsuario | null = null;

  editingId: number | null = null;
  imagenEncabezadoPreview = '';
  subiendoImagenEncabezado = false;

  form: DtoCuentaEmailRequest = {
    IdDominioGrupo: 0,
    NombreCuenta: '',
    Email: '',
    ServidorSmtp: '',
    Puerto: 587,
    UsuarioSmtp: '',
    ClaveSmtp: '',
    UsarSsl: 1,
    Vigente: 1,
    ImagenEncabezado: null
  };

  constructor(
    private toast: ToastService,
    private dominioService: DominioService,
    private cuentaEmailService: CuentaEmailService,
    private usuarioAdminService: UsuarioAdminService
  ) {}

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
          const idOrganigrama = organigrama.idDominio;
          this.gruposCOEST = [];
          this.obtenerDescendencia(idOrganigrama, todos, 0);
        }
      }
    });
  }

  private obtenerDescendencia(idPadre: number, todos: DtoDominio[], nivel: number): void {
    const hijos = todos.filter(d => d.idPadre === idPadre);
    hijos.forEach(h => {
      const sangria = '--'.repeat(nivel);
      this.gruposCOEST.push({ ...h, descripcion: `${sangria} ${h.descripcion}` });
      this.obtenerDescendencia(h.idDominio, todos, nivel + 1);
    });
  }

  cargarCuentas(): void {
    this.loading = true;
    this.cuentaEmailService.getAll()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => { this.listaCuentas = data ?? []; },
        error: () => this.toast.error('Error', 'No se pudieron cargar las cuentas de correo')
      });
  }

  nuevo(): void {
    this.editingId = null;
    this.imagenEncabezadoPreview = '';
    this.form = {
      IdDominioGrupo: 0,
      NombreCuenta: '',
      Email: '',
      ServidorSmtp: 'smtp.office365.com',
      Puerto: 587,
      UsuarioSmtp: '',
      ClaveSmtp: '',
      UsarSsl: 1,
      Vigente: 1,
      ImagenEncabezado: null
    };
  }

  onChangeImagenEncabezado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.subiendoImagenEncabezado = true;
    this.cuentaEmailService.uploadImagenEncabezado(file)
      .pipe(finalize(() => (this.subiendoImagenEncabezado = false)))
      .subscribe({
        next: (resp) => {
          if (!resp?.success) { this.toast.warning('Encabezado', 'No fue posible cargar la imagen.'); return; }
          this.form.ImagenEncabezado = resp.url;
          this.imagenEncabezadoPreview = resp.url;
          this.toast.success('Encabezado', 'Imagen cargada correctamente.');
        },
        error: () => this.toast.error('Encabezado', 'Error al subir la imagen.')
      });
  }

  quitarImagenEncabezado(): void {
    this.form.ImagenEncabezado = null;
    this.imagenEncabezadoPreview = '';
  }

  editar(item: DtoCuentaEmail): void {
    this.editingId = item.idCuenta;
    this.imagenEncabezadoPreview = item.imagenEncabezado ?? '';
    this.form = {
      IdDominioGrupo: item.idDominioGrupo,
      NombreCuenta: item.nombreCuenta,
      Email: item.email,
      ServidorSmtp: item.servidorSmtp,
      Puerto: item.puerto,
      UsuarioSmtp: item.usuarioSmtp,
      ClaveSmtp: item.claveSmtp,
      UsarSsl: item.usarSsl,
      Vigente: item.vigente,
      ImagenEncabezado: item.imagenEncabezado ?? null
    };
  }

  guardar(): void {
    if (!this.form.NombreCuenta || !this.form.Email || this.form.IdDominioGrupo === 0) {
      this.toast.warning('Validación', 'Por favor complete los campos obligatorios');
      return;
    }

    this.saving = true;
    this.form.ServidorSmtp = 'smtp.office365.com';
    this.form.Puerto = 587;
    this.form.UsarSsl = 1;
    this.form.UsuarioSmtp = this.form.Email;

    const op$ = this.editingId
      ? this.cuentaEmailService.update(this.editingId, this.form)
      : this.cuentaEmailService.create(this.form);

    op$.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.toast.success('Éxito', this.editingId ? 'Cuenta actualizada correctamente' : 'Cuenta creada correctamente');
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
    this.cuentaSeleccionadaAutorizacion = item;
    this.buscadorUsuarios = '';
    this.resultadosUsuarios = [];
    this.cargarAutorizaciones();
  }

  cerrarAutorizaciones(): void {
    this.cuentaSeleccionadaAutorizacion = null;
    this.listaAutorizados = [];
    this.resultadosUsuarios = [];
    this.buscadorUsuarios = '';
  }

  cargarAutorizaciones(): void {
    if (!this.cuentaSeleccionadaAutorizacion) return;
    this.loadingAutorizados = true;
    this.cuentaEmailService.getAutorizaciones(this.cuentaSeleccionadaAutorizacion.idCuenta, undefined, 1)
      .pipe(finalize(() => this.loadingAutorizados = false))
      .subscribe({
        next: (data) => this.listaAutorizados = data ?? [],
        error: () => this.toast.error('Error', 'No se pudieron cargar los usuarios autorizados')
      });
  }

  buscarUsuarios(): void {
    const term = this.buscadorUsuarios.trim();
    if (term.length < 3) { this.toast.warning('Búsqueda', 'Escribe al menos 3 caracteres'); return; }
    this.loadingBusquedaUsuarios = true;
    this.usuarioAdminService.getListadoUsuarios(term)
      .pipe(finalize(() => this.loadingBusquedaUsuarios = false))
      .subscribe({
        next: (data) => this.resultadosUsuarios = data ?? [],
        error: () => this.toast.error('Error', 'No se pudo consultar usuarios')
      });
  }

  agregarAutorizado(user: UsuarioListadoItem): void {
    if (!this.cuentaSeleccionadaAutorizacion) return;
    if (this.listaAutorizados.some(x => x.idUsuario === user.idUsuario)) {
      this.toast.warning('Autorizaciones', 'El usuario ya está autorizado en esta cuenta');
      return;
    }
    this.savingAutorizacion = true;
    this.cuentaEmailService.crearAutorizacion({ idCuenta: this.cuentaSeleccionadaAutorizacion.idCuenta, idUsuario: user.idUsuario })
      .pipe(finalize(() => this.savingAutorizacion = false))
      .subscribe({
        next: () => { this.toast.success('Éxito', 'Usuario autorizado correctamente'); this.cargarAutorizaciones(); },
        error: (err) => this.toast.error('Error', err?.error?.message ?? 'No se pudo autorizar el usuario')
      });
  }

  solicitarQuitarAutorizado(item: DtoCuentaEmailUsuario): void { this.autorizadoPendienteEliminar = item; }
  cancelarQuitarAutorizado(): void { this.autorizadoPendienteEliminar = null; }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.autorizadoPendienteEliminar && !this.savingAutorizacion) this.cancelarQuitarAutorizado();
  }

  confirmarQuitarAutorizado(): void {
    const item = this.autorizadoPendienteEliminar;
    if (!item) return;
    this.savingAutorizacion = true;
    this.cuentaEmailService.eliminarAutorizacion(item.idCuentaUsuario)
      .pipe(finalize(() => this.savingAutorizacion = false))
      .subscribe({
        next: () => { this.toast.success('Éxito', 'Autorización removida'); this.autorizadoPendienteEliminar = null; this.cargarAutorizaciones(); },
        error: (err) => this.toast.error('Error', err?.error?.message ?? 'No se pudo quitar la autorización')
      });
  }

  getNombreGrupo(idDominio: number): string {
    const grupo = this.gruposCOEST.find(g => g.idDominio === idDominio);
    if (!grupo) return 'Desconocido';
    return grupo.descripcion.replace(/^-+ /, '');
  }
}
