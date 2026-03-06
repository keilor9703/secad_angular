import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-radio-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="radio-container" [class.expanded]="isExpanded">
      <!-- Botón flotante -->
      <button 
        class="radio-toggle"
        (click)="togglePlayer()"
        [class.playing]="isPlaying"
        [title]="isPlaying ? 'Radio policial - Reproduciendo' : 'Radio policial'"
      >
        <i class="fa-solid" [class.fa-radio]="!isPlaying" [class.fa-pause]="isPlaying"></i>
        <span class="radio-label" *ngIf="isExpanded || !isPlaying">Radio Policía</span>
      </button>

      <!-- Panel expandido -->
      <div class="radio-panel" *ngIf="isExpanded">
        <div class="radio-header">
          <span class="radio-title">
            <i class="fa-solid fa-police-badge"></i>
            Radio Policía Nacional
          </span>
          <button class="radio-close" (click)="togglePlayer()">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="radio-info">
          <div class="radio-status" [class.active]="isPlaying">
            <span class="status-dot"></span>
            {{ isPlaying ? 'EN VIVO' : 'DETENIDO' }}
          </div>
          <div class="radio-station">Policía Nacional de Colombia</div>
        </div>

        <div class="radio-station-selector">
          <select [(ngModel)]="selectedStation" (ngModelChange)="onStationChange()" class="station-select">
            <option *ngFor="let station of stations" [value]="station.id">
              {{ station.name }}
            </option>
          </select>
        </div>

        <div class="radio-controls">
          <button class="radio-btn" (click)="togglePlay()">
            <i class="fa-solid" [class.fa-play]="!isPlaying" [class.fa-pause]="isPlaying"></i>
          </button>
        </div>

        <div class="radio-link">
          <a href="https://radio.policia.gov.co" target="_blank" rel="noopener">
            <i class="fa-solid fa-external-link"></i>
            Ver emissora
          </a>
        </div>

        <div class="radio-error" *ngIf="errorMessage">{{ errorMessage }}</div>
      </div>
    </div>
  `,
  styles: [`
    .radio-container {
      position: fixed;
      bottom: 50px;
      left: 20px;
      z-index: 9999;
      font-family: 'Montserrat', sans-serif;
    }

    .radio-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #002a66 0%, #00193a 100%);
      border: 2px solid #fff;
      border-radius: 30px;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 42, 102, 0.4);
      transition: all 0.3s ease;
      font-size: 14px;
      font-weight: 700;
    }

    .radio-toggle:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 42, 102, 0.5);
    }

    .radio-toggle.playing {
      background: linear-gradient(135deg, #00a8e8 0%, #002a66 100%);
      animation: pulse-radio 2s infinite;
    }

    @keyframes pulse-radio {
      0%, 100% { box-shadow: 0 4px 15px rgba(0, 168, 232, 0.4); }
      50% { box-shadow: 0 4px 25px rgba(0, 168, 232, 0.6); }
    }

    .radio-toggle i { font-size: 18px; }
    .radio-label { font-size: 13px; }

    .radio-panel {
      position: absolute;
      bottom: 60px;
      left: 0;
      width: 280px;
      background: linear-gradient(180deg, #151b3b 0%, #0a1929 100%);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .radio-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .radio-title {
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .radio-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
    }

    .radio-close:hover { color: #fff; }

    .radio-info { text-align: center; margin-bottom: 16px; }

    .radio-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .radio-status.active {
      background: rgba(0, 168, 232, 0.2);
      color: #00a8e8;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
    }

    .radio-status.active .status-dot {
      background: #00a8e8;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .radio-station {
      margin-top: 8px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 12px;
    }

    .radio-error {
      margin-top: 8px;
      color: #ef4444;
      font-size: 11px;
      padding: 6px;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 6px;
    }

    .radio-station-selector {
      margin-bottom: 12px;
      text-align: center;
    }

    .station-select {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }

    .station-select option {
      background: #151b3b;
      color: #fff;
    }

    .radio-controls { display: flex; justify-content: center; gap: 12px; margin-bottom: 12px; }

    .radio-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #002a66 0%, #00193a 100%);
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .radio-btn:hover {
      transform: scale(1.1);
      background: linear-gradient(135deg, #00a8e8 0%, #002a66 100%);
    }

    .radio-link { text-align: center; }

    .radio-link a {
      color: rgba(255, 255, 255, 0.6);
      text-decoration: none;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: color 0.3s ease;
    }

    .radio-link a:hover { color: #00a8e8; }
  `]
})
export class RadioPlayerComponent implements OnInit, OnDestroy {
  isPlaying = false;
  isExpanded = false;
  errorMessage = '';
  private audio: HTMLAudioElement | null = null;
  selectedStation = 'bogota';

  stations = [
    { id: 'bogota', name: 'Bogotá', url: 'https://radio.policia.gov.co:8080/inhouse' },
    { id: 'medellin', name: 'Medellín', url: 'https://radio.policia.gov.co:8080/medellin' }
  ];

  get currentStationUrl(): string {
    const station = this.stations.find(s => s.id === this.selectedStation);
    return station ? station.url : this.stations[0].url;
  }

  ngOnInit(): void {
    this.initAudio();
  }

  private initAudio(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }

    this.audio = new Audio();
    this.audio.src = this.currentStationUrl;
    this.audio.volume = 0.75;

    this.audio.addEventListener('loadeddata', () => {
      this.audio!.volume = 0.75;
    });

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.errorMessage = '';
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
    });

    this.audio.addEventListener('error', (e) => {
      this.isPlaying = false;
      this.errorMessage = 'Error al conectar con la radio';
      console.error('Radio error:', e);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
    });
  }

  onStationChange(): void {
    const wasPlaying = this.isPlaying;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = this.currentStationUrl;
      this.isPlaying = false;
      if (wasPlaying) {
        this.audio.play().catch(() => {});
      }
    }
  }

  ngOnDestroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }

  togglePlayer(): void {
    this.isExpanded = !this.isExpanded;
  }

  togglePlay(): void {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.errorMessage = '';
      this.audio.play()
        .then(() => {
          this.errorMessage = '';
        })
        .catch(err => {
          console.error('Play error:', err);
          this.errorMessage = 'No se pudo reproducir. Intenta usar el enlace externo.';
        });
    }
  }
}
