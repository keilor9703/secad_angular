import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './roles-admin.html',
  styleUrls: ['./roles-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolesAdminComponent implements OnInit {
  private readonly rolesService = inject(RolesAdminService);
  private readonly menuService  = inject(MenuService);
  private readonly toast        = inject(ToastService);
  private readonly fb           = inject(FormBuilder);

  readonly minimized         = signal(false);
  readonly visible           = signal(true);
  readonly loading           = signal(false);
  readonly saving            = signal(false);
  readonly loadingRoleMenus  = signal(false);
  readonly savingRoleMenu    = signal(false);

  readonly roles     = signal<RolAdminItem[]>([]);
  readonly allMenus  = signal<DbMenuItem[]>([]);
  readonly roleMenus = signal<RoleMenuItem[]>([]);

  readonly editingId      = signal<number | null>(null);
  readonly selectedRoleId = signal<number | null>(null);
  readonly selectedMenuId = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre:  ['', [Validators.required]],
    vigente: [1]
  });

  ngOnInit(): void {
    this.loadMenus();
    this.loadRoles();
  }

  toggleMinimize(): void {
    this.minimized.update(v => !v);
  }

  loadRoles(): void {
    this.loading.set(true);
    this.rolesService.getAll().subscribe({
      next: (data) => {
        const sorted = (data ?? []).slice().sort((a, b) => {
          const aa = (a.nombre ?? '').toString();
          const bb = (b.nombre ?? '').toString();
          return aa.localeCompare(bb);
        });
        this.roles.set(sorted);

        const selected = this.selectedRoleId();
        if (selected && !sorted.some((r) => r.id === selected)) {
          this.selectedRoleId.set(null);
          this.roleMenus.set([]);
        }

        if (!this.selectedRoleId() && sorted.length > 0) {
          this.seleccionarRolPermisos(sorted[0]);
        }

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.roles.set([]);
        this.toast.error('Roles', err?.error?.message ?? 'No fue posible consultar los roles.');
      }
    });
  }

  loadMenus(): void {
    this.menuService.getAdminMenu().subscribe({
      next: (items) => {
        this.allMenus.set((items ?? [])
          .filter((x) => !this.isRaiz(x))
          .slice()
          .sort((a, b) => a.idPadre - b.idPadre || a.posicion - b.posicion || a.descripcion.localeCompare(b.descripcion)));
      },
      error: () => {
        this.allMenus.set([]);
      }
    });
  }

  nuevo(): void {
    this.editingId.set(null);
    this.form.reset(this.getDefaultForm());
  }

  editar(item: RolAdminItem): void {
    this.editingId.set(item.id);
    this.form.reset({
      nombre: (item.nombre ?? '').trim(),
      vigente: item.vigente === 0 ? 0 : 1
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Roles', 'La descripción del rol es obligatoria.');
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.rolesService
      .save({
        id: this.editingId(),
        nombre: v.nombre.trim(),
        vigente: v.vigente === 0 ? 0 : 1
      })
      .subscribe({
        next: (resp) => {
          this.saving.set(false);
          if (!resp?.success) {
            this.toast.warning('Roles', resp?.message || 'No fue posible guardar el rol.');
            return;
          }

          this.toast.success('Roles', resp.message || 'Rol guardado correctamente.');
          this.nuevo();
          this.loadRoles();
        },
        error: (err) => {
          this.saving.set(false);
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
    this.selectedRoleId.set(item.id);
    this.selectedMenuId.set(null);
    this.cargarMenusPorRol(item.id);
  }

  cargarMenusPorRol(idRol: number): void {
    this.loadingRoleMenus.set(true);
    this.menuService.getMenusByRol(idRol).subscribe({
      next: (data) => {
        this.roleMenus.set((data ?? []).slice().sort((a, b) => a.idPadre - b.idPadre || a.posicion - b.posicion || a.descripcionMenu.localeCompare(b.descripcionMenu)));
        this.loadingRoleMenus.set(false);
      },
      error: (err) => {
        this.roleMenus.set([]);
        this.loadingRoleMenus.set(false);
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
  readonly availableMenus = computed(() => {
    const assigned = new Set(this.roleMenus().map((x) => x.idMenu));
    return this.allMenus().filter((m) =>
      !assigned.has(m.idMenu) &&
      !!m.detalle?.trim()      // solo ítems con ruta (ítems hoja)
    );
  });

  asignarMenu(): void {
    const roleId = this.selectedRoleId();
    if (!roleId || roleId <= 0) {
      this.toast.warning('Permisos de menú', 'Selecciona un rol.');
      return;
    }

    const menuId = this.selectedMenuId();
    if (!menuId || menuId <= 0) {
      this.toast.warning('Permisos de menú', 'Selecciona un menú.');
      return;
    }

    this.savingRoleMenu.set(true);
    this.menuService.assignMenuToRol(roleId, { idMenu: menuId }).subscribe({
      next: (resp) => {
        this.savingRoleMenu.set(false);
        if (!resp?.success) {
          this.toast.warning('Permisos de menú', resp?.message || 'No fue posible asignar menú.');
          return;
        }
        this.toast.success('Permisos de menú', resp.message || 'Menú asignado.');
        this.selectedMenuId.set(null);
        this.cargarMenusPorRol(roleId);
      },
      error: (err) => {
        this.savingRoleMenu.set(false);
        this.toast.error('Permisos de menú', err?.error?.detail ?? err?.error?.message ?? 'Error asignando menú.');
      }
    });
  }

  quitarMenu(item: RoleMenuItem): void {
    const roleId = this.selectedRoleId();
    if (!roleId || roleId <= 0) {
      return;
    }

    this.menuService.removeMenuFromRol(roleId, item.idMenu).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Permisos de menú', resp?.message || 'No fue posible quitar menú.');
          return;
        }
        this.toast.success('Permisos de menú', resp.message || 'Menú retirado del rol.');
        this.cargarMenusPorRol(roleId);
      },
      error: (err) => {
        this.toast.error('Permisos de menú', err?.error?.detail ?? err?.error?.message ?? 'Error retirando menú.');
      }
    });
  }

  readonly selectedRoleName = computed(() => {
    const roleId = this.selectedRoleId();
    if (!roleId) {
      return 'Sin rol seleccionado';
    }
    const role = this.roles().find((r) => r.id === roleId);
    return role?.nombre?.trim() || `Rol ${roleId}`;
  });

  formatMenuLabel(menu: DbMenuItem): string {
    const prefix = menu.idPadre === 1 ? '' : '↳ ';
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
