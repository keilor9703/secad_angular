import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../core/services/toast.service';
import {
  PedidoService,
  DtoPedidoListItem,
  DtoPedidoDetalle,
  DtoPedidoRequest,
  DtoCerrarRapidoRequest,
  DtoAnotacionRequest
} from '../../../core/services/operacion/pedido.service';

type PanelMode = 'list' | 'form' | 'detail';

@Component({
  selector: 'app-pedido',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pedido.html',
  styleUrls: ['./pedido.scss']
})
export class PedidoComponent implements OnInit, OnDestroy {

  // ─── UI state ──────────────────────────────────────────────────────────────
  visible   = true;
  minimized = false;
  panelMode: PanelMode = 'list';
  loading   = false;
  saving    = false;

  // ─── Filters ───────────────────────────────────────────────────────────────
  filtroEstado    = 'A';
  filtroSitio: number | undefined = undefined;

  // ─── Data ──────────────────────────────────────────────────────────────────
  listaPedidos:  DtoPedidoListItem[] = [];
  selectedId:    number | null = null;
  detalle:       DtoPedidoDetalle | null = null;
  editingId:     number | null = null;

  // ─── New incident form ─────────────────────────────────────────────────────
  form: DtoPedidoRequest = this.emptyForm();

  // ─── Quick-close form ──────────────────────────────────────────────────────
  showCerrarModal = false;
  cerrarForm: DtoCerrarRapidoRequest = { comentario: '', codiPedido: '', enviar: 'N' };
  cerrarTargetId: number | null = null;

  // ─── Annotation form ───────────────────────────────────────────────────────
  anotacionForm: DtoAnotacionRequest = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
  savingAnotacion = false;

  private destroy$ = new Subject<void>();

