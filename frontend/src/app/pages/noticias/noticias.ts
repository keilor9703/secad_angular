import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoticiaCard, NoticiasService } from '../../core/services/noticias.service';

@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './noticias.html',
  styleUrl: './noticias.scss'
})
export class Noticias implements OnInit {
  minimized = false;
  closed = false;
  isLoading = true;
  hasError = false;
  errorMessage = '';

  currentPage = 1;
  itemsPerPage = 8;
  totalPages = 0;

  news: NoticiaCard[] = [];

  constructor(private noticiasService: NoticiasService) {}

  ngOnInit(): void {
    this.loadNoticias();
  }

  loadNoticias(): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.noticiasService.getNoticias().subscribe({
      next: (news) => {
        this.news = news;
        this.currentPage = 1;
        this.calculateTotalPages();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage =
          'No fue posible cargar las noticias desde policia.gov.co. Intente nuevamente.';
      }
    });
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.news.length / this.itemsPerPage);
  }

  get paginatedNews(): NoticiaCard[] {
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

  openOriginalNews(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private scrollToTop(): void {
    const element = document.querySelector('.news-list');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
