import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { HomeComponent } from './pages/home/home';
import { Formularios } from './pages/formularios/formularios';
import { UsuariosComponent } from './pages/usuarios/usuarios';
import { SlidersComponent } from './pages/sliders/sliders';
import { MenuAdminComponent } from './pages/menu-admin/menu-admin';
import { AdminMultimediaComponent } from './pages/admin-multimedia/admin-multimedia';
import { RolesAdminComponent } from './pages/roles-admin/roles-admin';
import { LayoutComponent } from './layout/layout';
import { Noticias } from './pages/noticias/noticias';
import { LineaMandoAdminComponent } from './pages/linea-mando/linea-mando';
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
{
      path: 'administracion',
      children: [
        { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
        { path: 'formularios', component: Formularios },
        { path: 'usuarios', component: UsuariosComponent },
        { path: 'roles', component: RolesAdminComponent },
        { path: 'sliders', component: SlidersComponent },
        { path: 'menu', component: MenuAdminComponent },
        { path: 'admin-multimedia', component: AdminMultimediaComponent },
        { path: 'video-unidad', component: AdminMultimediaComponent },
        { path: 'configuracion-imagen-sitio', component: AdminMultimediaComponent },
        { path: 'linea-mando', component: LineaMandoAdminComponent }
      ]
    },
      { path: 'formularios', redirectTo: 'administracion/formularios', pathMatch: 'full' },
      { path: 'usuarios', redirectTo: 'administracion/usuarios', pathMatch: 'full' },
      { path: 'roles', redirectTo: 'administracion/roles', pathMatch: 'full' },
      { path: 'sliders', redirectTo: 'administracion/sliders', pathMatch: 'full' },
      { path: 'menu', redirectTo: 'administracion/menu', pathMatch: 'full' },
      { path: 'admin-multimedia', redirectTo: 'administracion/admin-multimedia', pathMatch: 'full' },
      { path: 'video-unidad', redirectTo: 'administracion/video-unidad', pathMatch: 'full' },
      { path: 'configuracion-imagen-sitio', redirectTo: 'administracion/configuracion-imagen-sitio', pathMatch: 'full' },
      { path: 'linea-mando', redirectTo: 'administracion/linea-mando', pathMatch: 'full' },
      { path: 'noticias', component: Noticias },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
