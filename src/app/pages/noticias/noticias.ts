import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

type Newstag = 'Comunicado' | 'Evento' | 'Actualización' | 'Importante' | 'Servicio';

interface NewsItem {
  id: number;
  date: string;
  tag: Newstag;
  title: string;
  lead: string;
  content: string;
  image: string;
}

@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './noticias.html',
  styleUrl: './noticias.scss',
})

export class Noticias {
  minimized = false;
  closed = false;

  // Configuración de paginación
  currentPage = 1;
  itemsPerPage = 8; // 4 columnas x 2 filas = 8 items por página
  totalPages = 0;

  news: NewsItem[] = [
    {
      id: 1,
      date: '15 Ene 2026',
      tag: 'Comunicado',
      title: 'Actualización del sistema SISGE',
      lead: 'Se implementaron mejoras de rendimiento y ajustes visuales en formularios y turnos de pago.',
      content: 'Aquí va el contenido completo de la noticia...',
      image: 'imagenes/actividades/newsOne.jpg'
    },
    {
      id: 2,
      date: '12 Ene 2026',
      tag: 'Servicio',
      title: 'Nueva guía para radicación',
      lead: 'Consulta el paso a paso actualizado para radicar y validar documentos en el módulo judicial.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/noticia2.jpg'
    },
    {
      id: 3,
      date: '08 Ene 2026',
      tag: 'Importante',
      title: 'Ventana de mantenimiento',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/news2.jpg'
    },
    {
      id: 4,
      date: '16 Ene 2026',
      tag: 'Importante',
      title: 'Actividades varias',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/news3.jpg'
    },
    {
      id: 5,
      date: '15 Ene 2026',
      tag: 'Comunicado',
      title: 'Actualización del sistema SISGE',
      lead: 'Se implementaron mejoras de rendimiento y ajustes visuales en formularios y turnos de pago.',
      content: 'Aquí va el contenido completo de la noticia...',
      image: 'imagenes/actividades/newsOne.jpg'
    },
    {
      id: 6,
      date: '12 Ene 2026',
      tag: 'Servicio',
      title: 'Nueva guía para radicación',
      lead: 'Consulta el paso a paso actualizado para radicar y validar documentos en el módulo judicial.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/noticia2.jpg'
    },
    {
      id: 7,
      date: '08 Ene 2026',
      tag: 'Importante',
      title: 'Ventana de mantenimiento',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/news2.jpg'
    },
    {
      id: 8,
      date: '16 Ene 2026',
      tag: 'Importante',
      title: 'Actividades varias',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/news3.jpg'
    },
    {
      id: 9,
      date: '15 Ene 2026',
      tag: 'Comunicado',
      title: 'Actualización del sistema SISGE',
      lead: 'Se implementaron mejoras de rendimiento y ajustes visuales en formularios y turnos de pago.',
      content: 'Aquí va el contenido completo de la noticia...',
      image: 'imagenes/actividades/newsOne.jpg'
    },
    {
      id: 10,
      date: '12 Ene 2026',
      tag: 'Servicio',
      title: 'Nueva guía para radicación',
      lead: 'Consulta el paso a paso actualizado para radicar y validar documentos en el módulo judicial.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/noticia2.jpg'
    },
    {
      id: 11,
      date: '08 Ene 2026',
      tag: 'Importante',
      title: 'Ventana de mantenimiento',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/news2.jpg'
    },
    {
      id: 12,
      date: '16 Ene 2026',
      tag: 'Importante',
      title: 'Actividades varias',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'imagenes/actividades/news3.jpg'
    }
  ];

  newsModalOpen = false;
  selectedNews: NewsItem | null = null;

  constructor() {
    this.calculateTotalPages();
  }
  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.news.length / this.itemsPerPage);
  }
  get paginatedNews(): NewsItem[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.news.slice(startIndex, endIndex);
  }
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.scrollToTop();
    }
  }
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.scrollToTop();
    }
  }
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.scrollToTop();
    }
  }
  scrollToTop(): void {
    const element = document.querySelector('.news-list');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  openNews(item: NewsItem): void {
    this.selectedNews = item;
    this.newsModalOpen = true;
    document.body.classList.add('ui-modal-open');
  }
  closeNews(): void {
    this.newsModalOpen = false;
    this.selectedNews = null;
    document.body.classList.remove('ui-modal-open');
  }
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.newsModalOpen) this.closeNews();
  }
}