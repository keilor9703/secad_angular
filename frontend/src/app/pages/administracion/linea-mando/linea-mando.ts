import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { ToastService } from '../../../core/services/toast.service';
import { LineaMandoService, DtoLineaMando, DtoLineaMandoRequest } from '../../../core/services/administracion/linea-mando.service';
import { UsuarioAdminService } from '../../../core/services/administracion/usuario-admin.service';

interface CargoOpcion {
  id: string;
  nombre: string;
}

@Component({
  selector: 'app-linea-mando',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './linea-mando.html',
  styleUrls: ['./linea-mando.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LineaMandoAdminComponent implements OnInit {
  private readonly toast               = inject(ToastService);
  private readonly lineaMandoService   = inject(LineaMandoService);
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly sanitizer           = inject(DomSanitizer);
  private readonly fb                  = inject(FormBuilder);

  readonly listaLineaMando     = signal<DtoLineaMando[]>([]);
  readonly loading             = signal(false);
  readonly saving              = signal(false);
  readonly searchingFuncionario = signal(false);

  readonly searchIdentificacion = signal('');
  readonly modoEdicion          = signal(false);
  readonly idEditando           = signal<number | null>(null);

  readonly fotoPreview     = signal<string | null>(null);
  private fotoBase64: string | null = null;
  fotoCambiada  = false;
  readonly hayFuncionario  = signal(false);

  readonly pesoOpciones: CargoOpcion[] = [
    { id: 'Director Policía', nombre: 'Director Policía' },
    { id: 'Subdirector Policía', nombre: 'Subdirector Policía' },
    { id: 'Jefe Unidad', nombre: 'Jefe Unidad' },
    { id: 'Mando Ejecutivo', nombre: 'Mando Ejecutivo' }
  ];

  readonly formData = this.fb.nonNullable.group({
    identificacion: ['', [Validators.required]],
    nombre:         ['', [Validators.required]],
    apellidos:      [''],
    grado:          [''],
    cargo:          [''],
    peso:           ['', [Validators.required]],
    unidad:         [''],
    orden:          [1]
  });

  ngOnInit(): void {
    this.cargarLineaMando();
  }

  cargarLineaMando(): void {
    this.loading.set(true);
    this.lineaMandoService.getAll().subscribe({
      next: (data) => {
        this.listaLineaMando.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'No se pudo cargar la línea de mando');
      }
    });
  }

  onSearchEnter(event: Event): void {
    event.preventDefault();
    this.buscarFuncionario();
  }

  buscarFuncionario(): void {
    const doc = this.searchIdentificacion().trim();
    if (!doc) {
      this.toast.warning('Buscar', 'Ingrese un número de identificación');
      return;
    }

    this.searchingFuncionario.set(true);
    this.hayFuncionario.set(false);

    this.usuarioAdminService.consultarUsuarioPorIdentificacion(doc).subscribe({
      next: (resp) => {
        const func = resp.funcionario;

        if (!func || !func.nombres) {
          this.searchingFuncionario.set(false);
          this.toast.warning('Buscar', 'No se encontró funcionario con esa identificación');
          return;
        }

        const activo = func.activo !== false;

        if (!activo) {
          this.searchingFuncionario.set(false);
          this.toast.warning('Buscar', 'El usuario está inactivo en el sistema');
          return;
        }

        this.formData.reset({
          identificacion: doc,
          nombre: func.nombres ?? '',
          apellidos: func.apellidos ?? '',
          grado: func.nombreGrado ?? func.cargo ?? '',
          cargo: func.cargo ?? '',
          peso: '',
          unidad: func.dependencia ?? '',
          orden: this.listaLineaMando().length + 1
        });
        this.fotoBase64 = resp.fotoBase64 ?? null;

        this.fotoPreview.set(this.getFotoUrlFromBase64(resp.fotoBase64 ?? null));
        this.fotoCambiada = false;
        this.hayFuncionario.set(true);
        this.searchingFuncionario.set(false);
        this.toast.success('Encontrado', 'Datos del funcionario cargados');
      },
      error: () => {
        this.searchingFuncionario.set(false);
        this.toast.error('Buscar', 'Error al consultar funcionario');
      }
    });
  }

  validarPesoUnico(): boolean {
    const pesoActual = this.formData.getRawValue().peso;
    if (!pesoActual) {
      return true;
    }

    const editando = this.idEditando() ?? 0;
    const existentes = this.listaLineaMando().filter(item =>
      item.peso === pesoActual &&
      item.vigente === 1 &&
      item.idLineaMando !== editando
    );

    if (existentes.length > 0) {
      this.toast.warning('Peso', `Ya existe un ${pesoActual} activo en la línea de mando`);
      return false;
    }

    return true;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (file.size > 2 * 1024 * 1024) {
        this.toast.warning('Foto', 'El archivo no puede superar 2MB');
        return;
      }

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const isValidType = validTypes.includes(file.type);

      if (!isValidType) {
        this.toast.warning('Foto', 'Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP)');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (!result.startsWith('data:image/')) {
          this.toast.warning('Foto', 'El archivo seleccionado no es una imagen válida');
          return;
        }
        this.fotoPreview.set(result);
        this.fotoBase64 = result;
        this.fotoCambiada = true;
      };
      reader.readAsDataURL(file);
    }
  }

  limpiarForm(): void {
    this.formData.reset({
      identificacion: '', nombre: '', apellidos: '', grado: '',
      cargo: '', peso: '', unidad: '', orden: 1
    });
    this.fotoBase64 = null;
    this.fotoPreview.set(null);
    this.fotoCambiada = false;
    this.modoEdicion.set(false);
    this.idEditando.set(null);
    this.searchIdentificacion.set('');
    this.hayFuncionario.set(false);
  }

  limpiarDatosFuncionario(): void {
    const ordenActual = this.formData.getRawValue().orden;
    this.formData.reset({
      identificacion: '', nombre: '', apellidos: '', grado: '',
      cargo: '', peso: '', unidad: '', orden: ordenActual
    });
    this.fotoBase64 = null;
    this.fotoPreview.set(null);
    this.fotoCambiada = false;
    this.hayFuncionario.set(false);
  }

  editar(item: DtoLineaMando): void {
    this.modoEdicion.set(true);
    this.idEditando.set(item.idLineaMando);
    this.searchIdentificacion.set(item.identificacion);
    this.formData.reset({
      identificacion: item.identificacion,
      nombre: item.nombre,
      apellidos: item.apellidos,
      grado: item.grado,
      cargo: item.cargo,
      peso: item.peso,
      unidad: item.unidad,
      orden: item.orden
    });
    this.fotoBase64 = item.fotoBase64;
    this.fotoPreview.set(this.getFotoUrlFromBase64(item.fotoBase64));
    this.fotoCambiada = false;
    this.hayFuncionario.set(true);
  }

  guardar(): void {
    if (this.formData.invalid) {
      this.formData.markAllAsTouched();
      const v = this.formData.getRawValue();
      if (!v.identificacion) {
        this.toast.warning('Guardar', 'La identificación es requerida');
      } else if (!v.nombre) {
        this.toast.warning('Guardar', 'El nombre es requerido');
      } else if (!v.peso) {
        this.toast.warning('Guardar', 'Debe seleccionar un peso');
      }
      return;
    }

    const v = this.formData.getRawValue();
    const editando = this.idEditando() ?? 0;
    const existenteMismoPeso = this.listaLineaMando().find(item =>
      item.peso === v.peso &&
      item.vigente === 1 &&
      item.idLineaMando !== editando
    );

    if (existenteMismoPeso && !this.modoEdicion()) {
      const confirmado = confirm(
        `Ya existe un registro activo con el cargo "${v.peso}" (${existenteMismoPeso.grado} ${existenteMismoPeso.nombre}).\n\n` +
        `¿Está seguro que desea reemplazarlo?\n\n` +
        `El registro anterior pasará a estado Inactivo.`
      );

      if (!confirmado) {
        return;
      }

      this.sustituirRegistro(existenteMismoPeso.idLineaMando);
      return;
    }

    if (!this.validarPesoUnico()) {
      return;
    }

    this.ejecutarGuardado();
  }

  ejecutarGuardado(): void {
    this.saving.set(true);

    const modoEdicion = this.modoEdicion();
    let fotoBase64: string | null = this.fotoBase64;
    if (!this.fotoCambiada) {
      fotoBase64 = modoEdicion ? this.fotoBase64 : null;
    }

    const v = this.formData.getRawValue();
    const request: DtoLineaMandoRequest = {
      identificacion: v.identificacion || '',
      nombre: v.nombre || '',
      apellidos: v.apellidos || '',
      grado: v.grado || '',
      cargo: v.cargo || '',
      peso: v.peso || '',
      unidad: v.unidad || '',
      fotoBase64: fotoBase64,
      orden: Number(v.orden) || 1
    };

    const idEditando = this.idEditando();
    const request$ = modoEdicion && idEditando
      ? this.lineaMandoService.update(idEditando, request)
      : this.lineaMandoService.create(request);

    request$.subscribe({
      next: (resp) => {
        this.saving.set(false);
        if (resp.success) {
          this.toast.success('Guardar', resp.message);
          this.limpiarForm();
          this.cargarLineaMando();
        } else {
          this.toast.warning('Guardar', resp.message);
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Guardar', `Error al ${modoEdicion ? 'actualizar' : 'crear'}`);
      }
    });
  }

  eliminar(item: DtoLineaMando): void {
    if (!confirm(`¿Está seguro de eliminar a ${item.nombre} ${item.apellidos}?`)) {
      return;
    }

    this.lineaMandoService.setVigente(item.idLineaMando, 0).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.toast.success('Eliminar', resp.message);
          this.cargarLineaMando();
        } else {
          this.toast.warning('Eliminar', resp.message);
        }
      },
      error: () => {
        this.toast.error('Eliminar', 'Error al eliminar');
      }
    });
  }

  sustituirRegistro(idAnterior: number): void {
    this.saving.set(true);

    this.lineaMandoService.setVigente(idAnterior, 0).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.ejecutarGuardado();
        } else {
          this.saving.set(false);
          this.toast.error('Sustituir', 'Error al inactivar registro anterior');
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Sustituir', 'Error al inactivar registro anterior');
      }
    });
  }

  getNombreCompleto(): string {
    const v = this.formData.getRawValue();
    return `${v.nombre} ${v.apellidos}`.trim();
  }

  getNombreCompletoItem(item: DtoLineaMando): string {
    return this.sanitizeText(`${item.nombre} ${item.apellidos}`.trim());
  }

  getGradoItem(item: DtoLineaMando): string {
    return this.sanitizeText(item.grado);
  }

  getIdentificacionItem(item: DtoLineaMando): string {
    return this.sanitizeText(item.identificacion);
  }

  getUnidadItem(item: DtoLineaMando): string {
    return this.sanitizeText(item.unidad);
  }

  getPesoItem(item: DtoLineaMando): string {
    return this.sanitizeText(item.peso);
  }

  private getFotoUrlFromBase64(fotoBase64: string | null): string {
    if (!fotoBase64) return 'imagenes/policia.jpg';
    const base64 = fotoBase64.trim();
    if (base64.startsWith('data:')) return base64;
    return 'data:image/jpeg;base64,' + base64;
  }

  private sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  getFotoUrl(item: DtoLineaMando): string {
    return this.getFotoUrlFromBase64(item.fotoBase64);
  }
}
