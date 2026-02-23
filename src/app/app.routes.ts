import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { HomeComponent } from './pages/home/home';
import { Formularios } from './pages/formularios/formularios';
import { UsuariosComponent } from './pages/usuarios/usuarios';
import { LayoutComponent } from './layout/layout';
import { Noticias } from './pages/noticias/noticias';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home', component: HomeComponent },
      {
        path: 'administracion',
        children: [
          { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
          { path: 'formularios', component: Formularios },
          { path: 'usuarios', component: UsuariosComponent }
        ]
      },
      { path: 'formularios', redirectTo: 'administracion/formularios', pathMatch: 'full' },
      { path: 'usuarios', redirectTo: 'administracion/usuarios', pathMatch: 'full' },
      { path: 'noticias', component: Noticias },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
