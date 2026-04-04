import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { HomeComponent } from './pages/home/home';
import { Formularios } from './pages/administracion/formularios/formularios';
import { UsuariosComponent } from './pages/administracion/usuarios/usuarios';
import { SlidersComponent } from './pages/administracion/sliders/sliders';
import { MenuAdminComponent } from './pages/administracion/menu-admin/menu-admin';
import { ConfiguracionSistemaComponent } from './pages/administracion/configuracion-sistema/configuracion-sistema';
import { RolesAdminComponent } from './pages/administracion/roles-admin/roles-admin';
import { LayoutComponent } from './layout/layout';
import { NoticiasWeb } from './pages/noticias/noticias';
import { LineaMandoAdminComponent } from './pages/administracion/linea-mando/linea-mando';
import { AdministracionInicioComponent } from './pages/administracion/administracion-inicio/administracion-inicio';
import { RadioAdminComponent } from './pages/administracion/radio/radio';
import { DominioAdminComponent } from './pages/administracion/dominio/dominio';
import { VideoInstitucionalComponent } from './pages/administracion/video-institucional/video-institucional';
import { NoticiasAdminComponent } from './pages/administracion/noticias/noticias';
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
      children: [
        { path: '', component: AdministracionInicioComponent },
        { path: 'inicio', component: AdministracionInicioComponent },
        { path: 'formularios', component: Formularios },
        { path: 'usuarios', component: UsuariosComponent },
        { path: 'roles', component: RolesAdminComponent },
        { path: 'sliders', component: SlidersComponent },
        { path: 'menu', component: MenuAdminComponent },
        { path: 'configuracion-sistema', component: ConfiguracionSistemaComponent },
        { path: 'admin-multimedia', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
        { path: 'video-unidad', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
        { path: 'configuracion-imagen-sitio', redirectTo: 'configuracion-sistema', pathMatch: 'full' },
        { path: 'linea-mando', component: LineaMandoAdminComponent },
        { path: 'radio', component: RadioAdminComponent },
        { path: 'dominio', component: DominioAdminComponent },
        { path: 'video-institucional', component: VideoInstitucionalComponent },
        { path: 'noticias', component: NoticiasAdminComponent }
      ]
    },
      { path: 'formularios', redirectTo: 'administracion/formularios', pathMatch: 'full' },
      { path: 'usuarios', redirectTo: 'administracion/usuarios', pathMatch: 'full' },
      { path: 'roles', redirectTo: 'administracion/roles', pathMatch: 'full' },
      { path: 'sliders', redirectTo: 'administracion/sliders', pathMatch: 'full' },
      { path: 'menu', redirectTo: 'administracion/menu', pathMatch: 'full' },
      { path: 'configuracion-sistema', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'admin-multimedia', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'video-unidad', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'configuracion-imagen-sitio', redirectTo: 'administracion/configuracion-sistema', pathMatch: 'full' },
      { path: 'linea-mando', redirectTo: 'administracion/linea-mando', pathMatch: 'full' },
      { path: 'radio', redirectTo: 'administracion/radio', pathMatch: 'full' },
      { path: 'dominio', redirectTo: 'administracion/dominio', pathMatch: 'full' },
      { path: 'video-institucional', redirectTo: 'administracion/video-institucional', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: 'login' }
];

