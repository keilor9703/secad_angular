import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoticiaService, DtoNoticia } from '../../core/services/administracion/noticia.service';

@Component({
  selector: 'app-noticias-web',
  standalone: true,
  imports: [CommonModule],
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

  modalOpen = false;
  selectedNoticia: DtoNoticia | null = null;
  liked = false;

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

  openNoticia(noticia: DtoNoticia): void {
    this.selectedNoticia = noticia;
    this.modalOpen = true;
    document.body.classList.add('modal-open');
  }

  closeNoticia(): void {
    this.modalOpen = false;
    this.selectedNoticia = null;
    document.body.classList.remove('modal-open');
  }

  likeNoticia(noticia: DtoNoticia, event: Event): void {
    event.stopPropagation();
    
    const likedNews = this.getLikedNews();
    if (likedNews.includes(noticia.idNoticia)) {
      return;
    }
    
    this.liked = true;
    this.noticiaService.darLike(noticia.idNoticia).subscribe({
      next: () => {
        noticia.megusta = (noticia.megusta || 0) + 1;
        this.saveLikedNews(noticia.idNoticia);
        setTimeout(() => this.liked = false, 1000);
      },
      error: (err) => {
        console.error('Error dando like:', err);
        this.liked = false;
      }
    });
  }

  hasLiked(noticiaId: number): boolean {
    return this.getLikedNews().includes(noticiaId);
  }

  private getLikedNews(): number[] {
    const stored = sessionStorage.getItem('likedNews');
    return stored ? JSON.parse(stored) : [];
  }

  private saveLikedNews(noticiaId: number): void {
    const liked = this.getLikedNews();
    if (!liked.includes(noticiaId)) {
      liked.push(noticiaId);
      sessionStorage.setItem('likedNews', JSON.stringify(liked));
    }
  }

  private scrollToTop(): void {
    const element = document.querySelector('.news-list');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
