import { Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandingService } from '../../core/services/branding.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent implements OnDestroy {
  systemName = 'SISGE';
  isPlaying = false;
  errorMessage = '';
  selectedStation = 'bogota';
  private audio: HTMLAudioElement | null = null;

  supportOpen = false;
  policyOpen = false;

  stations = [
    { id: 'bogota', name: 'Bogota', url: 'https://radio.policia.gov.co:8080/inhouse' },
    { id: 'medellin', name: 'Medellin', url: 'https://radio.policia.gov.co:8080/medellin' }
  ];

  supportForm = {
    tipo: 'Incidente (error)',
    prioridad: 'Media',
    asunto: '',
    descripcion: '',
    incluirDatosTecnicos: true,
    adjuntos: [] as File[]
  };

  constructor(private brandingService: BrandingService) {
    this.loadBranding();
    this.initAudio();
  }

  private loadBranding(): void {
    this.brandingService.getPublicConfig().subscribe({
      next: (cfg) => {
        const name = (cfg?.systemName ?? '').trim();
        this.systemName = name || 'SISGE';
      },
      error: () => {
        this.systemName = 'SISGE';
      }
    });
  }


  openSupport(): void {
    this.supportOpen = true;
    document.body.classList.add('ui-modal-open');
  }


  closeSupport(): void {
    this.supportOpen = false;
    if (!this.policyOpen) {
      document.body.classList.remove('ui-modal-open');
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.supportForm.adjuntos = files;
  }

  submitSupport(): void {
    if (!this.supportForm.asunto.trim() || !this.supportForm.descripcion.trim()) {
      alert('Completa Asunto y Descripción.');
      return;
    }

    console.log('Ticket (solo UI):', this.supportForm);

    this.resetSupportForm();

    this.closeSupport();
  }


  resetSupportForm(): void {
    this.supportForm = {
      tipo: 'Incidente (error)',
      prioridad: 'Media',
      asunto: '',
      descripcion: '',
      incluirDatosTecnicos: true,
      adjuntos: []
    };
  }

  get currentStationUrl(): string {
    const station = this.stations.find((s) => s.id === this.selectedStation);
    return station ? station.url : this.stations[0].url;
  }

  private initAudio(): void {
    this.audio = new Audio();
    this.audio.src = this.currentStationUrl;
    this.audio.volume = 0.75;

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.errorMessage = '';
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
    });

    this.audio.addEventListener('error', () => {
      this.isPlaying = false;
      this.errorMessage = 'No se pudo conectar con la radio.';
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
    });
  }

  onStationChange(): void {
    if (!this.audio) return;

    const wasPlaying = this.isPlaying;
    this.audio.pause();
    this.audio.src = this.currentStationUrl;
    this.isPlaying = false;

    if (wasPlaying) {
      this.audio.play().catch(() => {
        this.errorMessage = 'No se pudo reproducir esta emisora.';
      });
    }
  }

  togglePlay(): void {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
      return;
    }

    this.errorMessage = '';
    this.audio.play().catch(() => {
      this.errorMessage = 'No se pudo iniciar la radio.';
    });
  }

  openPolicy(): void {
    this.policyOpen = true;
    document.body.classList.add('ui-modal-open');
  }

  closePolicy(): void {
    this.policyOpen = false;

    if (!this.supportOpen) {
      document.body.classList.remove('ui-modal-open');
    }
  }


 
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.supportOpen) {
      this.closeSupport();
      return;
    }

    if (this.policyOpen) {
      this.closePolicy();
    }
  }

  ngOnDestroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }

    document.body.classList.remove('ui-modal-open');
  }
}
