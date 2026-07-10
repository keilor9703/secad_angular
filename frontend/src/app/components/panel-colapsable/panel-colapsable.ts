import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Panel colapsable reutilizable — mismo patrón visual que ev-section /
 * ev-section__head (Eventos, Recepción, Integraciones), extraído para no
 * seguir copiando el bloque de cabecera + chevron a mano en cada módulo.
 *
 * `abierto` es un @Input puro: el componente NO se auto-toggla, solo emite
 * `abiertoChange` al hacer clic. Esto permite que un padre con lógica propia
 * (p.ej. cargar datos la primera vez que se abre) intercepte el evento en
 * vez de perder el control del estado.
 */
@Component({
  selector: 'app-panel-colapsable',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './panel-colapsable.html',
  styleUrl: './panel-colapsable.scss'
})
export class PanelColapsableComponent {
  @Input() titulo = '';
  /** Clase FontAwesome del ícono de la cabecera. */
  @Input() icono = 'fa-solid fa-circle-info';
  @Input() abierto = true;
  /** La cabecera queda fija (sticky) al hacer scroll dentro de la lista de secciones. */
  @Input() sticky = false;
  @Output() abiertoChange = new EventEmitter<boolean>();

  toggle(): void {
    this.abiertoChange.emit(!this.abierto);
  }
}
