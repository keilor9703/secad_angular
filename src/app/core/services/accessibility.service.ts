import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AccessibilityState {
  darkMode: boolean;
  fontSize: 'small' | 'normal' | 'large';
}

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private readonly STORAGE_KEY = 'accessibility-settings';
  
  private defaultState: AccessibilityState = {
    darkMode: false,
    fontSize: 'normal'
  };

  private accessibilitySubject = new BehaviorSubject<AccessibilityState>(this.loadSettings());
  public accessibility$ = this.accessibilitySubject.asObservable();

  constructor() {
    this.applySettings(this.accessibilitySubject.value);
  }

  private loadSettings(): AccessibilityState {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : this.defaultState;
    } catch {
      return this.defaultState;
    }
  }

  private saveSettings(state: AccessibilityState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch {
      console.warn('No se pudo guardar configuración de accesibilidad');
    }
  }

  private applySettings(state: AccessibilityState): void {
    const htmlElement = document.documentElement;
    
    // Aplicar tema oscuro
    if (state.darkMode) {
      htmlElement.classList.add('dark-mode');
    } else {
      htmlElement.classList.remove('dark-mode');
    }

    // Aplicar tamaño de fuente
    htmlElement.style.setProperty('--font-size-scale', this.getFontSizeScale(state.fontSize));
  }

  private getFontSizeScale(fontSize: 'small' | 'normal' | 'large'): string {
    const scales: Record<'small' | 'normal' | 'large', string> = {
      small: '0.85',
      normal: '1',
      large: '1.25'
    };
    return scales[fontSize];
  }

  toggleDarkMode(): void {
    const currentState = this.accessibilitySubject.value;
    const newState = {
      ...currentState,
      darkMode: !currentState.darkMode
    };
    this.updateSettings(newState);
  }

  increaseFontSize(): void {
    const currentState = this.accessibilitySubject.value;
    const sizeMap: Record<'small' | 'normal' | 'large', 'normal' | 'large' | 'large'> = {
      small: 'normal',
      normal: 'large',
      large: 'large'
    };
    const newState = {
      ...currentState,
      fontSize: sizeMap[currentState.fontSize]
    };
    if (newState.fontSize !== currentState.fontSize) {
      this.updateSettings(newState);
    }
  }

  decreaseFontSize(): void {
    const currentState = this.accessibilitySubject.value;
    const sizeMap: Record<'small' | 'normal' | 'large', 'small' | 'small' | 'normal'> = {
      small: 'small',
      normal: 'small',
      large: 'normal'
    };
    const newState = {
      ...currentState,
      fontSize: sizeMap[currentState.fontSize]
    };
    if (newState.fontSize !== currentState.fontSize) {
      this.updateSettings(newState);
    }
  }

  private updateSettings(newState: AccessibilityState): void {
    this.saveSettings(newState);
    this.applySettings(newState);
    this.accessibilitySubject.next(newState);
  }

  getState(): AccessibilityState {
    return this.accessibilitySubject.value;
  }
}
