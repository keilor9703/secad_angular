import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService,DtoDominio, DtoDominioRequest  } from '../../../core/services/administracion/dominio.service';
import { UsuarioAdminService } from '../../../core/services/administracion/usuario-admin.service';


@Component({
  selector: 'app-dominio',
  imports: [CommonModule, FormsModule, RouterModule],
  standalone: true,
  templateUrl: './dominio.html',
  styleUrls: ['./dominio.scss']
})
export class Dominio {

}
