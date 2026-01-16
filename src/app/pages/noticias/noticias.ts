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

  news: NewsItem[] = [
    {
      id: 1,
      date: '15 Ene 2026',
      tag: 'Comunicado',
      title: 'Actualización del sistema SISGE',
      lead: 'Se implementaron mejoras de rendimiento y ajustes visuales en formularios y turnos de pago.',
      content: 'Aquí va el contenido completo de la noticia...',
      image: 'assets/banner/banner1.jpg'
    },
    {
      id: 2,
      date: '12 Ene 2026',
      tag: 'Servicio',
      title: 'Nueva guía para radicación',
      lead: 'Consulta el paso a paso actualizado para radicar y validar documentos en el módulo judicial.',
      content: 'Contenido completo...',
      image: 'assets/banner/banner2.jpg'
    },
    {
      id: 3,
      date: '08 Ene 2026',
      tag: 'Importante',
      title: 'Ventana de mantenimiento',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Contenido completo...',
      image: 'assets/banner/banner3.jpg'
    }
  ];

  newsModalOpen = false;
  selectedNews: NewsItem | null = null;

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
