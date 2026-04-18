import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface AdminSite {
  title: string;
  description: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-administracion-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './administracion-inicio.html',
  styleUrls: ['./administracion-inicio.scss']
})
export class AdministracionInicioComponent {
  readonly sites: AdminSite[] = [
    {
      title: 'Usuarios',
      description: 'Administra usuarios, estado y datos base del sistema.',
      route: '/administracion/usuarios',
      icon: 'fa-regular fa-user'
    },
    {
      title: 'Administrar Roles',
      description: 'Configura permisos y relación de menús por rol.',
      route: '/administracion/roles',
      icon: 'fa-solid fa-user-shield'
    },
    {
      title: 'Menú',
      description: 'Gestiona estructura, orden y visibilidad del menú.',
      route: '/administracion/menu',
      icon: 'fa-solid fa-bars'
    },
    {
      title: 'Línea de Mando',
      description: 'Gestiona cargos, orden y vigencia de línea de mando.',
      route: '/administracion/linea-mando',
      icon: 'fa-solid fa-sitemap'
    },
    {
      title: 'Sliders',
      description: 'Configura banners y piezas visuales del home.',
      route: '/administracion/sliders',
      icon: 'fa-solid fa-image'
    },
    {
      title: 'Emisoras Radio',
      description: 'Administra emisoras, streams y estado de publicación.',
      route: '/administracion/radio',
      icon: 'fa-solid fa-radio'
    },
    {
      title: 'Formularios',
      description: 'Galería y base de formularios administrativos.',
      route: '/administracion/formularios',
      icon: 'fa-solid fa-clipboard-list'
    },
    {
      title: 'Configuración del Sistema',
      description: 'Marca del sistema, visual login y video institucional.',
      route: '/administracion/configuracion-sistema',
      icon: 'fa fa-cog fa-spin fa-3x fa-fw"'
    },
     {
      title: 'Configuración de Dominios',
      description: 'Administra dominios del sistema, para listas desplegables.',
      route: '/administracion/dominio',
      icon: 'fa fa-refresh fa-spin fa-3x fa-fw'
    },
    {
      title: 'Video Institucional',
      description: 'Administracion de videos instuitucionales del sistema.',
      route: '/administracion/video-institucional',
      icon: 'fa fa-refresh fa-spin fa-3x fa-fw'
    },
     {
      title: 'Administración de noticias',
      description: 'Administracion de Creación de noticias.',
      route: '/administracion/noticias',
      icon: 'fa fa-refresh fa-spin fa-3x fa-fw'
    }
  ];
}
