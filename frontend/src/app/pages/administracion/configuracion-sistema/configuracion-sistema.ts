import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { VideoUnidadInfo, VideoUnidadService } from '../../../core/services/administracion/video-unidad.service';
import { LoginVisualItem, LoginVisualService } from '../../../core/services/administracion/login-visual.service';
import { BrandingService } from '../../../core/services/administracion/branding.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-configuracion-sistema',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './configuracion-sistema.html',
  styleUrls: ['./configuracion-sistema.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfiguracionSistemaComponent implements OnInit {
  private readonly videoService        = inject(VideoUnidadService);
  private readonly loginVisualService  = inject(LoginVisualService);
  private readonly brandingService     = inject(BrandingService);
  private readonly toast               = inject(ToastService);
  private readonly fb                  = inject(FormBuilder);

  readonly videoPanelMinimized    = signal(false);
  readonly loginPanelMinimized    = signal(false);
  readonly brandingPanelMinimized = signal(false);

  readonly loading    = signal(false);
  readonly uploading  = signal(false);
  readonly info        = signal<VideoUnidadInfo | null>(null);
  readonly previewUrl  = signal('');
  readonly selectedVideoFile        = signal<File | null>(null);
  readonly selectedVideoPreviewUrl  = signal('');

  readonly videoForm = this.fb.nonNullable.group({
    videoDescripcion:   ['', [Validators.required]],
    videoObservaciones: ['']
  });

  readonly loginLoading  = signal(false);
  readonly loginSaving   = signal(false);
  readonly loginUploading = signal(false);
  readonly loginIntervalMs = signal(6000);
  readonly loginItems     = signal<LoginVisualItem[]>([]);

  readonly brandingLoading          = signal(false);
  readonly brandingSaving           = signal(false);
  readonly brandingUploading        = signal(false);
  readonly brandingUploadingFavicon = signal(false);
  readonly brandingLogoFileName    = signal<string | null>(null);
  readonly brandingLogoUrl         = signal<string | null>(null);
  readonly brandingFaviconFileName = signal<string | null>(null);
  readonly brandingFaviconUrl      = signal<string | null>(null);

  readonly brandingForm = this.fb.nonNullable.group({
    sistema:        ['SECAD', [Validators.required, Validators.maxLength(10)]],
    nombreSistema:  ['SECAD', [Validators.required, Validators.maxLength(50)]]
  });

  ngOnInit(): void {
    this.loadCurrent();
    this.loadLoginVisualConfig();
    this.loadBrandingConfig();
  }

  togglePanel(panel: 'video' | 'login' | 'branding'): void {
    if (panel === 'video') {
      this.videoPanelMinimized.update(v => !v);
      return;
    }
    if (panel === 'login') {
      this.loginPanelMinimized.update(v => !v);
      return;
    }
    this.brandingPanelMinimized.update(v => !v);
  }

  loadCurrent(): void {
    this.loading.set(true);
    this.videoService.getCurrent().subscribe({
      next: (info) => {
        this.info.set(info);
        this.previewUrl.set(info?.hasVideo ? info.url : '');
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.info.set(null);
        this.previewUrl.set('');
        this.toast.error('Configuracion sistema', err?.error?.message ?? 'No fue posible consultar el video actual.');
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }

    const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowed.includes(file.type)) {
      this.toast.warning('Configuracion sistema', 'Formato inválido. Use MP4, WEBM, OGG o MOV.');
      input.value = '';
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      this.toast.warning('Configuracion sistema', 'El archivo excede 100MB.');
      input.value = '';
      return;
    }

    this.selectedVideoFile.set(file);
    this.selectedVideoPreviewUrl.set(URL.createObjectURL(file));
  }

  saveVideo(): void {
    const file = this.selectedVideoFile();
    if (!file) {
      this.toast.warning('Configuracion sistema', 'Seleccione un archivo de video.');
      return;
    }

    const v = this.videoForm.getRawValue();
    const descripcion = v.videoDescripcion.trim();
    if (!descripcion) {
      this.toast.warning('Configuracion sistema', 'La descripción del video es obligatoria.');
      return;
    }

    this.uploading.set(true);
    this.videoService.upload(
      file,
      descripcion,
      v.videoObservaciones.trim() || undefined
    ).subscribe({
      next: (resp) => {
        this.uploading.set(false);
        if (!resp?.success) {
          this.toast.warning('Configuracion sistema', resp?.message || 'No fue posible cargar el video.');
          return;
        }
        this.toast.success('Configuracion sistema', resp.message || 'Video cargado correctamente.');
        this.selectedVideoFile.set(null);
        this.selectedVideoPreviewUrl.set('');
        this.videoForm.reset({ videoDescripcion: '', videoObservaciones: '' });
        this.loadCurrent();
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error('Configuracion sistema', err?.error?.detail ?? err?.error?.message ?? 'Error cargando video.');
      }
    });
  }

  loadLoginVisualConfig(): void {
    this.loginLoading.set(true);
    this.loginVisualService.getAdminConfig().subscribe({
      next: (config) => {
        this.loginIntervalMs.set(Number(config?.intervalMs ?? 6000));
        this.loginItems.set((config?.items ?? [])
          .map((x, idx) => ({
            file: x.file,
            active: x.active ?? true,
            order: Number(x.order ?? idx + 1),
            title: x.title ?? '',
            subtitle: x.subtitle ?? '',
            url: x.url ?? ''
          }))
          .sort((a, b) => a.order - b.order));
        this.loginLoading.set(false);
      },
      error: (err) => {
        this.loginLoading.set(false);
        this.loginItems.set([]);
        this.toast.error('Visual Login', err?.error?.message ?? 'No fue posible cargar la configuración.');
      }
    });
  }

  onLoginImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toast.warning('Visual Login', 'Formato inválido. Use JPG, PNG o WEBP.');
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.toast.warning('Visual Login', 'La imagen excede 10MB.');
      input.value = '';
      return;
    }

    this.loginUploading.set(true);
    this.loginVisualService.upload(file).subscribe({
      next: (resp) => {
        this.loginUploading.set(false);
        if (!resp?.success || !resp?.fileName) {
          this.toast.warning('Visual Login', resp?.message || 'No fue posible cargar la imagen.');
          return;
        }

        const items = this.loginItems();
        const maxOrder = items.length > 0
          ? Math.max(...items.map((x) => Number(x.order || 0)))
          : 0;

        const nuevo: LoginVisualItem = {
          file: resp.fileName,
          active: true,
          order: maxOrder + 1,
          title: '',
          subtitle: '',
          url: resp.url
        };

        this.loginItems.set([...items, nuevo].sort((a, b) => a.order - b.order));
        this.toast.success('Visual Login', resp.message || 'Imagen cargada correctamente.');
      },
      error: (err) => {
        this.loginUploading.set(false);
        this.toast.error('Visual Login', err?.error?.detail ?? err?.error?.message ?? 'Error cargando imagen.');
      }
    });
  }

  saveLoginConfig(): void {
    this.loginSaving.set(true);

    const payload = {
      intervalMs: Number(this.loginIntervalMs() || 6000),
      items: this.loginItems()
        .map((x) => ({
          file: (x.file ?? '').trim(),
          active: !!x.active,
          order: Number(x.order || 0),
          title: (x.title ?? '').trim() || null,
          subtitle: (x.subtitle ?? '').trim() || null
        }))
        .filter((x) => !!x.file)
    };

    this.loginVisualService.saveConfig(payload).subscribe({
      next: (resp) => {
        this.loginSaving.set(false);
        if (!resp?.success) {
          this.toast.warning('Visual Login', resp?.message || 'No fue posible guardar la configuración.');
          return;
        }
        this.toast.success('Visual Login', resp.message || 'Configuración guardada correctamente.');
        this.loadLoginVisualConfig();
      },
      error: (err) => {
        this.loginSaving.set(false);
        this.toast.error('Visual Login', err?.error?.detail ?? err?.error?.message ?? 'Error guardando configuración.');
      }
    });
  }

  deleteLoginImage(item: LoginVisualItem): void {
    if (!item?.file) {
      return;
    }
    this.loginVisualService.delete(item.file).subscribe({
      next: (resp) => {
        if (!resp?.success) {
          this.toast.warning('Visual Login', resp?.message || 'No fue posible eliminar la imagen.');
          return;
        }
        this.toast.success('Visual Login', resp.message || 'Imagen eliminada.');
        this.loginItems.update(items => items.filter((x) => x.file !== item.file));
      },
      error: (err) => {
        this.toast.error('Visual Login', err?.error?.detail ?? err?.error?.message ?? 'Error eliminando imagen.');
      }
    });
  }

  loadBrandingConfig(): void {
    this.brandingLoading.set(true);
    this.brandingService.getAdminConfig().subscribe({
      next: (cfg) => {
        this.brandingForm.reset({
          sistema: (cfg?.sistema ?? 'SECAD').trim() || 'SECAD',
          nombreSistema: (cfg?.nombreSistema ?? cfg?.systemName ?? 'SECAD').trim() || 'SECAD'
        });
        this.brandingLogoFileName.set(cfg?.logoFileName ?? null);
        this.brandingLogoUrl.set(cfg?.logoUrl ?? null);
        this.brandingFaviconFileName.set(cfg?.faviconFileName ?? null);
        this.brandingFaviconUrl.set(cfg?.faviconUrl ?? null);
        this.brandingLoading.set(false);
      },
      error: (err) => {
        this.brandingLoading.set(false);
        this.toast.error('Marca del sistema', err?.error?.message ?? 'No fue posible cargar la configuración de marca.');
      }
    });
  }

  onBrandingLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      this.toast.warning('Marca del sistema', 'Formato inválido. Use JPG, PNG, WEBP o SVG.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.toast.warning('Marca del sistema', 'El logo excede 5MB.');
      input.value = '';
      return;
    }

    this.brandingUploading.set(true);
    this.brandingService.uploadLogo(file).subscribe({
      next: (resp) => {
        this.brandingUploading.set(false);
        if (!resp?.success) {
          this.toast.warning('Marca del sistema', resp?.message || 'No fue posible cargar el logo.');
          return;
        }
        this.brandingLogoFileName.set(resp.fileName);
        this.brandingLogoUrl.set(resp.logoUrl);
        this.toast.success('Marca del sistema', resp.message || 'Logo cargado correctamente.');
      },
      error: (err) => {
        this.brandingUploading.set(false);
        this.toast.error('Marca del sistema', err?.error?.detail ?? err?.error?.message ?? 'Error cargando logo.');
      }
    });
  }

  onBrandingFaviconSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }

    const allowed = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toast.warning('Marca del sistema', 'Formato inválido. Use ICO, PNG, WEBP o SVG.');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.toast.warning('Marca del sistema', 'El favicon excede 2MB.');
      input.value = '';
      return;
    }

    this.brandingUploadingFavicon.set(true);
    this.brandingService.uploadFavicon(file).subscribe({
      next: (resp) => {
        this.brandingUploadingFavicon.set(false);
        if (!resp?.success) {
          this.toast.warning('Marca del sistema', resp?.message || 'No fue posible cargar el favicon.');
          return;
        }
        this.brandingFaviconFileName.set(resp.fileName);
        this.brandingFaviconUrl.set(resp.faviconUrl ?? null);
        this.toast.success('Marca del sistema', resp.message || 'Favicon cargado correctamente.');
      },
      error: (err) => {
        this.brandingUploadingFavicon.set(false);
        this.toast.error('Marca del sistema', err?.error?.detail ?? err?.error?.message ?? 'Error cargando favicon.');
      }
    });
  }

  saveBrandingConfig(): void {
    if (this.brandingForm.invalid) {
      this.brandingForm.markAllAsTouched();
      const v = this.brandingForm.getRawValue();
      if (!v.sistema) {
        this.toast.warning('Marca del sistema', 'El campo Sistema es obligatorio.');
      } else if (v.sistema.length > 10) {
        this.toast.warning('Marca del sistema', 'El campo Sistema solo permite hasta 10 caracteres.');
      } else if (!v.nombreSistema) {
        this.toast.warning('Marca del sistema', 'El campo Nombre del sistema es obligatorio.');
      } else if (v.nombreSistema.length > 50) {
        this.toast.warning('Marca del sistema', 'Nombre del sistema solo permite hasta 50 caracteres.');
      }
      return;
    }

    const v = this.brandingForm.getRawValue();
    this.brandingSaving.set(true);
    this.brandingService.saveConfig({
      sistema: v.sistema.trim(),
      nombreSistema: v.nombreSistema.trim(),
      logoFileName: this.brandingLogoFileName(),
      faviconFileName: this.brandingFaviconFileName()
    }).subscribe({
      next: (resp) => {
        this.brandingSaving.set(false);
        if (!resp?.success) {
          this.toast.warning('Marca del sistema', resp?.message || 'No fue posible guardar la configuración.');
          return;
        }
        this.toast.success('Marca del sistema', resp.message || 'Configuración guardada correctamente.');
        this.loadBrandingConfig();
      },
      error: (err) => {
        this.brandingSaving.set(false);
        this.toast.error('Marca del sistema', err?.error?.detail ?? err?.error?.message ?? 'Error guardando configuración.');
      }
    });
  }
}
