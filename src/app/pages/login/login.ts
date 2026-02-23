import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  usuario = '';
  contrasena = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  private loginTimeoutHandle: any = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.usuario?.trim() || !this.contrasena?.trim()) {
      this.errorMessage = 'Debe diligenciar usuario y contraseña.';
      return;
    }

    this.isLoading = true;

    this.loginTimeoutHandle = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'La autenticación está tardando demasiado. Intente nuevamente.';
      }
    }, 35000);

    this.authService.login(this.usuario.trim(), this.contrasena).subscribe({
      next: (resp) => {
        clearTimeout(this.loginTimeoutHandle);
        this.isLoading = false;

        if (this.authService.isLoginSuccessful(resp)) {
          this.router.navigate(['/home']);
          return;
        }

        this.errorMessage = resp?.mensaje ?? resp?.message ?? 'No fue posible iniciar sesión.';
      },
      error: (err) => {
        clearTimeout(this.loginTimeoutHandle);
        this.isLoading = false;
        this.errorMessage = err?.error?.mensaje ?? err?.error?.message ?? 'Error de conexión con el servicio de autenticación.';
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
