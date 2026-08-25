import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfigSmsService, DtoConfigSms, ProveedorSms } from '../../../core/services/administracion/config-sms.service';
import { ToastService } from '../../../core/services/toast.service';

interface ProveedorInfo {
  value: ProveedorSms;
  label: string;
  baseUrlPorDefecto: string;
  usaSender: boolean;
}

const PROVEEDORES: ProveedorInfo[] = [
  { value: 'INFOBIP',            label: 'Infobip',            baseUrlPorDefecto: '',                                usaSender: true },
  { value: 'INALAMBRIA_EXPRESS', label: 'Inalambria Express', baseUrlPorDefecto: 'https://api.inalambria.express/v1', usaSender: false }
];

@Component({
  selector:    'app-config-sms',
  standalone:  true,
  imports:     [CommonModule, ReactiveFormsModule],
  templateUrl: './config-sms.html',
  styleUrls:   ['./config-sms.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfigSmsComponent implements OnInit {
  private readonly svc   = inject(ConfigSmsService);
  private readonly toast = inject(ToastService);
  private readonly fb    = inject(FormBuilder);

  readonly proveedores = PROVEEDORES;

  readonly loading = signal(false);
  readonly saving  = signal(false);
  readonly probando = signal(false);

  readonly config = signal<DtoConfigSms | null>(null);
  readonly telefonoPrueba = signal('');

  readonly form = this.fb.nonNullable.group({
    proveedor: ['INFOBIP' as ProveedorSms, [Validators.required]],
    baseUrl:   [''],
    apiKey:    [''],
    sender:    ['']
  });

  readonly proveedorSeleccionado = computed(() =>
    this.proveedores.find(p => p.value === this.form.getRawValue().proveedor) ?? this.proveedores[0]
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.get().subscribe({
      next: (r) => {
        this.config.set(r.data);
        this.form.reset({
          proveedor: r.data.proveedor,
          baseUrl:   r.data.baseUrl ?? '',
          apiKey:    '',
          sender:    r.data.sender ?? ''
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Proveedor SMS', 'No se pudo cargar la configuración.');
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.svc.actualizar({
      proveedor: v.proveedor,
      baseUrl:   v.baseUrl?.trim() || null,
      apiKey:    v.apiKey?.trim() || null,
      sender:    v.sender?.trim() || null
    }).subscribe({
      next: (resp) => {
        this.saving.set(false);
        if (!resp.success) {
          this.toast.warning('Proveedor SMS', resp.message);
          return;
        }
        this.toast.success('Proveedor SMS', resp.message);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Proveedor SMS', err?.error?.message ?? 'Error al guardar.');
      }
    });
  }

  probarEnvio(): void {
    const numero = this.telefonoPrueba().trim();
    if (!numero) {
      this.toast.warning('Proveedor SMS', 'Ingrese un número de teléfono para la prueba.');
      return;
    }

    this.probando.set(true);
    this.svc.probar(numero).subscribe({
      next: (resp) => {
        this.probando.set(false);
        if (resp.success) this.toast.success('Proveedor SMS', resp.message);
        else this.toast.warning('Proveedor SMS', resp.message);
      },
      error: (err) => {
        this.probando.set(false);
        this.toast.error('Proveedor SMS', err?.error?.message ?? 'Error al enviar el SMS de prueba.');
      }
    });
  }
}
