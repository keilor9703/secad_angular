import { Component,HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';

type NewsTag = 'Comunicado' | 'Servicio' | 'Importante';

interface NewsItem {
  id: number;
  date: string;
  tag: NewsTag;
  title: string;
  lead: string;     
  content: string;  
  image: string;   
}


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule,RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class HomeComponent {
  news: NewsItem[] = [
    {
      id: 1,
      date: '15 Ene 2026',
      tag: 'Comunicado',
      title: 'Actualización del sistema SISGE',
      lead: 'Se implementaron mejoras de rendimiento y ajustes visuales en formularios y turnos de pago.',
      content: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.',
      image: 'imagenes/noticia1.jpg'
    },
    {
      id: 2,
      date: '12 Ene 2026',
      tag: 'Servicio',
      title: 'Nueva guía para radicación',
      lead: 'Consulta el paso a paso actualizado para radicar y validar documentos en el módulo judicial.',
      content: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.',
      image: 'imagenes/noticia2.jpg'
    },
    {
      id: 3,
      date: '08 Ene 2026',
      tag: 'Importante',
      title: 'Ventana de mantenimiento',
      lead: 'El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.',
      content: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.',
      image: 'imagenes/noticia3.jpg'
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
