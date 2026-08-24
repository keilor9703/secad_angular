import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DbMenuItem,
  MenuRolCatalogItem,
  MenuRolItem,
  MenuSaveRequest,
  MenuService
} from '../../../core/services/administracion/menu.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-menu-admin',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './menu-admin.html',
  styleUrls: ['./menu-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuAdminComponent implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly toast       = inject(ToastService);
  private readonly fb          = inject(FormBuilder);

  readonly minimized = signal(false);
  readonly visible   = signal(true);
  readonly loading   = signal(false);
  readonly saving    = signal(false);

  readonly menuItems             = signal<DbMenuItem[]>([]);
  readonly parentOptions         = signal<DbMenuItem[]>([]);
  /** Solo se muta desde clicks de plantilla (toggleChildren) — no necesita ser signal. */
  expandedParents = new Set<number>();
  readonly selectedMenuForRoles  = signal<DbMenuItem | null>(null);
  readonly rolesCatalog          = signal<MenuRolCatalogItem[]>([]);
  readonly rolesAsignados        = signal<MenuRolItem[]>([]);
  readonly selectedRolId         = signal<number | null>(null);
  readonly loadingRoles          = signal(false);
  readonly savingRole            = signal(false);
  readonly editingId             = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    descripcion: ['', [Validators.required]],
    idPadre:     [0],
    posicion:    [0, [Validators.min(0)]],
    tipo:        ['S', [Validators.required]],
    icono:       [''],
    vigente:     [1],
    detalle:     ['']
  });

  ngOnInit(): void {
    this.loadMenu();
  }

  toggleMinimize(): void {
    this.minimized.update(v => !v);
  }

  closePanel(): void {
    this.visible.set(false);
  }

  loadMenu(): void {
    this.loading.set(true);
    this.menuService.getAdminMenu().subscribe({
      next: (items) => {
        // Normalizar: el backend devuelve PascalCase (IdMenu, IdPadre…); aquí se
        // mapea de forma defensiva aceptando también camelCase para robustez futura.
        const mapped = (items ?? [])
          .map((i) => this.normalizeItem(i))
          .sort((a, b) => a.idPadre - b.idPadre || a.posicion - b.posicion);
        this.menuItems.set(mapped);

        this.parentOptions.set(
          mapped.filter((item) => !this.isRaiz(item)).slice().sort((a, b) => a.descripcion.localeCompare(b.descripcion))
        );

        this.expandedParents.clear();
        this.selectedMenuForRoles.set(null);
        this.rolesAsignados.set([]);
        this.selectedRolId.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Menú', err?.error?.message ?? 'No fue posible cargar el menú.');
      }
    });
  }

  nuevo(): void {
    this.editingId.set(null);
    const d = this.getDefaultForm();
    this.form.reset({
      descripcion: d.descripcion,
      idPadre: d.idPadre,
      posicion: d.posicion,
      tipo: d.tipo,
      icono: d.icono ?? '',
      vigente: d.vigente,
      detalle: d.detalle ?? ''
    });
  }

  editar(item: DbMenuItem): void {
    this.editingId.set(item.idMenu);
    this.form.reset({
      descripcion: item.descripcion ?? '',
      idPadre: item.idPadre ?? 0,
      posicion: item.posicion ?? 0,
      tipo: item.tipo ?? 'S',
      icono: item.icono ?? '',
      vigente: item.vigente ?? 1,
      detalle: item.detalle ?? ''
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const v = this.form.getRawValue();
      if (!v.descripcion.trim()) {
        this.toast.warning('Menú', 'La descripción es obligatoria.');
      } else if (!v.tipo.trim()) {
        this.toast.warning('Menú', 'El tipo es obligatorio.');
      } else if (v.posicion < 0) {
        this.toast.warning('Menú', 'La posición no puede ser negativa.');
      }
      return;
    }

    this.saving.set(true);
    const request: MenuSaveRequest = { idMenu: this.editingId(), ...this.form.getRawValue() };
    this.menuService.saveAdminMenu(request).subscribe({
      next: (resp) => {
        this.saving.set(false);
        if (!resp?.success) {
          this.toast.warning('Menú', resp?.message || 'No fue posible guardar.');
          return;
        }
        this.toast.success('Menú', resp.message || 'Menú guardado correctamente.');
        this.nuevo();
        this.loadMenu();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Menú', err?.error?.detail ?? err?.error?.message ?? 'Error guardando menú.');
      }
    });
  }

  cambiarEstado(item: DbMenuItem): void {
    const nuevoEstado = item.vigente === 1 ? 0 : 1;
    this.menuService.setEstadoAdminMenu(item.idMenu, { vigente: nuevoEstado }).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Menú', resp?.message || 'No fue posible actualizar estado.');
          return;
        }
        this.toast.success('Menú', resp.message || 'Estado actualizado.');
        this.loadMenu();
      },
      error: (err) => {
        this.toast.error('Menú', err?.error?.detail ?? err?.error?.message ?? 'Error actualizando estado.');
      }
    });
  }

  gestionarRoles(item: DbMenuItem): void {
    this.selectedMenuForRoles.set(item);
    this.selectedRolId.set(null);
    this.loadRolesPanel(item.idMenu);
  }

  cargarCatalogoRoles(): void {
    this.menuService.getRolesCatalog().subscribe({
      next: (roles) => {
        this.rolesCatalog.set((roles ?? [])
          .map((r: any) => ({
            idRol:       Number(r?.idRol       ?? r?.IdRol       ?? 0),
            descripcion: String(r?.descripcion ?? r?.Descripcion ?? ''),
          }))
          .sort((a, b) => a.descripcion.localeCompare(b.descripcion)));
      },
      error: (err) => {
        this.rolesCatalog.set([]);
        this.toast.error('Roles menú', err?.error?.message ?? 'No fue posible cargar el catálogo de roles.');
      }
    });
  }

  loadRolesPanel(idMenu: number): void {
    this.loadingRoles.set(true);

    if (this.rolesCatalog().length === 0) {
      this.cargarCatalogoRoles();
    }

    this.menuService.getRolesByMenu(idMenu).subscribe({
      next: (data) => {
        this.rolesAsignados.set((data ?? [])
          .map((r: any) => ({
            idMenuRol:      Number(r?.idMenuRol      ?? r?.IdMenuRol      ?? 0),
            idRol:          Number(r?.idRol          ?? r?.IdRol          ?? 0),
            descripcionRol: String(r?.descripcionRol ?? r?.DescripcionRol ?? ''),
          }))
          .sort((a, b) => a.descripcionRol.localeCompare(b.descripcionRol)));
        this.loadingRoles.set(false);
      },
      error: (err) => {
        this.rolesAsignados.set([]);
        this.loadingRoles.set(false);
        this.toast.error('Roles menú', err?.error?.message ?? 'No fue posible consultar roles del menú.');
      }
    });
  }

  asignarRolMenu(): void {
    const menu = this.selectedMenuForRoles();
    if (!menu) {
      this.toast.warning('Roles menú', 'Selecciona un menú para gestionar roles.');
      return;
    }

    const rolId = this.selectedRolId();
    if (!rolId || rolId <= 0) {
      this.toast.warning('Roles menú', 'Selecciona un rol.');
      return;
    }

    this.savingRole.set(true);
    this.menuService.assignRolToMenu(menu.idMenu, { idRol: rolId }).subscribe({
      next: (resp) => {
        this.savingRole.set(false);
        if (!resp?.success) {
          this.toast.warning('Roles menú', resp?.message || 'No fue posible asignar el rol.');
          return;
        }
        this.toast.success('Roles menú', resp.message || 'Rol asignado correctamente.');
        this.selectedRolId.set(null);
        this.loadRolesPanel(menu.idMenu);
      },
      error: (err) => {
        this.savingRole.set(false);
        this.toast.error('Roles menú', err?.error?.detail ?? err?.error?.message ?? 'Error asignando rol.');
      }
    });
  }

  quitarRolMenu(item: MenuRolItem): void {
    const menu = this.selectedMenuForRoles();
    if (!menu) {
      return;
    }

    this.menuService.removeRolFromMenu(menu.idMenu, item.idRol).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Roles menú', resp?.message || 'No fue posible quitar el rol.');
          return;
        }
        this.toast.success('Roles menú', resp.message || 'Rol retirado del menú.');
        this.loadRolesPanel(menu.idMenu);
      },
      error: (err) => {
        this.toast.error('Roles menú', err?.error?.detail ?? err?.error?.message ?? 'Error retirando rol.');
      }
    });
  }

  /**
   * ID del ítem raíz: el nodo que se auto-referencia (idPadre === idMenu).
   * Si no existe auto-referencia se busca el primer ítem con descripción "RAIZ"
   * o, como último recurso, el de id = 1.
   */
  readonly raizId = computed(() => {
    const items = this.menuItems();
    const selfRef = items.find(i => i.idMenu !== 0 && i.idMenu === i.idPadre);
    if (selfRef) return selfRef.idMenu;
    const byName = items.find(i => (i.descripcion ?? '').trim().toUpperCase() === 'RAIZ');
    if (byName) return byName.idMenu;
    return 1;
  });

  readonly parentMenuItems = computed(() => {
    const root = this.raizId();
    return this.menuItems()
      .filter((item) => item.idPadre === root && !this.isRaiz(item))
      .sort((a, b) => a.posicion - b.posicion || a.idMenu - b.idMenu);
  });

  getChildrenOf(parentId: number): DbMenuItem[] {
    return this.menuItems()
      .filter((item) => item.idPadre === parentId)
      .sort((a, b) => a.posicion - b.posicion || a.idMenu - b.idMenu);
  }

  hasChildren(parentId: number): boolean {
    return this.menuItems().some((item) => item.idPadre === parentId);
  }

  isExpanded(parentId: number): boolean {
    return this.expandedParents.has(parentId);
  }

  toggleChildren(parentId: number): void {
    if (this.expandedParents.has(parentId)) {
      this.expandedParents.delete(parentId);
      return;
    }
    this.expandedParents.add(parentId);
  }

  private getDefaultForm(): MenuSaveRequest {
    return {
      idMenu: null,
      descripcion: '',
      idPadre: 0,
      posicion: 0,
      tipo: 'S',
      icono: '',
      vigente: 1,
      detalle: ''
    };
  }

  private isRaiz(item: DbMenuItem): boolean {
    // Un nodo es raíz cuando se auto-referencia (idPadre === idMenu),
    // tiene la descripción "RAIZ", o históricamente tiene id = 1.
    return (item.idMenu !== 0 && item.idMenu === item.idPadre)
        || (item.descripcion ?? '').trim().toUpperCase() === 'RAIZ'
        || item.idMenu === 1;
  }

  /**
   * Normaliza un ítem del menú recibido del backend.
   * El backend usa System.Text.Json sin camelCase policy, por lo que
   * las propiedades llegan en PascalCase (IdMenu, IdPadre…).
   * Acepta ambas grafías para no depender de la configuración del servidor.
   */
  private normalizeItem(raw: any): DbMenuItem {
    return {
      idMenu:      Number(raw?.idMenu      ?? raw?.IdMenu      ?? 0),
      descripcion: String(raw?.descripcion ?? raw?.Descripcion ?? ''),
      idPadre:     Number(raw?.idPadre     ?? raw?.IdPadre     ?? 0),
      posicion:    Number(raw?.posicion    ?? raw?.Posicion    ?? 0),
      tipo:        String(raw?.tipo        ?? raw?.Tipo        ?? ''),
      icono:       raw?.icono   ?? raw?.Icono   ?? null,
      vigente:     Number(raw?.vigente     ?? raw?.Vigente     ?? 1),
      detalle:     raw?.detalle ?? raw?.Detalle ?? null,
    };
  }
}
