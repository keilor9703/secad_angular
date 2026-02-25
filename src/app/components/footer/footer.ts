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

  supportOpen = false;

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
    document.body.classList.remove('ui-modal-open');
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
  policyOpen = false;

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
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove('ui-modal-open');
  }
}
