import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-admin.html',
  styleUrls: ['./menu-admin.scss']
})
export class MenuAdminComponent implements OnInit {
  minimized = false;
  visible = true;
  loading = false;
  saving = false;

  menuItems: DbMenuItem[] = [];
  parentOptions: DbMenuItem[] = [];
  expandedParents = new Set<number>();
  selectedMenuForRoles: DbMenuItem | null = null;
  rolesCatalog: MenuRolCatalogItem[] = [];
  rolesAsignados: MenuRolItem[] = [];
  selectedRolId: number | null = null;
  loadingRoles = false;
  savingRole = false;
  editingId: number | null = null;

  form: MenuSaveRequest = this.getDefaultForm();

  constructor(
    private menuService: MenuService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadMenu();
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }

  loadMenu(): void {
    this.loading = true;
    this.menuService.getAdminMenu().subscribe({
      next: (items) => {
        this.menuItems = (items ?? []).slice().sort((a, b) => a.idPadre - b.idPadre || a.posicion - b.posicion);
        this.parentOptions = this.menuItems
          .filter((item) => !this.isRaiz(item))
          .slice()
          .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
        this.expandedParents.clear();
        this.selectedMenuForRoles = null;
        this.rolesAsignados = [];
        this.selectedRolId = null;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error('MenÃº', err?.error?.message ?? 'No fue posible cargar el menÃº.');
      }
    });
  }

  nuevo(): void {
    this.editingId = null;
    this.form = this.getDefaultForm();
  }

  editar(item: DbMenuItem): void {
    this.editingId = item.idMenu;
    this.form = {
      idMenu: item.idMenu,
      descripcion: item.descripcion ?? '',
      idPadre: item.idPadre ?? 0,
      posicion: item.posicion ?? 0,
      tipo: item.tipo ?? 'S',
      icono: item.icono ?? '',
      vigente: item.vigente ?? 1,
      detalle: item.detalle ?? ''
    };
  }

  guardar(): void {
    if (!this.form.descripcion.trim()) {
      this.toast.warning('MenÃº', 'La descripciÃ³n es obligatoria.');
      return;
    }

    if (!this.form.tipo.trim()) {
      this.toast.warning('MenÃº', 'El tipo es obligatorio.');
      return;
    }

    if (this.form.posicion < 0) {
      this.toast.warning('MenÃº', 'La posiciÃ³n no puede ser negativa.');
      return;
    }

    this.saving = true;
    this.menuService.saveAdminMenu(this.form).subscribe({
      next: (resp) => {
        this.saving = false;
        if (!resp?.success) {
          this.toast.warning('MenÃº', resp?.message || 'No fue posible guardar.');
          return;
        }
        this.toast.success('MenÃº', resp.message || 'MenÃº guardado correctamente.');
        this.nuevo();
        this.loadMenu();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('MenÃº', err?.error?.detail ?? err?.error?.message ?? 'Error guardando menÃº.');
      }
    });
  }

  cambiarEstado(item: DbMenuItem): void {
    const nuevoEstado = item.vigente === 1 ? 0 : 1;
    this.menuService.setEstadoAdminMenu(item.idMenu, { vigente: nuevoEstado }).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('MenÃº', resp?.message || 'No fue posible actualizar estado.');
          return;
        }
        this.toast.success('MenÃº', resp.message || 'Estado actualizado.');
        this.loadMenu();
      },
      error: (err) => {
        this.toast.error('MenÃº', err?.error?.detail ?? err?.error?.message ?? 'Error actualizando estado.');
      }
    });
  }

  gestionarRoles(item: DbMenuItem): void {
    this.selectedMenuForRoles = item;
    this.selectedRolId = null;
    this.loadRolesPanel(item.idMenu);
  }

  cargarCatalogoRoles(): void {
    this.menuService.getRolesCatalog().subscribe({
      next: (roles) => {
        this.rolesCatalog = (roles ?? []).slice().sort((a, b) => a.descripcion.localeCompare(b.descripcion));
      },
      error: (err) => {
        this.rolesCatalog = [];
        this.toast.error('Roles menÃº', err?.error?.message ?? 'No fue posible cargar el catÃ¡logo de roles.');
      }
    });
  }

  loadRolesPanel(idMenu: number): void {
    this.loadingRoles = true;

    if (this.rolesCatalog.length === 0) {
      this.cargarCatalogoRoles();
    }

    this.menuService.getRolesByMenu(idMenu).subscribe({
      next: (data) => {
        this.rolesAsignados = (data ?? []).slice().sort((a, b) => a.descripcionRol.localeCompare(b.descripcionRol));
        this.loadingRoles = false;
      },
      error: (err) => {
        this.rolesAsignados = [];
        this.loadingRoles = false;
        this.toast.error('Roles menÃº', err?.error?.message ?? 'No fue posible consultar roles del menÃº.');
      }
    });
  }

  asignarRolMenu(): void {
    if (!this.selectedMenuForRoles) {
      this.toast.warning('Roles menÃº', 'Selecciona un menÃº para gestionar roles.');
      return;
    }

    if (!this.selectedRolId || this.selectedRolId <= 0) {
      this.toast.warning('Roles menÃº', 'Selecciona un rol.');
      return;
    }

    this.savingRole = true;
    this.menuService.assignRolToMenu(this.selectedMenuForRoles.idMenu, { idRol: this.selectedRolId }).subscribe({
      next: (resp) => {
        this.savingRole = false;
        if (!resp?.success) {
          this.toast.warning('Roles menÃº', resp?.message || 'No fue posible asignar el rol.');
          return;
        }
        this.toast.success('Roles menÃº', resp.message || 'Rol asignado correctamente.');
        this.selectedRolId = null;
        this.loadRolesPanel(this.selectedMenuForRoles!.idMenu);
      },
      error: (err) => {
        this.savingRole = false;
        this.toast.error('Roles menÃº', err?.error?.detail ?? err?.error?.message ?? 'Error asignando rol.');
      }
    });
  }

  quitarRolMenu(item: MenuRolItem): void {
    if (!this.selectedMenuForRoles) {
      return;
    }

    this.menuService.removeRolFromMenu(this.selectedMenuForRoles.idMenu, item.idRol).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Roles menÃº', resp?.message || 'No fue posible quitar el rol.');
          return;
        }
        this.toast.success('Roles menÃº', resp.message || 'Rol retirado del menÃº.');
        this.loadRolesPanel(this.selectedMenuForRoles!.idMenu);
      },
      error: (err) => {
        this.toast.error('Roles menÃº', err?.error?.detail ?? err?.error?.message ?? 'Error retirando rol.');
      }
    });
  }

  get parentMenuItems(): DbMenuItem[] {
    return this.menuItems
      .filter((item) => item.idPadre === 1 && !this.isRaiz(item))
      .sort((a, b) => a.posicion - b.posicion || a.idMenu - b.idMenu);
  }

  getChildrenOf(parentId: number): DbMenuItem[] {
    return this.menuItems
      .filter((item) => item.idPadre === parentId)
      .sort((a, b) => a.posicion - b.posicion || a.idMenu - b.idMenu);
  }

  hasChildren(parentId: number): boolean {
    return this.menuItems.some((item) => item.idPadre === parentId);
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
    return item.idMenu === 1 || (item.descripcion ?? '').trim().toUpperCase() === 'RAIZ';
  }
}


