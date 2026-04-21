import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { DominioService, DtoDominio } from '../../../core/services/administracion/dominio.service';
import {
  DtoPersonajeMes,
  DtoPersonajeMesRequest,
  PersonajeMesService,
  sortPersonajesMes
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
  private readonly todosLosMeses = [
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

  get mesesDisponibles(): { value: number; label: string }[] {
    const mesVigente = new Date().getMonth() + 1;
    const mesAnterior = mesVigente === 1 ? 12 : mesVigente - 1;
    return this.todosLosMeses.filter(m => m.value === mesAnterior || m.value === mesVigente);
  }

  get aniosDisponibles(): number[] {
    const currentYear = new Date().getFullYear();
    return this.formData.Mes === 1 ? [currentYear - 1, currentYear] : [currentYear];
  }

loading = false;
  saving = false;
  uploading = false;
  searchingFuncionario = false;
  modoEdicion = false;
  hayFuncionario = false;
  idEditando: number | null = null;
  mostrarModalPersonajeMes = false;

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
    this.cargarCategoriasYPersonajes();
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

  onMesChange(nuevoMes: number): void {
    const currentYear = new Date().getFullYear();
    if (nuevoMes !== 1 && this.formData.Anio === currentYear - 1) {
      this.formData.Anio = currentYear;
    }
  }


cargarPersonajes(): void {
    this.loading = true;
    this.personajeMesService.getAll().subscribe({
      next: (data) => {
        this.personajes = sortPersonajesMes(data ?? [], this.categorias);
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
        this.categorias = (data ?? [])
          .filter((item) => Number(item.idPadre) === 1 && Number(item.vigente) === 1)
          .sort((a, b) => (a.descripcion ?? '').localeCompare(b.descripcion ?? ''));
        if (this.personajes.length > 0) {
          this.personajes = sortPersonajesMes(this.personajes, this.categorias);
        }
      },
      error: (err) => {
        this.toast.error('Categorías', err?.error?.message ?? 'No se pudieron cargar las categorías.');
      }
    });
  }

  private cargarCategoriasYPersonajes(): void {
    this.dominioService.getAll().subscribe({
      next: (data) => {
        this.categorias = (data ?? [])
          .filter((item) => Number(item.idPadre) === 1 && Number(item.vigente) === 1)
          .sort((a, b) => (a.descripcion ?? '').localeCompare(b.descripcion ?? ''));
        this.cargarPersonajes();
      },
      error: (err) => {
        this.toast.error('Categorías', err?.error?.message ?? 'No se pudieron cargar las categorías.');
        this.cargarPersonajes();
      }
    });
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

    this.usuarioAdminService.consultarFuncionarioPersonajeMes(doc).subscribe({
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
        const grado = (func.nombreGrado ?? func.cargo ?? '').trim();
        const categoriaResuelta = this.resolverCategoriaPorFuncionario(grado, func.categoriaDescripcion);

        this.formData = {
          identificacion,
          nombres: (func.nombres ?? '').trim(),
          apellidos: (func.apellidos ?? '').trim(),
          grado,
          cargo: (func.cargo ?? '').trim(),
          unidad: (func.dependencia ?? '').trim(),
          IdCategoria: Number(categoriaResuelta?.idDominio ?? 0),
          NumeroActa: (this.formData.NumeroActa ?? '').trim(),
          FotoModificada: '',
          Mes: Number(this.formData.Mes ?? 0),
          Anio: Number(this.formData.Anio ?? 0),
        };

        this.fotoPreview = this.getImageUrl(fotoConsultada);
        this.hayFuncionario = true;
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
    const idCategoria = Number(this.formData.IdCategoria ?? 0);
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

    if (!idCategoria) {
      this.toast.warning('Personaje del mes', 'Debe seleccionar una categoría.');
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
    this.fotoPreview = 'imagenes/policia.jpg';
  }

  private resolverCategoriaPorFuncionario(grado: string | null | undefined, categoriaDescripcion: string | null | undefined): DtoDominio | null {
    const gradoNorm = this.normalizarTexto(grado);
    const categNorm = this.normalizarTexto(categoriaDescripcion);

    // Caso especial: grado PATRULLERO con categoría NIVEL EJECUTIVO → PATRULLEROS
    if (gradoNorm.includes('patrullero') && categNorm.includes('nivel ejecutivo')) {
      return this.buscarCategoriaPorKeyword('patrullero');
    }
    if (categNorm.includes('no uniformado')) return this.buscarCategoriaPorKeyword('no uniformado');
    if (categNorm.includes('nivel ejecutivo')) return this.buscarCategoriaPorKeyword('nivel ejecutivo');
    if (categNorm.includes('suboficial')) return this.buscarCategoriaPorKeyword('suboficial');
    if (categNorm.includes('oficial') && !categNorm.includes('suboficial')) return this.buscarCategoriaPorKeyword('oficial');
    if (categNorm.includes('agente') || categNorm.includes('categoria agentes') || categNorm.includes('categoría agentes')) return this.buscarCategoriaPorKeyword('agente');
    if (categNorm.includes('patrullero')) return this.buscarCategoriaPorKeyword('patrullero');
    if (categNorm.includes('alumno')) return this.buscarCategoriaPorKeyword('estudiante');
    if (categNorm.includes('auxiliar')) return this.buscarCategoriaPorKeyword('auxiliar');

    return null;
  }

  private buscarCategoriaPorKeyword(keyword: string): DtoDominio | null {
    return this.categorias.find((item) => this.normalizarTexto(item.descripcion).includes(keyword)) ?? null;
  }

  private normalizarTexto(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  get categoriaDescripcion(): string {
    return this.categorias.find((item) => Number(item.idDominio) === Number(this.formData.IdCategoria))?.descripcion ?? '';
  }

  getCategoriaDescripcion(idCategoria: number): string {
    return this.categorias.find((item) => Number(item.idDominio) === Number(idCategoria))?.descripcion ?? 'Sin categoría';
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
    return this.todosLosMeses.find((item) => item.value === Number(mes))?.label ?? 'Sin mes';
  }

  abrirmodalpersonajemes(): void {
    this.mostrarModalPersonajeMes = true;
  }

  cerrarModalPersonajeMes(): void {
    this.mostrarModalPersonajeMes = false;
    this.limpiarForm();
  }
}
