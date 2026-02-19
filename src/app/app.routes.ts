import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { HomeComponent } from './pages/home/home';
import { Formularios } from './pages/formularios/formularios';
import { LayoutComponent } from './layout/layout';
import { Noticias } from './pages/noticias/noticias';

export const routes: Routes = [

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'formularios', component: Formularios },
      {path: 'noticias', component: Noticias},
    ]
  },
  { path: '**', redirectTo: 'login' }
];