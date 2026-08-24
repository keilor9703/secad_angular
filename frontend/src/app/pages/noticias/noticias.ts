import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoticiaService, DtoNoticia } from '../../core/services/administracion/noticia.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-noticias-web',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './noticias.html',
  styleUrl: './noticias.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoticiasWeb implements OnInit {
  private readonly noticiaService = inject(NoticiaService);

  minimized = false;
  closed = false;
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  readonly currentPage = signal(1);
  readonly itemsPerPage = 8;
  readonly totalPages = computed(() => Math.ceil(this.news().length / this.itemsPerPage));

  readonly news = signal<DtoNoticia[]>([]);

  modalOpen = false;
  selectedNoticia: DtoNoticia | null = null;
  readonly liked = signal(false);

  readonly paginatedNews = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage;
    return this.news().slice(startIndex, startIndex + this.itemsPerPage);
  });

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1)
  );

  ngOnInit(): void {
    this.loadNoticias();
  }

  loadNoticias(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');

    this.noticiaService.getActivas().subscribe({
      next: (news) => {
        this.news.set(news.sort((a, b) =>
          new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
        ));
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set('No fue posible cargar las noticias. Intente nuevamente.');
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.scrollToTop();
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.scrollToTop();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.scrollToTop();
    }
  }

  getImageUrl(noticia: DtoNoticia): string {
    const raw = (noticia.imagenNoticia ?? '').trim();
    if (!raw) return '/imagenes/actividades/news2.jpg';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;

    const baseUrl = environment.sliderMediaBaseUrl || 'https://srvdockergusof.policia.gov.co:8088';

    // Si la imagen viene como /api/... o simplemente el nombre, apuntamos al servidor externo
    if (raw.startsWith('/api/')) {
      return `${baseUrl}${raw}`;
    }

    const fileName = raw.split('/').filter(Boolean).pop() ?? '';
    return `${baseUrl}/api/NoticiaUpload/Imagen/${encodeURIComponent(fileName)}`;
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

    this.liked.set(true);
    this.noticiaService.darLike(noticia.idNoticia).subscribe({
      next: () => {
        const nuevoConteo = (noticia.megusta || 0) + 1;
        noticia.megusta = nuevoConteo;
        this.news.update(list => list.map(n => n.idNoticia === noticia.idNoticia ? { ...n, megusta: nuevoConteo } : n));
        if (this.selectedNoticia?.idNoticia === noticia.idNoticia) {
          this.selectedNoticia = { ...this.selectedNoticia, megusta: nuevoConteo };
        }
        this.saveLikedNews(noticia.idNoticia);
        setTimeout(() => this.liked.set(false), 1000);
      },
      error: (err) => {
        console.error('Error dando like:', err);
        this.liked.set(false);
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
