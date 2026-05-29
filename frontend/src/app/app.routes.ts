import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { HomeComponent } from './pages/home/home';
import { Formularios } from './pages/administracion/formularios/formularios';
import { UsuariosComponent } from './pages/administracion/usuarios/usuarios';
import { MenuAdminComponent } from './pages/administracion/menu-admin/menu-admin';
import { ConfiguracionSistemaComponent } from './pages/administracion/configuracion-sistema/configuracion-sistema';
import { RolesAdminComponent } from './pages/administracion/roles-admin/roles-admin';
import { LayoutComponent } from './layout/layout';
import { NoticiasWeb } from './pages/noticias/noticias';
import { LineaMandoAdminComponent } from './pages/administracion/linea-mando/linea-mando';
import { AdministracionInicioComponent } from './pages/administracion/administracion-inicio/administracion-inicio';
import { DominioAdminComponent } from './pages/administracion/dominio/dominio';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { superAdminGuard } from './core/auth/super-admin.guard';
import { EntidadesComponent } from './pages/administracion/entidades/entidades';
import { PedidoComponent } from './pages/operacion/pedido/pedido';
import { RecepcionComponent } from './pages/operacion/recepcion/recepcion';
import { EventosComponent } from './pages/operacion/eventos/eventos';
import { TurnosComponent }  from './pages/operacion/turnos/turnos';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { path: 'noticias', component: NoticiasWeb },
      {
        path: 'administracion',
        canActivate: [authGuard],
        children: [
          { path: '', component: AdministracionInicioComponent, canActivate: [authGuard] },
          { path: 'inicio', component: AdministracionInicioComponent, canActivate: [authGuard] },
          { path: 'formularios', component: Formularios, canActivate: [authGuard] },
          { path: 'usuarios', component: UsuariosComponent, canActivate: [adminGuard] },
          { path: 'roles', component: RolesAdminComponent, canActivate: [adminGuard] },
          { path: 'menu', component: MenuAdminComponent, canActivate: [adminGuard] },
          { path: 'configuracion-sistema', component: ConfiguracionSistemaComponent, canActivate: [adminGuard] },
          { path: 'admin-multimedia', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
          { path: 'video-unidad', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
          { path: 'configuracion-imagen-sitio', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
          { path: 'linea-mando', component: LineaMandoAdminComponent, canActivate: [adminGuard] },
          { path: 'dominio', component: DominioAdminComponent, canActivate: [adminGuard] },
          { path: 'entidades', component: EntidadesComponent, canActivate: [adminGuard] },
          {
            path: 'cuentas-email',
            loadComponent: () => import('./pages/administracion/cuentas-email/cuentas-email').then(m => m.CuentasEmailComponent),
            canActivate: [adminGuard]
          },
          {
            path: 'asistente',
            loadComponent: () => import('./pages/administracion/asistente/asistente').then(m => m.AsistenteAdminComponent),
            canActivate: [adminGuard]
          },
          // ─── SuperAdmin exclusivo ─────────────────────────────────────────
          {
            path: 'tenants',
            loadComponent: () => import('./pages/administracion/tenants/tenants').then(m => m.TenantsComponent),
            canActivate: [superAdminGuard]
          }
        ]
      },
      // ─── Módulo SuperAdmin ────────────────────────────────────────────────
      {
        path: 'super',
        canActivate: [superAdminGuard],
        children: [
          { path: '', redirectTo: 'salud-cads', pathMatch: 'full' },
          {
            path: 'salud-cads',
            loadComponent: () => import('./pages/super/salud-cads/salud-cads').then(m => m.SaludCadsComponent),
            canActivate: [superAdminGuard]
          }
        ]
      },
      { path: 'salud-cads', redirectTo: 'super/salud-cads', pathMatch: 'full' },
      { path: 'tenants',    redirectTo: 'administracion/tenants', pathMatch: 'full' },
      // ─── Gestión Documental ───────────────────────────────────────────────
      {
        path: 'gestion-documental',
        canActivate: [authGuard],
        children: [
          { path: '', redirectTo: 'gestion-correos-electronicos', pathMatch: 'full' },
          {
            path: 'gestion-correos-electronicos',
            loadComponent: () => import('./pages/gestion-documental/gestion-correos-electronicos/gestion-correos-electronicos').then(m => m.GestionCorreosElectronicosComponent),
            canActivate: [authGuard]
          }
        ]
      },
      // ─── Operacion ───────────────────────────────────────────────────────
      {
        path: 'operacion',
        canActivate: [authGuard],
        children: [
          { path: '', redirectTo: 'recepcion', pathMatch: 'full' },
          { path: 'recepcion', component: RecepcionComponent, canActivate: [authGuard] },
          { path: 'pedido',    component: PedidoComponent,   canActivate: [authGuard] },
          { path: 'eventos',   component: EventosComponent,  canActivate: [authGuard] },
          { path: 'turnos',    component: TurnosComponent,   canActivate: [authGuard] },
          {
            path: 'anotaciones',
            loadComponent: () => import('./pages/operacion/anotaciones-turno/anotaciones-turno').then(m => m.AnotacionesTurnoComponent),
            canActivate: [authGuard]
          }
        ]
      },
      { path: 'pedido',      redirectTo: 'operacion/pedido',      pathMatch: 'full' },
      { path: 'recepcion',   redirectTo: 'operacion/recepcion',   pathMatch: 'full' },
      { path: 'eventos',     redirectTo: 'operacion/eventos',     pathMatch: 'full' },
      { path: 'turnos',      redirectTo: 'operacion/turnos',      pathMatch: 'full' },
      { path: 'anotaciones', redirectTo: 'operacion/anotaciones', pathMatch: 'full' },
      // ─── Administracion shortcuts ─────────────────────────────────────────
      { path: 'formularios', redirectTo: 'administracion/formularios', pathMatch: 'full' },
      { path: 'usuarios', redirectTo: 'administracion/usuarios', pathMatch: 'full' },
      { path: 'roles', redirectTo: 'administracion/roles', pathMatch: 'full' },
      { path: 'menu', redirectTo: 'administracion/menu', pathMatch: 'full' },
      { path: 'configuracion-sistema', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'admin-multimedia', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'video-unidad', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'configuracion-imagen-sitio', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'linea-mando', redirectTo: 'administracion/linea-mando', pathMatch: 'full' },
      { path: 'radio', redirectTo: 'administracion/radio', pathMatch: 'full' },
      { path: 'dominio', redirectTo: 'administracion/dominio', pathMatch: 'full' },
      { path: 'entidades', redirectTo: 'administracion/entidades', pathMatch: 'full' },
      // ─── Gestión Documental shortcuts ─────────────────────────────────────
      { path: 'cuentas-email', redirectTo: 'administracion/cuentas-email', pathMatch: 'full' },
      { path: 'asistente',    redirectTo: 'administracion/asistente',    pathMatch: 'full' },
      { path: 'gestion-correos-electronicos', redirectTo: 'gestion-documental/gestion-correos-electronicos', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];

