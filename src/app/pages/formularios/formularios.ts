import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formularios.html',
  styleUrls: ['./formularios.scss'],
})
export class Formularios {
  // demo values (mínimo para mostrar estilos)
  textValue = '';
  emailValue = '';
  numberValue: number | null = null;
  selectValue = '';
  textareaValue = '';
  checked = false;
  radioValue = 'op1';
  dateValue = '';
}
