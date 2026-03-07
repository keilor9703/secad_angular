import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TextToSpeechService {
  private synthesis = window.speechSynthesis;
  private isSpeaking = false;
  private speakingSubject = new BehaviorSubject<boolean>(false);
  public speaking$ = this.speakingSubject.asObservable();

  constructor() {}

  speak(text?: string): void {
    if (!this.synthesis) {
      console.warn('Speech Synthesis API no disponible');
      return;
    }

    // Si no hay texto, leer el contenido visible de la página
    const textToSpeak = text || this.getPageContent();

    if (!textToSpeak) {
      console.warn('No hay texto para convertir a voz');
      return;
    }

    // Cancelar síntesis anterior si existe
    if (this.isSpeaking) {
      this.synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'es-ES';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.speakingSubject.next(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.speakingSubject.next(false);
    };

    utterance.onerror = (error) => {
      console.error('Error en síntesis de voz:', error);
      this.isSpeaking = false;
      this.speakingSubject.next(false);
    };

    this.synthesis.speak(utterance);
  }

  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.speakingSubject.next(false);
    }
  }

  toggleSpeaking(text?: string): void {
    if (this.isSpeaking) {
      this.stop();
    } else {
      this.speak(text);
    }
  }

  private getPageContent(): string {
    // Extraer texto visible del contenido principal
    const main = document.querySelector('.content') || document.querySelector('main');
    if (main) {
      return main.textContent || '';
    }
    return document.body.textContent || '';
  }

  isAvailable(): boolean {
    return !!this.synthesis;
  }

  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }
}
