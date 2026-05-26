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
          { path: 'usuarios', component: UsuariosComponent, canActivate: [authGuard] },
          { path: 'roles', component: RolesAdminComponent, canActivate: [authGuard] },
          { path: 'menu', component: MenuAdminComponent, canActivate: [authGuard] },
          { path: 'configuracion-sistema', component: ConfiguracionSistemaComponent, canActivate: [authGuard] },
          { path: 'admin-multimedia', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
          { path: 'video-unidad', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
          { path: 'configuracion-imagen-sitio', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
          { path: 'linea-mando', component: LineaMandoAdminComponent, canActivate: [authGuard] },
          { path: 'dominio', component: DominioAdminComponent, canActivate: [authGuard] },
          { path: 'cuentas-email', loadComponent: () => import('./pages/administracion/cuentas-email/cuentas-email').then(m => m.CuentasEmailComponent), canActivate: [authGuard] }
        ]
      },
      {
        path: 'gestion-documental',
        children: [
          { path: '', redirectTo: 'gestion-correos-electronicos', pathMatch: 'full' },
          { path: 'gestion-correos-electronicos', loadComponent: () => import('./pages/gestion-documental/gestion-correos-electronicos/gestion-correos-electronicos').then(m => m.GestionCorreosElectronicosComponent) }
        ]
      },
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
      { path: 'cuentas-email', redirectTo: 'administracion/cuentas-email', pathMatch: 'full' },
      { path: 'correos-electronicos', redirectTo: 'gestion-documental/gestion-correos-electronicos', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];

