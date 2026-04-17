import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService, DtoDominio } from '../../../core/services/administracion/dominio.service';
import {
  DtoPersonajeMes,
  DtoPersonajeMesRequest,
  PersonajeMesService
} from '../../../core/services/administracion/personaje-mes.service';
import { UsuarioAdminService } from '../../../core/services/administracion/usuario-admin.service';

@Component({
  selector: 'app-personaje-mes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personaje-mes.html',
  styleUrls: ['./personaje-mes.scss']
})
export class PersonajeMesAdminComponent implements OnInit {
  personajes: DtoPersonajeMes[] = [];
  categorias: DtoDominio[] = [];
  categoriaDetectada: string | null = null;
  categoriaNoReconocida = false;

  private catalogoCategoriasPermitidas: DtoDominio[] = [];
  private categoriaConsultadaId: number | null = null;
  private categoriaConsultadaDescripcion: string | null = null;
  private readonly categoriasPermitidas = [
    'Oficiales',
    'Nivel Ejecutivo',
    'Patrulleros',
    'Suboficiales',
    'Agentes',
    'Estudiantes',
    'Auxiliares de Policía'
  ];
  private readonly aliasCategorias: Record<string, string[]> = {
    oficiales: ['oficiales', 'oficial'],
    'nivel ejecutivo': ['nivel ejecutivo', 'ejecutivo'],
    patrulleros: ['patrulleros', 'patrullero', 'patrullero de policia'],
    suboficiales: ['suboficiales', 'suboficial'],
    agentes: ['agentes', 'agente'],
    estudiantes: ['estudiantes', 'estudiante'],
    'auxiliares de policia': ['auxiliares de policia', 'auxiliar de policia', 'auxiliares', 'auxiliar']
  };
  private readonly reglasGradoCategoria = [
    { grado: 'Teniente General', categoria: 'Oficiales' },
    { grado: 'Mayor General', categoria: 'Oficiales' },
    { grado: 'Brigadier General', categoria: 'Oficiales' },
    { grado: 'Teniente Coronel', categoria: 'Oficiales' },
    { grado: 'Subteniente', categoria: 'Oficiales' },
    { grado: 'Coronel', categoria: 'Oficiales' },
    { grado: 'Capitán', categoria: 'Oficiales' },
    { grado: 'Teniente', categoria: 'Oficiales' },
    { grado: 'General', categoria: 'Oficiales' },
    { grado: 'Mayor', categoria: 'Oficiales' },
    { grado: 'Subcomisario', categoria: 'Nivel Ejecutivo' },
    { grado: 'Comisario', categoria: 'Nivel Ejecutivo' },
    { grado: 'Intendente Jefe', categoria: 'Nivel Ejecutivo' },
    { grado: 'Subintendente', categoria: 'Nivel Ejecutivo' },
    { grado: 'Intendente', categoria: 'Nivel Ejecutivo' },
    { grado: 'Patrullero de Policía', categoria: 'Patrulleros' },
    { grado: 'Patrullero', categoria: 'Patrulleros' },
    { grado: 'Sargento Mayor', categoria: 'Suboficiales' },
    { grado: 'Sargento Primero', categoria: 'Suboficiales' },
    { grado: 'Sargento Viceprimero', categoria: 'Suboficiales' },
    { grado: 'Sargento Segundo', categoria: 'Suboficiales' },
    { grado: 'Cabo Primero', categoria: 'Suboficiales' },
    { grado: 'Cabo Segundo', categoria: 'Suboficiales' },
    { grado: 'Auxiliares de Policía', categoria: 'Auxiliares de Policía' },
    { grado: 'Auxiliar de Policía', categoria: 'Auxiliares de Policía' },
    { grado: 'Estudiantes', categoria: 'Estudiantes' },
    { grado: 'Estudiante', categoria: 'Estudiantes' },
    { grado: 'Agentes', categoria: 'Agentes' },
    { grado: 'Agente', categoria: 'Agentes' }
  ].sort((a, b) => b.grado.length - a.grado.length);
  readonly meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];
  readonly aniosDisponibles = this.buildAniosDisponibles();

  loading = false;
  saving = false;
  uploading = false;
  searchingFuncionario = false;
  modoEdicion = false;
  hayFuncionario = false;
  idEditando: number | null = null;

  searchIdentificacion = '';
  fotoPreview = 'imagenes/policia.jpg';

  private readonly maxImageBytes = 2 * 1024 * 1024;
  private readonly targetOptimizedImageBytes = 90 * 1024;
  private readonly maxImageDimension = 960;

  formData: DtoPersonajeMesRequest = this.createEmptyForm();

  constructor(
    private personajeMesService: PersonajeMesService,
    private dominioService: DominioService,
    private toast: ToastService,
    private usuarioAdminService: UsuarioAdminService
  ) {}

  ngOnInit(): void {
    this.cargarPersonajes();
    this.cargarCategorias();
  }

  private createEmptyForm(): DtoPersonajeMesRequest {
    const today = new Date();
    return {
      identificacion: '',
      nombres: '',
      apellidos: '',
      grado: '',
      cargo: '',
      unidad: '',
      IdCategoria: 0,
      NumeroActa: '',
      FotoModificada: '',
      Mes: today.getMonth() + 1,
      Anio: today.getFullYear()
    };
  }

  private buildAniosDisponibles(): number[] {
    const currentYear = new Date().getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear];
  }

  cargarPersonajes(): void {
    this.loading = true;
    this.personajeMesService.getAll().subscribe({
      next: (data) => {
        this.personajes = (data ?? []).slice().sort((a, b) => {
          const vigenteDiff = Number(b.vigente ?? 0) - Number(a.vigente ?? 0);
          if (vigenteDiff !== 0) {
            return vigenteDiff;
          }

          return `${a.nombres ?? ''} ${a.apellidos ?? ''}`.localeCompare(`${b.nombres ?? ''} ${b.apellidos ?? ''}`);
        });
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error('Personaje del mes', err?.error?.message ?? 'No se pudo cargar el listado.');
      }
    });
  }

  cargarCategorias(): void {
    this.dominioService.getAll().subscribe({
      next: (data) => {
        this.catalogoCategoriasPermitidas = (data ?? [])
          .filter((item) => Number(item.idPadre) === 1 && Number(item.vigente) === 1)
          .filter((item) => this.esCategoriaPermitida(item.descripcion))
          .sort((a, b) => (a.descripcion ?? '').localeCompare(b.descripcion ?? ''));

        this.actualizarCategoriasPorGrado();
      },
      error: (err) => {
        this.toast.error('Categorías', err?.error?.message ?? 'No se pudieron cargar las categorías.');
      }
    });
  }

  private actualizarCategoriasPorGrado(): void {
    const categoriaCatalogo = this.resolverCategoriaEnCatalogo();
    const categoria = categoriaCatalogo?.descripcion
      ?? this.categoriaConsultadaDescripcion
      ?? this.obtenerCategoriaPorGrado(this.formData.grado || this.formData.cargo);
    const hayRegistroCargado = this.hayFuncionario || this.modoEdicion;

    this.categoriaDetectada = categoria;
    this.categoriaNoReconocida = hayRegistroCargado && !categoriaCatalogo;

    if (!hayRegistroCargado) {
      this.categorias = [...this.catalogoCategoriasPermitidas];
      return;
    }

    if (!categoriaCatalogo) {
      this.formData.IdCategoria = 0;
      this.categorias = [];
      return;
    }

    this.categorias = [categoriaCatalogo];
    this.formData.IdCategoria = Number(categoriaCatalogo.idDominio ?? 0);
    this.categoriaNoReconocida = false;
  }

  private resolverCategoriaEnCatalogo(): DtoDominio | null {
    return this.obtenerCategoriaPreferidaEnCatalogo()
      ?? this.buscarCategoriaEnCatalogo(this.obtenerCategoriaPorGrado(this.formData.grado || this.formData.cargo));
  }

  private obtenerCategoriaPreferidaEnCatalogo(): DtoDominio | null {
    const idCategoriaConsultada = Number(this.categoriaConsultadaId ?? 0);
    if (idCategoriaConsultada > 0) {
      const matchById = this.catalogoCategoriasPermitidas.find(
        (item) => Number(item.idDominio) === idCategoriaConsultada
      );

      if (matchById) {
        return matchById;
      }
    }

    const idCategoriaFormulario = Number(this.formData.IdCategoria ?? 0);
    if (idCategoriaFormulario > 0) {
      const matchById = this.catalogoCategoriasPermitidas.find(
        (item) => Number(item.idDominio) === idCategoriaFormulario
      );

      if (matchById) {
        return matchById;
      }
    }

    if (this.categoriaConsultadaDescripcion) {
      return this.buscarCategoriaEnCatalogo(this.categoriaConsultadaDescripcion);
    }

    return null;
  }

  private obtenerCategoriaPorGrado(grado: string | null | undefined): string | null {
    const gradoNormalizado = this.normalizeText(grado);

    if (!gradoNormalizado) {
      return null;
    }

    const regla = this.reglasGradoCategoria.find((item) => {
      const alias = this.normalizeText(item.grado);
      return gradoNormalizado === alias || gradoNormalizado.includes(alias);
    });

    return regla?.categoria ?? null;
  }

  private buscarCategoriaEnCatalogo(categoriaEsperada: string | null | undefined): DtoDominio | null {
    const alias = this.obtenerAliasCategoria(categoriaEsperada);

    for (const nombreAlias of alias) {
      const match = this.catalogoCategoriasPermitidas.find(
        (item) => this.normalizeCategoria(item.descripcion) === nombreAlias
      );

      if (match) {
        return match;
      }
    }

    return null;
  }

  private obtenerAliasCategoria(categoria: string | null | undefined): string[] {
    const categoriaNormalizada = this.normalizeCategoria(categoria);
    return this.aliasCategorias[categoriaNormalizada] ?? [categoriaNormalizada];
  }

  private esCategoriaPermitida(descripcion: string | null | undefined): boolean {
    const descripcionNormalizada = this.normalizeCategoria(descripcion);
    return this.categoriasPermitidas.some((item) => {
      const categoriaBase = this.normalizeCategoria(item);
      return this.obtenerAliasCategoria(categoriaBase).includes(descripcionNormalizada);
    });
  }

  private normalizeCategoria(value: string | null | undefined): string {
    return this.normalizeText(value)
      .replace(/^categoria\s+/, '')
      .trim();
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  onSearchEnter(event: Event): void {
    event.preventDefault();
    this.buscarFuncionario();
  }

  buscarFuncionario(): void {
    const doc = this.searchIdentificacion.trim();
    if (!doc) {
      this.toast.warning('Buscar', 'Ingrese un número de identificación');
      return;
    }

    this.searchingFuncionario = true;
    this.hayFuncionario = false;

    this.usuarioAdminService.consultarUsuarioPorIdentificacion(doc).subscribe({
      next: (resp) => {
        const func = resp.funcionario;

        if (!func || !func.nombres) {
          this.searchingFuncionario = false;
          this.toast.warning('Buscar', 'No se encontró funcionario con esa identificación');
          this.fotoPreview = 'imagenes/policia.jpg';
          return;
        }

        const activo = func.activo !== false;
        if (!activo) {
          this.searchingFuncionario = false;
          this.toast.warning('Buscar', 'El usuario está inactivo en el sistema');
          this.fotoPreview = 'imagenes/policia.jpg';
          return;
        }

        const identificacion = (func.identificacion ?? doc).trim();
        const fotoConsultada = (resp.fotoBase64 ?? '').trim();
        const categoriaIdConsultada = Number(func.idCategoria ?? 0);
        const categoriaDescripcionConsultada = (func.categoriaDescripcion ?? '').trim();

        this.categoriaConsultadaId = categoriaIdConsultada > 0 ? categoriaIdConsultada : null;
        this.categoriaConsultadaDescripcion = categoriaDescripcionConsultada || null;

        this.formData = {
          identificacion,
          nombres: (func.nombres ?? '').trim(),
          apellidos: (func.apellidos ?? '').trim(),
          grado: (func.nombreGrado ?? func.cargo ?? '').trim(),
          cargo: (func.cargo ?? '').trim(),
          unidad: (func.dependencia ?? '').trim(),
          IdCategoria: this.categoriaConsultadaId ?? Number(this.formData.IdCategoria ?? 0),
          NumeroActa: (this.formData.NumeroActa ?? '').trim(),
          FotoModificada: '',
          Mes: Number(this.formData.Mes ?? 0),
          Anio: Number(this.formData.Anio ?? 0),
        };

        this.fotoPreview = this.getImageUrl(fotoConsultada);
        this.hayFuncionario = true;
        this.actualizarCategoriasPorGrado();
        this.searchingFuncionario = false;

        if (fotoConsultada) {
          this.persistirFotoConsultada(fotoConsultada, identificacion);
        }

        this.toast.success('Buscar', 'Datos del funcionario cargados');
      },
      error: (err) => {
        this.searchingFuncionario = false;
        this.hayFuncionario = false;
        this.fotoPreview = 'imagenes/policia.jpg';
        this.toast.error('Buscar', err?.error?.message ?? 'Error al consultar funcionario');
      }
    });
  }

  guardar(): void {
    const identificacion = (this.formData.identificacion ?? '').trim();
    const nombres = (this.formData.nombres ?? '').trim();
    const apellidos = (this.formData.apellidos ?? '').trim();
    const grado = (this.formData.grado ?? '').trim();
    const cargo = (this.formData.cargo ?? '').trim();
    const unidad = (this.formData.unidad ?? '').trim();
    const numeroActa = (this.formData.NumeroActa ?? '').trim();
    const categoriaValida = this.resolverCategoriaEnCatalogo();
    const idCategoria = Number(categoriaValida?.idDominio ?? this.formData.IdCategoria ?? 0);
    const mes = Number(this.formData.Mes ?? 0);
    const anio = Number(this.formData.Anio ?? 0);

    if (!this.modoEdicion && !this.hayFuncionario) {
      this.toast.warning('Personaje del mes', 'Primero consulte un funcionario por cédula.');
      return;
    }

    if (!identificacion) {
      this.toast.warning('Personaje del mes', 'La identificación es obligatoria.');
      return;
    }

    if (!nombres) {
      this.toast.warning('Personaje del mes', 'Los nombres son obligatorios.');
      
      return;
    }

    if (!cargo) {
      this.toast.warning('Personaje del mes', 'El cargo es obligatorio.');
      return;
    }

    if (!unidad) {
      this.toast.warning('Personaje del mes', 'La unidad es obligatoria.');
      return;
    }

    this.formData.IdCategoria = idCategoria;
    this.categoriaNoReconocida = !categoriaValida;

    if (!idCategoria) {
      const categoriaConsultada = (this.categoriaConsultadaDescripcion ?? this.categoriaDetectada ?? '').trim();
      this.toast.warning(
        'Personaje del mes',
        categoriaConsultada
          ? `La categoría consultada (${categoriaConsultada}) no tiene una equivalencia habilitada para Personaje del Mes.`
          : 'El funcionario consultado no tiene una categoría habilitada para Personaje del Mes.'
      );
      return;
    }

    if (!numeroActa) {
      this.toast.warning('Personaje del mes', 'El número de acta es obligatorio.');
      return;
    }
    
    if (!mes) {
      this.toast.warning('Personaje del mes', 'Debe seleccionar un mes.');
      return;
    }

    if (!anio) {
      this.toast.warning('Personaje del mes', 'Debe seleccionar un año.');
      return;
    }

    if (mes < 1 || mes > 12) {
      this.toast.warning('Personaje del mes', 'El mes seleccionado no es válido.');
      return;
    }

    if (!this.aniosDisponibles.includes(anio)) {
      this.toast.warning('Personaje del mes', 'El año seleccionado no está dentro del rango permitido.');
      return;
    }

    const payload: DtoPersonajeMesRequest = {
      identificacion,
      nombres,
      apellidos,
      grado,
      cargo,
      unidad,
      IdCategoria: idCategoria,
      NumeroActa: numeroActa,
      FotoModificada: (this.formData.FotoModificada ?? '').trim() || null,
      Mes: mes,
      Anio: anio
    };

    this.saving = true;

    const request$ = this.modoEdicion && this.idEditando
      ? this.personajeMesService.update(this.idEditando, payload)
      : this.personajeMesService.create(payload);

    request$.subscribe({
      next: (resp) => {
        this.saving = false;
        if (!resp.success) {
          this.toast.warning('Personaje del mes', resp.message ?? 'No fue posible guardar el registro.');
          return;
        }

        this.toast.success('Personaje del mes', resp.message ?? 'Registro guardado correctamente.');
        this.limpiarForm();
        this.cargarPersonajes();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('Personaje del mes', err?.error?.message ?? 'Error guardando el registro.');
      }
    });
  }

  editar(item: DtoPersonajeMes): void {
    this.modoEdicion = true;
    this.hayFuncionario = true;
    this.idEditando = item.idPersonajeMes;
    this.searchIdentificacion = item.identificacion ?? '';
    this.categoriaConsultadaId = Number(item.idCategoria ?? 0) || null;
    this.categoriaConsultadaDescripcion = this.categoriaConsultadaId
      ? this.getCategoriaDescripcion(this.categoriaConsultadaId)
      : null;
    this.formData = {
      identificacion: item.identificacion ?? '',
      nombres: item.nombres ?? '',
      apellidos: item.apellidos ?? '',
      grado: item.grado ?? '',
      cargo: item.cargo ?? '',
      unidad: item.unidad ?? '',
      IdCategoria: Number(item.idCategoria ?? 0),
      NumeroActa: item.numeroActa ?? '',
      FotoModificada: item.fotoModificada ?? '',
      Mes: this.getMesValue(item),
      Anio: this.getAnioValue(item)
    };
    this.fotoPreview = this.getImageUrl(item.fotoModificada);
    this.actualizarCategoriasPorGrado();
  }

  eliminar(item: DtoPersonajeMes): void {
    if (!confirm(`¿Está seguro de eliminar el registro de ${this.getNombreCompleto(item)}?`)) {
      return;
    }

    this.personajeMesService.delete(item.idPersonajeMes).subscribe({
      next: (resp) => {
        if (!resp.success) {
          this.toast.warning('Personaje del mes', resp.message ?? 'No fue posible eliminar el registro.');
          return;
        }

        this.toast.success('Personaje del mes', resp.message ?? 'Registro eliminado correctamente.');
        if (this.idEditando === item.idPersonajeMes) {
          this.limpiarForm();
        }
        this.cargarPersonajes();
      },
      error: (err) => {
        this.toast.error('Personaje del mes', err?.error?.message ?? 'Error eliminando el registro.');
      }
    });
  }

  cambiarEstado(item: DtoPersonajeMes): void {
    const nuevoEstado = Number(item.vigente) === 1 ? 0 : 1;
    const accion = nuevoEstado === 1 ? 'activar' : 'inactivar';
    const accionCompleta = nuevoEstado === 1 ? 'activado' : 'inactivado';

    if (!confirm(`¿Desea ${accion} el registro de ${this.getNombreCompleto(item)}?`)) {
      return;
    }

    this.personajeMesService.setVigente(item.idPersonajeMes, nuevoEstado).subscribe({
      next: (resp) => {
        if (!resp.success) {
          this.toast.warning('Personaje del mes', resp.message ?? `No fue posible ${accion} el registro.`);
          return;
        }

        this.toast.success('Personaje del mes', resp.message ?? `Registro ${accionCompleta} correctamente.`);
        this.cargarPersonajes();
      },
      error: (err) => {
        this.toast.error('Personaje del mes', err?.error?.message ?? `Error al ${accion} el registro.`);
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;

    if (!file) {
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.toast.warning('Imagen', 'Solo se permiten imágenes JPG, JPEG, PNG o WEBP.');
      input.value = '';
      return;
    }

    this.uploading = true;

    this.optimizeImageFile(file)
      .then((optimizedFile) => {
        if (optimizedFile.size > this.maxImageBytes) {
          this.uploading = false;
          input.value = '';
          this.toast.warning('Imagen', 'El archivo no puede superar 2MB.');
          return;
        }

        this.personajeMesService.uploadImage(optimizedFile).subscribe({
          next: (resp) => {
            this.uploading = false;
            input.value = '';

            if (!resp.success) {
              this.toast.warning('Imagen', resp.message ?? 'No fue posible cargar la imagen.');
              return;
            }

            this.formData.FotoModificada = resp.fileName;
            this.fotoPreview = resp.url || this.getImageUrl(resp.fileName);
            this.toast.success('Imagen', resp.message ?? 'Imagen cargada correctamente.');
          },
          error: (err) => {
            this.uploading = false;
            input.value = '';
            this.toast.error('Imagen', err?.error?.message ?? 'Error cargando la imagen.');
          }
        });
      })
      .catch(() => {
        this.uploading = false;
        input.value = '';
        this.toast.warning('Imagen', 'No fue posible procesar la imagen seleccionada.');
      });
  }

  private persistirFotoConsultada(fotoBase64: string, identificacion: string): void {
    const file = this.buildImageFileFromBase64(fotoBase64, identificacion);

    if (!file) {
      this.toast.warning('Imagen', 'No fue posible preparar la foto consultada. Puede cargarla manualmente.');
      return;
    }

    this.uploading = true;

    this.optimizeImageFile(file)
      .then((optimizedFile) => {
        if (optimizedFile.size > this.maxImageBytes) {
          this.uploading = false;

          if ((this.formData.identificacion ?? '').trim() !== identificacion) {
            return;
          }

          this.toast.warning('Imagen', 'No fue posible optimizar la foto consultada para guardarla automáticamente. Puede cargarla manualmente.');
          return;
        }

        this.personajeMesService.uploadImage(optimizedFile).subscribe({
          next: (resp) => {
            this.uploading = false;

            if ((this.formData.identificacion ?? '').trim() !== identificacion) {
              return;
            }

            if (!resp.success) {
              this.toast.warning('Imagen', resp.message ?? 'No fue posible guardar la foto consultada. Puede cargarla manualmente.');
              return;
            }

            if ((this.formData.FotoModificada ?? '').trim()) {
              return;
            }

            this.formData.FotoModificada = resp.fileName;
            this.fotoPreview = resp.url || this.getImageUrl(resp.fileName);
          },
          error: (err) => {
            this.uploading = false;

            if ((this.formData.identificacion ?? '').trim() !== identificacion) {
              return;
            }

            this.toast.warning('Imagen', err?.error?.message ?? 'No fue posible guardar la foto consultada. Puede cargarla manualmente.');
          }
        });
      })
      .catch(() => {
        this.uploading = false;

        if ((this.formData.identificacion ?? '').trim() !== identificacion) {
          return;
        }

        this.toast.warning('Imagen', 'No fue posible optimizar la foto consultada. Puede cargarla manualmente.');
      });
  }

  private buildImageFileFromBase64(source: string, identificacion: string): File | null {
    const raw = (source ?? '').trim();
    if (!raw) {
      return null;
    }

    let mimeType = 'image/jpeg';
    let base64Content = raw;

    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
    if (match) {
      mimeType = match[1];
      base64Content = match[2];
    }

    const normalizedBase64 = base64Content
      .trim()
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/[^A-Za-z0-9+/=]/g, '');

    if (!normalizedBase64) {
      return null;
    }

    const remainder = normalizedBase64.length % 4;
    const paddedBase64 = remainder === 0
      ? normalizedBase64
      : normalizedBase64.padEnd(normalizedBase64.length + (4 - remainder), '=');

    try {
      const binary = atob(paddedBase64);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      const safeId = (identificacion || 'personaje-mes').replace(/[^a-zA-Z0-9_-]/g, '');
      const extension = this.getImageExtension(mimeType);
      return new File([bytes], `${safeId || 'personaje-mes'}${extension}`, {
        type: mimeType,
        lastModified: Date.now()
      });
    } catch {
      return null;
    }
  }

  private async optimizeImageFile(file: File): Promise<File> {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!file || !validTypes.includes(file.type)) {
      return file;
    }

    if (file.size <= this.targetOptimizedImageBytes) {
      return file;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('No se pudo leer la imagen.'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      img.src = dataUrl;
    });

    const ratio = Math.min(1, this.maxImageDimension / Math.max(image.width, image.height));
    let width = Math.max(1, Math.round(image.width * ratio));
    let height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return file;
    }

    const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
    const baseName = (file.name || 'personaje-mes').replace(/\.[^.]+$/, '') || 'personaje-mes';
    const extension = this.getImageExtension(outputType);
    let optimizedFile = file;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, outputType, quality);
        });

        if (!blob) {
          continue;
        }

        optimizedFile = new File([blob], `${baseName}${extension}`, {
          type: outputType,
          lastModified: Date.now()
        });

        if (optimizedFile.size <= this.targetOptimizedImageBytes || optimizedFile.size <= this.maxImageBytes) {
          return optimizedFile;
        }
      }

      width = Math.max(320, Math.round(width * 0.85));
      height = Math.max(320, Math.round(height * 0.85));
    }

    return optimizedFile;
  }

  private getImageExtension(mimeType: string): string {
    switch ((mimeType ?? '').toLowerCase()) {
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '.jpg';
    }
  }

  limpiarForm(): void {
    this.formData = this.createEmptyForm();
    this.modoEdicion = false;
    this.hayFuncionario = false;
    this.idEditando = null;
    this.searchIdentificacion = '';
    this.searchingFuncionario = false;
    this.uploading = false;
    this.categoriaConsultadaId = null;
    this.categoriaConsultadaDescripcion = null;
    this.categoriaDetectada = null;
    this.categoriaNoReconocida = false;
    this.categorias = [...this.catalogoCategoriasPermitidas];
    this.fotoPreview = 'imagenes/policia.jpg';
  }

  getCategoriaDescripcion(idCategoria: number): string {
    return this.catalogoCategoriasPermitidas.find((item) => Number(item.idDominio) === Number(idCategoria))?.descripcion ?? 'Sin categoría';
  }

  getNombreCompleto(item: DtoPersonajeMes): string {
    return `${item.grado ?? ''} ${item.nombres ?? ''} ${item.apellidos ?? ''}`.replace(/\s+/g, ' ').trim();
  }

  getImageUrl(value: string | null | undefined): string {
    const raw = (value ?? '').trim();
    if (!raw) {
      return 'imagenes/policia.jpg';
    }

    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('/api/') ||
      raw.startsWith('data:image/')
    ) {
      return raw;
    }

    const fileName = raw.split('/').filter(Boolean).pop() ?? '';
    return fileName ? `/api/PersonajeMesUpload/Imagen/${encodeURIComponent(fileName)}` : 'imagenes/policia.jpg';
  }

  getFotoUrl(item: DtoPersonajeMes): string {
    return this.getImageUrl(item.fotoModificada);
  }

  getMesValue(item: Partial<DtoPersonajeMes> | null | undefined): number {
    return Number(item?.mes ?? item?.Mes ?? 0);
  }

  getAnioValue(item: Partial<DtoPersonajeMes> | null | undefined): number {
    return Number(item?.anio ?? item?.Anio ?? 0);
  }

  getMesDescripcion(mes: number | null | undefined): string {
    return this.meses.find((item) => item.value === Number(mes))?.label ?? 'Sin mes';
  }
}
