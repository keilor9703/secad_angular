import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RolAdminItem,
  RolesAdminService,
  SaveRolAdminRequest
} from '../../../core/services/administracion/roles-admin.service';
import { DbMenuItem, MenuService, RoleMenuItem } from '../../../core/services/administracion/menu.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-roles-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles-admin.html',
  styleUrls: ['./roles-admin.scss']
})
export class RolesAdminComponent implements OnInit {
  minimized = false;
  visible = true;
  loading = false;
  saving = false;
  loadingRoleMenus = false;
  savingRoleMenu = false;

  roles: RolAdminItem[] = [];
  allMenus: DbMenuItem[] = [];
  roleMenus: RoleMenuItem[] = [];

  editingId: number | null = null;
  selectedRoleId: number | null = null;
  selectedMenuId: number | null = null;

  form: SaveRolAdminRequest = this.getDefaultForm();

  constructor(
    private readonly rolesService: RolesAdminService,
    private readonly menuService: MenuService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadMenus();
    this.loadRoles();
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  loadRoles(): void {
    this.loading = true;
    this.rolesService.getAll().subscribe({
      next: (data) => {
        this.roles = (data ?? []).slice().sort((a, b) => {
          const aa = (a.nombre ?? '').toString();
          const bb = (b.nombre ?? '').toString();
          return aa.localeCompare(bb);
        });

        if (this.selectedRoleId && !this.roles.some((r) => r.id === this.selectedRoleId)) {
          this.selectedRoleId = null;
          this.roleMenus = [];
        }

        if (!this.selectedRoleId && this.roles.length > 0) {
          this.seleccionarRolPermisos(this.roles[0]);
        }

        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.roles = [];
        this.toast.error('Roles', err?.error?.message ?? 'No fue posible consultar los roles.');
      }
    });
  }

  loadMenus(): void {
    this.menuService.getAdminMenu().subscribe({
      next: (items) => {
        this.allMenus = (items ?? [])
          .filter((x) => !this.isRaiz(x))
          .slice()
          .sort((a, b) => a.idPadre - b.idPadre || a.posicion - b.posicion || a.descripcion.localeCompare(b.descripcion));
      },
      error: () => {
        this.allMenus = [];
      }
    });
  }

  nuevo(): void {
    this.editingId = null;
    this.form = this.getDefaultForm();
  }

  editar(item: RolAdminItem): void {
    this.editingId = item.id;
    this.form = {
      id: item.id,
      nombre: (item.nombre ?? '').trim(),
      vigente: item.vigente === 0 ? 0 : 1
    };
  }

  guardar(): void {
    const nombre = (this.form.nombre ?? '').trim();
    if (!nombre) {
      this.toast.warning('Roles', 'La descripción del rol es obligatoria.');
      return;
    }

    this.saving = true;
    this.rolesService
      .save({
        id: this.form.id ?? null,
        nombre,
        vigente: this.form.vigente === 0 ? 0 : 1
      })
      .subscribe({
        next: (resp) => {
          this.saving = false;
          if (!resp?.success) {
            this.toast.warning('Roles', resp?.message || 'No fue posible guardar el rol.');
            return;
          }

          this.toast.success('Roles', resp.message || 'Rol guardado correctamente.');
          this.nuevo();
          this.loadRoles();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error('Roles', err?.error?.detail ?? err?.error?.message ?? 'Error guardando rol.');
        }
      });
  }

  cambiarEstado(item: RolAdminItem): void {
    const nuevoEstado = item.vigente === 1 ? 0 : 1;
    this.rolesService.setEstado(item.id, { vigente: nuevoEstado }).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Roles', resp?.message || 'No fue posible actualizar estado.');
          return;
        }

        this.toast.success('Roles', resp.message || 'Estado actualizado.');
        this.loadRoles();
      },
      error: (err) => {
        this.toast.error('Roles', err?.error?.detail ?? err?.error?.message ?? 'Error actualizando estado.');
      }
    });
  }

  seleccionarRolPermisos(item: RolAdminItem): void {
    this.selectedRoleId = item.id;
    this.selectedMenuId = null;
    this.cargarMenusPorRol(item.id);
  }

  cargarMenusPorRol(idRol: number): void {
    this.loadingRoleMenus = true;
    this.menuService.getMenusByRol(idRol).subscribe({
      next: (data) => {
        this.roleMenus = (data ?? []).slice().sort((a, b) => a.idPadre - b.idPadre || a.posicion - b.posicion || a.descripcionMenu.localeCompare(b.descripcionMenu));
        this.loadingRoleMenus = false;
      },
      error: (err) => {
        this.roleMenus = [];
        this.loadingRoleMenus = false;
        this.toast.error('Permisos de menú', err?.error?.message ?? 'No fue posible consultar menús del rol.');
      }
    });
  }

  /**
   * Ítems de menú disponibles para asignar al rol.
   * Se muestran SOLO los ítems hoja (que tienen detalle/ruta configurada),
   * nunca los grupos padre. Esto evita que el admin asigne accidentalmente
   * un grupo entero en vez de un módulo específico.
   */
  get availableMenus(): DbMenuItem[] {
    const assigned = new Set(this.roleMenus.map((x) => x.idMenu));
    return this.allMenus.filter((m) =>
      !assigned.has(m.idMenu) &&
      !!m.detalle?.trim()      // solo ítems con ruta (ítems hoja)
    );
  }

  asignarMenu(): void {
    if (!this.selectedRoleId || this.selectedRoleId <= 0) {
      this.toast.warning('Permisos de menú', 'Selecciona un rol.');
      return;
    }

    if (!this.selectedMenuId || this.selectedMenuId <= 0) {
      this.toast.warning('Permisos de menú', 'Selecciona un menú.');
      return;
    }

    this.savingRoleMenu = true;
    this.menuService.assignMenuToRol(this.selectedRoleId, { idMenu: this.selectedMenuId }).subscribe({
      next: (resp) => {
        this.savingRoleMenu = false;
        if (!resp?.success) {
          this.toast.warning('Permisos de menú', resp?.message || 'No fue posible asignar menú.');
          return;
        }
        this.toast.success('Permisos de menú', resp.message || 'Menú asignado.');
        this.selectedMenuId = null;
        this.cargarMenusPorRol(this.selectedRoleId!);
      },
      error: (err) => {
        this.savingRoleMenu = false;
        this.toast.error('Permisos de menú', err?.error?.detail ?? err?.error?.message ?? 'Error asignando menú.');
      }
    });
  }

  quitarMenu(item: RoleMenuItem): void {
    if (!this.selectedRoleId || this.selectedRoleId <= 0) {
      return;
    }

    this.menuService.removeMenuFromRol(this.selectedRoleId, item.idMenu).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Permisos de menú', resp?.message || 'No fue posible quitar menú.');
          return;
        }
        this.toast.success('Permisos de menú', resp.message || 'Menú retirado del rol.');
        this.cargarMenusPorRol(this.selectedRoleId!);
      },
      error: (err) => {
        this.toast.error('Permisos de menú', err?.error?.detail ?? err?.error?.message ?? 'Error retirando menú.');
      }
    });
  }

  get selectedRoleName(): string {
    if (!this.selectedRoleId) {
      return 'Sin rol seleccionado';
    }
    const role = this.roles.find((r) => r.id === this.selectedRoleId);
    return role?.nombre?.trim() || `Rol ${this.selectedRoleId}`;
  }

  formatMenuLabel(menu: DbMenuItem): string {
    const prefix = menu.idPadre === 1 ? '' : '\u21B3 ';
    return `${prefix}${menu.descripcion} (ID ${menu.idMenu})`;
  }

  private isRaiz(item: DbMenuItem): boolean {
    return item.idMenu === 1 || (item.descripcion ?? '').trim().toUpperCase() === 'RAIZ';
  }

  private getDefaultForm(): SaveRolAdminRequest {
    return {
      id: null,
      nombre: '',
      vigente: 1
    };
  }
}


