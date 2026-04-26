import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforma un número de mes (1-12) en el nombre del mes en español.
 * Uso: {{ 4 | mesNombre }} => 'abril'
 */
@Pipe({ name: 'mesNombre', standalone: true })
export class MesNombrePipe implements PipeTransform {
  private static readonly MESES = [
    '', // 0 index no usado
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  transform(value: number | string | null | undefined): string {
    const n = Number(value);
    if (!n || n < 1 || n > 12) return '';
    return MesNombrePipe.MESES[n];
  }
}