  constructor(
    private pedidoService: PedidoService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargarLista();
    // Auto-refresh activos every 30 s
    interval(30_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.filtroEstado === 'A') this.cargarLista();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  cargarLista(): void {
    this.loading = true;
    this.pedidoService.getList(this.filtroEstado || undefined, this.filtroSitio).subscribe({
      next: (data) => {
        this.listaPedidos = (data ?? []).map(p => this.normalizarListItem(p as any));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error', 'No se pudieron cargar los casos');
      }
    });
  }

  seleccionarCaso(item: DtoPedidoListItem): void {
    this.selectedId = item.id;
    this.panelMode = 'detail';
    this.loading = true;

    this.pedidoService.getById(item.id).subscribe({
      next: (data) => {
        this.detalle = this.normalizarDetalle(data as any);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error', 'No se pudo cargar el detalle del caso');
      }
    });
  }

  // ─── Create / Edit ─────────────────────────────────────────────────────────

  nuevoCaso(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.panelMode = 'form';
  }

  editarCaso(item: DtoPedidoListItem): void {
    this.loading = true;
    this.pedidoService.getById(item.id).subscribe({
      next: (data) => {
        const d = this.normalizarDetalle(data as any);
        this.editingId = d.id;
        this.form = {
          sitioGraba:          d.sitioGraba,
          numeLlamada:         d.numeLlamada ?? 0,
          horaCaso:            d.horaCaso ?? '',
          numeTelefono:        d.numeTelefono ?? 0,
          propTelefono:        d.propTelefono,
          nombLlamante:        d.nombLlamante,
          barrio:              d.barrio,
          ciudad:              d.ciudad,
          direLlamante:        d.direLlamante,
          direCaso:            d.direCaso,
          latitudCaso:         d.latitudCaso,
          longitudCaso:        d.longitudCaso,
          cordx:               d.cordx,
          cordy:               d.cordy,
          tiposhape:           d.tiposhape,
          radio:               d.radio,
          comentario:          d.comentario,
          codiPedido:          d.codiPedido,
          codiPedido2:         d.codiPedido2,
          tipoPedido:          d.tipoPedido,
          caliPedido:          d.caliPedido,
          importancia:         d.importancia,
          prioridad:           d.prioridad,
          dispTelefonico:      d.dispTelefonico,
          celdaMarcacion:      d.celdaMarcacion,
          canalesSeleccionados: d.canales
            ? d.canales.split(',').map(Number).filter(n => !isNaN(n))
            : [],
          canalFuerza:         d.canalFuerza,
          enviar:              d.enviar,
          estado:              d.estado,
          pedidoPadreSitio:    d.pedidoPadreSitio,
          pedidoPadreNum:      d.pedidoPadreNum
        };
        this.loading = false;
        this.panelMode = 'form';
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error', 'No se pudo cargar el caso para editar');
      }
    });
  }

  guardar(): void {
    if (!this.form.direCaso?.trim() && !this.form.codiPedido?.trim()) {
      this.toast.warning('Guardar', 'Ingrese al menos la direccion del caso o el codigo de pedido');
      return;
    }
    this.saving = true;

    if (this.editingId) {
      this.pedidoService.update(this.editingId, this.form).subscribe({
        next: (resp) => {
          this.saving = false;
          if (resp.success) {
            this.toast.success('Guardar', resp.message);
            this.cancelar();
            this.cargarLista();
          } else {
            this.toast.warning('Guardar', resp.message);
          }
        },
        error: () => { this.saving = false; this.toast.error('Guardar', 'Error al actualizar caso'); }
      });
    } else {
      this.pedidoService.create(this.form).subscribe({
        next: (resp) => {
          this.saving = false;
          if (resp.success) {
            this.toast.success('Guardar', resp.message);
            this.cancelar();
            this.cargarLista();
          } else {
            this.toast.warning('Guardar', resp.message);
          }
        },
        error: () => { this.saving = false; this.toast.error('Guardar', 'Error al crear caso'); }
      });
    }
  }

  cancelar(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.panelMode = 'list';
  }

  // ─── Quick close ───────────────────────────────────────────────────────────

  abrirCerrarModal(id: number): void {
    this.cerrarTargetId = id;
    this.cerrarForm = { comentario: '', codiPedido: '', enviar: 'N' };
    this.showCerrarModal = true;
  }

  confirmarCerrar(): void {
    if (!this.cerrarTargetId) return;
    this.saving = true;
    this.pedidoService.cerrarRapido(this.cerrarTargetId, this.cerrarForm).subscribe({
      next: (resp) => {
        this.saving = false;
        this.showCerrarModal = false;
        if (resp.success) {
          this.toast.success('Cerrar', resp.message);
          if (this.detalle?.id === this.cerrarTargetId) {
            this.detalle.estado = 'C';
          }
          this.cargarLista();
        } else {
          this.toast.warning('Cerrar', resp.message);
        }
      },
      error: () => { this.saving = false; this.toast.error('Cerrar', 'Error al cerrar el caso'); }
    });
  }

  cancelarCerrar(): void {
    this.showCerrarModal = false;
    this.cerrarTargetId = null;
  }

  // ─── Annotations ───────────────────────────────────────────────────────────

  guardarAnotacion(): void {
    if (!this.detalle || !this.anotacionForm.anotacion?.trim()) {
      this.toast.warning('Anotacion', 'El texto de la anotacion es requerido');
      return;
    }
    this.savingAnotacion = true;
    this.pedidoService.createAnotacion(this.detalle.id, this.anotacionForm).subscribe({
      next: (resp) => {
        this.savingAnotacion = false;
        if (resp.success) {
          this.toast.success('Anotacion', resp.message);
          this.anotacionForm = { titulo: '', anotacion: '', tipoAnotacion: 'GENERAL' };
          // Reload annotations
          this.pedidoService.getAnotaciones(this.detalle!.id).subscribe({
            next: (data) => { if (this.detalle) this.detalle.anotaciones = data; }
          });
        } else {
          this.toast.warning('Anotacion', resp.message);
        }
      },
      error: () => { this.savingAnotacion = false; this.toast.error('Anotacion', 'Error al guardar la anotacion'); }
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'A': return 'Activo';
      case 'C': return 'Cerrado';
      case 'P': return 'Pendiente';
      default:  return estado;
    }
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'A': return 'badge-activo';
      case 'C': return 'badge-cerrado';
      case 'P': return 'badge-pendiente';
      default:  return 'badge-default';
    }
  }

  toggleMinimize(): void { this.minimized = !this.minimized; }
  closePanel(): void { this.visible = false; }

  private emptyForm(): DtoPedidoRequest {
    return {
      sitioGraba: 0,
      numeLlamada: 0,
      horaCaso: new Date().toISOString(),
      numeTelefono: 0,
      propTelefono: '',
      nombLlamante: '',
      barrio: '',
      ciudad: '',
      direLlamante: '',
      direCaso: '',
      latitudCaso: '',
      longitudCaso: '',
      cordx: '',
      cordy: '',
      tiposhape: '',
      radio: 0,
      comentario: '',
      codiPedido: '',
      codiPedido2: '',
      tipoPedido: '',
      caliPedido: '',
      importancia: '',
      prioridad: '',
      dispTelefonico: '',
      celdaMarcacion: '',
      canalesSeleccionados: [],
      canalFuerza: '',
      enviar: 'N',
      estado: 'A',
      pedidoPadreSitio: null,
      pedidoPadreNum: null
    };
  }

  private normalizarListItem(item: any): DtoPedidoListItem {
    return {
      id:               Number(item?.id ?? 0),
      sitioGraba:       Number(item?.sitioGraba ?? item?.sitio_graba ?? 0),
      numeLlamada:      item?.numeLlamada ?? item?.nume_llamada ?? null,
      horaCaso:         item?.horaCaso ?? item?.hora_caso ?? null,
      numeTelefono:     item?.numeTelefono ?? item?.nume_telefono ?? null,
      direCaso:         String(item?.direCaso ?? item?.dire_caso ?? ''),
      estado:           String(item?.estado ?? ''),
      enviar:           String(item?.enviar ?? 'N'),
      codiPedido:       String(item?.codiPedido ?? item?.codi_pedido ?? ''),
      codiPedido2:      String(item?.codiPedido2 ?? item?.codi_pedido2 ?? ''),
      comentario:       String(item?.comentario ?? ''),
      usernameCreacion: String(item?.usernameCreacion ?? item?.username_creacion ?? ''),
      fechaCreacion:    item?.fechaCreacion ?? item?.fecha_creacion ?? null
    };
  }

  private normalizarDetalle(item: any): DtoPedidoDetalle {
    return {
      ...this.normalizarListItem(item),
      propTelefono:    String(item?.propTelefono ?? item?.prop_telefono ?? ''),
      nombLlamante:    String(item?.nombLlamante ?? item?.nomb_llamante ?? ''),
      barrio:          String(item?.barrio ?? ''),
      ciudad:          String(item?.ciudad ?? ''),
      direLlamante:    String(item?.direLlamante ?? item?.dire_llamante ?? ''),
      latitudCaso:     String(item?.latitudCaso ?? item?.latitud_caso ?? ''),
      longitudCaso:    String(item?.longitudCaso ?? item?.longitud_caso ?? ''),
      cordx:           String(item?.cordx ?? ''),
      cordy:           String(item?.cordy ?? ''),
      tiposhape:       String(item?.tiposhape ?? ''),
      radio:           Number(item?.radio ?? 0),
      tipoPedido:      String(item?.tipoPedido ?? item?.tipo_pedido ?? ''),
      caliPedido:      String(item?.caliPedido ?? item?.cali_pedido ?? ''),
      importancia:     String(item?.importancia ?? ''),
      prioridad:       String(item?.prioridad ?? ''),
      dispTelefonico:  String(item?.dispTelefonico ?? item?.disp_telefonico ?? ''),
      celdaMarcacion:  String(item?.celdaMarcacion ?? item?.celda_marcacion ?? ''),
      canales:         String(item?.canales ?? ''),
      canalFuerza:     String(item?.canalFuerza ?? item?.canal_fuerza ?? ''),
      pedidoPadreSitio: item?.pedidoPadreSitio ?? item?.pedido_padre_sitio ?? null,
      pedidoPadreNum:   item?.pedidoPadreNum ?? item?.pedido_padre_num ?? null,
      anotaciones:     (item?.anotaciones ?? []).map((a: any) => ({
        id:               Number(a?.id ?? 0),
        idPedido:         Number(a?.idPedido ?? a?.id_pedido ?? 0),
        titulo:           String(a?.titulo ?? ''),
        anotacion:        String(a?.anotacion ?? ''),
        tipoAnotacion:    String(a?.tipoAnotacion ?? a?.tipo_anotacion ?? ''),
        usuarioCreacion:  a?.usuarioCreacion ?? a?.usuario_creacion ?? null,
        usernameCreacion: String(a?.usernameCreacion ?? a?.username_creacion ?? ''),
        fechaCreacion:    a?.fechaCreacion ?? a?.fecha_creacion ?? null,
        maquinaCreacion:  String(a?.maquinaCreacion ?? a?.maquina_creacion ?? '')
      }))
    };
  }
}
