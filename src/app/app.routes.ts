import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { HomeComponent } from './pages/home/home';
import { Formularios } from './pages/formularios/formularios';
import { LayoutComponent } from './layout/layout';

export const routes: Routes = [
  // 1. Forzamos que la raíz redirija siempre al login primero
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // 2. Ruta de login (fuera del layout principal)
  { path: 'login', component: LoginComponent },

  // 3. Rutas protegidas por el layout
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'formularios', component: Formularios },
    ]
  },

  // 4. Comodín: si la ruta no existe, al login
  { path: '**', redirectTo: 'login' }
];