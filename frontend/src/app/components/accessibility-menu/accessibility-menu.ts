import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AccessibilityService, AccessibilityState } from '../../core/services/accessibility.service';
import { SpeechToTextService } from '../../core/services/speech-to-text.service';
import { TextToSpeechService } from '../../core/services/text-to-speech.service';

@Component({
  selector: 'app-accessibility-menu',
  templateUrl: './accessibility-menu.html',
  styleUrls: ['./accessibility-menu.scss'],
  standalone: true,
  imports: [],
  host: {
    'class': 'accessibility-menu-host'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessibilityMenuComponent implements OnInit, OnDestroy {
  private readonly accessibilityService = inject(AccessibilityService);
  private readonly speechToTextService  = inject(SpeechToTextService);
  private readonly textToSpeechService  = inject(TextToSpeechService);

  readonly accessibility = signal<AccessibilityState>({
    darkMode: false,
    fontSize: 2 // nivel por defecto (normal)
  });

  readonly isListening = signal(false);
  readonly isSpeaking  = signal(false);

  /** Se resuelve una sola vez al construir — no cambia durante la vida del componente. */
  readonly speechToTextAvailable = this.speechToTextService.isAvailable();
  readonly textToSpeechAvailable = this.textToSpeechService.isAvailable();

  readonly isDarkMode      = computed(() => this.accessibility().darkMode);
  readonly isFontSizeSmall = computed(() => this.accessibility().fontSize === 0);
  readonly isFontSizeLarge = computed(() => this.accessibility().fontSize === 6);
  readonly currentFontLevel = computed(() => `${this.accessibility().fontSize + 1}/7`);
  readonly fontSizeLabel = computed(() => {
    const labels = ['Muy pequeña', 'Pequeña', 'Normal', 'Mediana', 'Grande', 'Muy grande', 'Extra grande'];
    return labels[this.accessibility().fontSize] || 'Normal';
  });

  ngOnInit(): void {
    // Suscribirse a cambios de accesibilidad
    this.accessibilityService.accessibility$
      .pipe(takeUntilDestroyed())
      .subscribe((state) => this.accessibility.set(state));

    // Suscribirse al estado de escucha
    this.speechToTextService.listening$
      .pipe(takeUntilDestroyed())
      .subscribe((listening) => this.isListening.set(listening));

    // Suscribirse al estado de síntesis
    this.textToSpeechService.speaking$
      .pipe(takeUntilDestroyed())
      .subscribe((speaking) => this.isSpeaking.set(speaking));
  }

  ngOnDestroy(): void {
    // Detener cualquier proceso de voz pendiente — no es limpieza de suscripción
    // (eso ya lo hace takeUntilDestroyed), es apagar micrófono/síntesis activos.
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
    if (this.isSpeaking()) {
      this.textToSpeechService.stop();
      this.isSpeaking.set(false);
    } else {
      this.isSpeaking.set(true);
      this.textToSpeechService.toggleSpeaking();
    }
  }
}
