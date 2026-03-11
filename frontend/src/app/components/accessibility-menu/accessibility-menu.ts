import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccessibilityService, AccessibilityState } from '../../core/services/accessibility.service';
import { SpeechToTextService } from '../../core/services/speech-to-text.service';
import { TextToSpeechService } from '../../core/services/text-to-speech.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-accessibility-menu',
  templateUrl: './accessibility-menu.html',
  styleUrls: ['./accessibility-menu.scss'],
  standalone: true,
  imports: [CommonModule],
  host: {
    'class': 'accessibility-menu-host'
  }
})
export class AccessibilityMenuComponent implements OnInit, OnDestroy {
  accessibility: AccessibilityState = {
    darkMode: false,
    fontSize: 2 // nivel por defecto (normal)
  };

  isListening = false;
  isSpeaking = false;
  speechToTextAvailable = false;
  textToSpeechAvailable = false;

  private destroy$ = new Subject<void>();

  constructor(
    private accessibilityService: AccessibilityService,
    private speechToTextService: SpeechToTextService,
    private textToSpeechService: TextToSpeechService
  ) {
    this.speechToTextAvailable = this.speechToTextService.isAvailable();
    this.textToSpeechAvailable = this.textToSpeechService.isAvailable();
  }

  ngOnInit(): void {
    // Suscribirse a cambios de accesibilidad
    this.accessibilityService.accessibility$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.accessibility = state;
      });

    // Suscribirse al estado de escucha
    this.speechToTextService.listening$
      .pipe(takeUntil(this.destroy$))
      .subscribe((listening) => {
        this.isListening = listening;
      });

    // Suscribirse al estado de síntesis
    this.textToSpeechService.speaking$
      .pipe(takeUntil(this.destroy$))
      .subscribe((speaking) => {
        this.isSpeaking = speaking;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Detener cualquier proceso de voz pendiente
    this.speechToTextService.stopListening();
    this.textToSpeechService.stop();
  }

  toggleDarkMode(): void {
    this.accessibilityService.toggleDarkMode();
  }

  increaseFontSize(): void {
    this.accessibilityService.increaseFontSize();
  }

  decreaseFontSize(): void {
    this.accessibilityService.decreaseFontSize();
  }

  toggleSpeechToText(): void {
    this.speechToTextService.toggleListening();
  }

  toggleTextToSpeech(): void {
    if (this.isSpeaking) {
      this.textToSpeechService.stop();
      this.isSpeaking = false;
    } else {
      this.isSpeaking = true;
      this.textToSpeechService.toggleSpeaking();
    }
  }

  get isDarkMode(): boolean {
    return this.accessibility.darkMode;
  }

  get isFontSizeSmall(): boolean {
    return this.accessibility.fontSize === 0;
  }

  get isFontSizeLarge(): boolean {
    return this.accessibility.fontSize === 6;
  }

  get currentFontLevel(): string {
    return `${this.accessibility.fontSize + 1}/7`;
  }

  get fontSizeLabel(): string {
    const labels = ['Muy pequeña', 'Pequeña', 'Normal', 'Mediana', 'Grande', 'Muy grande', 'Extra grande'];
    return labels[this.accessibility.fontSize] || 'Normal';
  }
}
