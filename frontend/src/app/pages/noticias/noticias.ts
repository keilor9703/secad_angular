import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NoticiaService, DtoNoticia } from '../../core/services/administracion/noticia.service';

@Component({
  selector: 'app-noticias-web',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './noticias.html',
  styleUrl: './noticias.scss'
})
export class NoticiasWeb implements OnInit {
  minimized = false;
  closed = false;
  isLoading = true;
  hasError = false;
  errorMessage = '';

  currentPage = 1;
  itemsPerPage = 8;
  totalPages = 0;

  news: DtoNoticia[] = [];

  constructor(private noticiaService: NoticiaService) {}

  ngOnInit(): void {
    this.loadNoticias();
  }

  loadNoticias(): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.noticiaService.getActivas().subscribe({
      next: (news) => {
        this.news = news.sort((a, b) => 
          new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
        );
        this.currentPage = 1;
        this.calculateTotalPages();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage = 'No fue posible cargar las noticias. Intente nuevamente.';
      }
    });
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.news.length / this.itemsPerPage);
  }

  get paginatedNews(): DtoNoticia[] {
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

  getImageUrl(noticia: DtoNoticia): string {
    if (!noticia.imagenNoticia) return 'imagenes/actividades/news2.jpg';
    if (noticia.imagenNoticia.startsWith('http')) return noticia.imagenNoticia;
    return `/api/NoticiaUpload/Imagen/${noticia.imagenNoticia.split('/').pop()}`;
  }

  getNoticiaUrl(noticia: DtoNoticia): string {
    return `/administracion/noticias`;
  }

  private scrollToTop(): void {
    const element = document.querySelector('.news-list');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
