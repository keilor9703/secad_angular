import { Component, ChangeDetectionStrategy, inject } from '@angular/core';

import { ToastService } from '../../../core/services/toast.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [],
  templateUrl: './formularios.html',
  styleUrls: ['./formularios.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Formularios {
  private readonly toast = inject(ToastService);
  private readonly alert = inject(AlertService);

  minimized = false;
  visible = true;

  onBuscar(): void {
    this.toast.info('Buscar', 'Consultando registros...');
  }

  onNuevo(): void {
    this.toast.success('Nuevo', 'Formulario listo para crear un registro.');
  }

  onEliminar(): void {
    this.toast.warning('Eliminar', 'Selecciona un registro antes de eliminar.');
  }

  btnAdvertencia(): void {
    this.alert.warning('Advertencia', 'No se encontraron datos para el EKOGUI proporcionado');
  }

  btnError(): void {
    this.alert.error('Error', 'No se encontraron datos para el numero  proporcionado');
  }

  btnInfo(): void {
    this.alert.info('Información', 'No se encontraron datos para el numero  proporcionado');
  }

  toggleMinimize(): void {
    this.minimized = !this.minimized;
  }

  closePanel(): void {
    this.visible = false;
  }
}
