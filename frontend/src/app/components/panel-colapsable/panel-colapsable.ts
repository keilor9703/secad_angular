import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';


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
  imports: [],
  templateUrl: './panel-colapsable.html',
  styleUrl: './panel-colapsable.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelColapsableComponent {
  readonly titulo = input('');
  /** Clase FontAwesome del ícono de la cabecera. */
  readonly icono = input('fa-solid fa-circle-info');
  readonly abierto = input(true);
  /** La cabecera queda fija (sticky) al hacer scroll dentro de la lista de secciones. */
  readonly sticky = input(false);
  readonly abiertoChange = output<boolean>();

  toggle(): void {
    this.abiertoChange.emit(!this.abierto());
  }
}
