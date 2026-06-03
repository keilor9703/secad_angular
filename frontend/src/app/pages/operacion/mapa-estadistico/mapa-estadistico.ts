import {
  Component, OnInit, OnDestroy, AfterViewInit,
  NgZone, ChangeDetectorRef, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  MapaEstadisticoService,
  DtoFiltroEstadistico,
  DtoPuntoEstadistico,
  DtoMetricasEstadisticas,
  DtoAgrupacion
} from '../../../core/services/operacion/mapa-estadistico.service';

declare const L:       any;
declare const Chart:   any;

type CapaMapa = 'puntos' | 'calor' | 'clusters';

@Component({
  selector: 'app-mapa-estadistico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-estadistico.html',
  styleUrls: ['./mapa-estadistico.scss']
})
export class MapaEstadisticoComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── Filtros ───────────────────────────────────────────────────────────────
  filtro: DtoFiltroEstadistico = {
    desde:            this.defaultDesde(),
    hasta:            this.defaultHasta(),
    codiPedido:       '',
    prioridad:        '',
    ciudad:           '',
    barrio:           '',
    canalCodigo:      0,
    soloCerrados:     true,
    turnoVigilancia:  0
  };

  // Turnos de vigilancia — mismas franjas que el módulo de Reportes
  readonly turnos = [
    { value: 0, label: 'Todos los turnos'      },
    { value: 1, label: 'Segundo turno (06-13h)' },
    { value: 2, label: 'Tercer turno  (14-21h)' },
    { value: 3, label: 'Cuarto turno  (22-05h)' },
  ];

  // ── Estado ────────────────────────────────────────────────────────────────
  cargando       = false;
  errorCarga     = false;
  consultado     = false;
  cargandoListas = false;

  // ── Listas desplegables ───────────────────────────────────────────────────
  ciudades: string[] = [];
  barrios:  string[] = [];

  // ── Claims del usuario ────────────────────────────────────────────────────
  esSuperAdmin   = false;
  ciudadUsuario  = '';   // ciudad auto-detectada para no-superadmin

  // ── Datos ─────────────────────────────────────────────────────────────────
  puntos:   DtoPuntoEstadistico[]    = [];
  metricas: DtoMetricasEstadisticas  = this.metricasVacias();

  // ── Mapa ──────────────────────────────────────────────────────────────────
  capaActiva: CapaMapa = 'calor';
  private map:           any = null;
  private heatLayer:     any = null;
  private clusterGroup:  any = null;
  private puntosGroup:   any = null;
  private municipioLayer:any = null;
  private cuadrantesLayer:any= null;
  private readonly ARCGIS_BASE =
    'https://services3.arcgis.com/8cBoM4o6pnuUb1z1/ArcGIS/rest/services/SIDENCO_SinMalla/FeatureServer';

  // ── Gráficas Chart.js ─────────────────────────────────────────────────────
  @ViewChild('chartTipo')     chartTipoRef!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('chartHora')     chartHoraRef!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('chartDia')      chartDiaRef!:      ElementRef<HTMLCanvasElement>;
  @ViewChild('chartMes')      chartMesRef!:      ElementRef<HTMLCanvasElement>;
  @ViewChild('chartPrioridad')chartPrioRef!:     ElementRef<HTMLCanvasElement>;

  private charts: Map<string, any> = new Map();

  // ── Internos ──────────────────────────────────────────────────────────────
  private codDane  = '';
  private destroy$ = new Subject<void>();

  constructor(
    private auth:  AuthService,
    private svc:   MapaEstadisticoService,
    private toast: ToastService,
    private zone:  NgZone,
    private cdr:   ChangeDetectorRef
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    const claims      = this.auth.getJwtClaims();
    this.codDane      = claims.codDane;
    this.esSuperAdmin = claims.esSuperAdmin;

    if (!this.esSuperAdmin) {
      // Para operadores la ciudad viene del nombre del CAD o nombreCad
      this.ciudadUsuario = claims.nombreCad || '';
    }

    this.cargarListas();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
    if (this.map) { this.map.off(); this.map.remove(); this.map = null; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Listas (ciudades / barrios)
  // ══════════════════════════════════════════════════════════════════════════

  private cargarListas(): void {
    this.cargandoListas = true;

    if (this.esSuperAdmin) {
      this.svc.getCiudades()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: list => {
            this.ciudades = list;
            // Si solo hay una ciudad la preseleccionamos y cargamos sus barrios
            if (list.length === 1) {
              this.filtro.ciudad = list[0];
              this.cargarBarrios(list[0]);
            } else {
              this.cargandoListas = false;
            }
            this.cdr.detectChanges();
          },
          error: () => { this.cargandoListas = false; }
        });
    } else {
      // Operador: solo carga barrios (la ciudad está fijada por el tenant)
      this.cargarBarrios('');
    }
  }

  private cargarBarrios(ciudad: string): void {
    this.cargandoListas = true;
    this.svc.getBarrios(ciudad || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: list => {
          this.barrios        = list;
          this.cargandoListas = false;
          this.cdr.detectChanges();
        },
        error: () => { this.cargandoListas = false; }
      });
  }

  onCiudadChange(): void {
    this.filtro.barrio = '';
    this.barrios       = [];
    if (this.filtro.ciudad) {
      this.cargarBarrios(this.filtro.ciudad);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Consulta
  // ══════════════════════════════════════════════════════════════════════════

  consultar(): void {
    if (!this.filtro.desde || !this.filtro.hasta) {
      this.toast.warning('Filtros', 'Debe seleccionar un rango de fechas.');
      return;
    }
    this.cargando   = true;
    this.errorCarga = false;

    this.svc.getAnalisis(this.filtro)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.zone.run(() => {
            this.cargando   = false;
            this.consultado = true;
            this.puntos     = data.puntos   ?? [];
            this.metricas   = data.metricas ?? this.metricasVacias();
            // Fallback: si el backend no devolvió métricas pero hay puntos,
            // las calculamos en el cliente para garantizar que los gráficos funcionen.
            if (this.metricas.total === 0 && this.puntos.length > 0) {
              this.metricas = this.computeMetricasFromPuntos();
            }
            this.actualizarMapa();
            setTimeout(() => this.renderCharts(), 100);
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.zone.run(() => {
            this.cargando   = false;
            this.errorCarga = true;
            this.cdr.detectChanges();
          });
          this.toast.error('GIS Estadístico', 'Error al consultar los datos.');
        }
      });
  }

  limpiarFiltros(): void {
    this.filtro = {
      desde: this.defaultDesde(), hasta: this.defaultHasta(),
      codiPedido: '', prioridad: '', ciudad: '', barrio: '',
      canalCodigo: 0, soloCerrados: true, turnoVigilancia: 0
    };
    if (this.esSuperAdmin) this.barrios = [];
  }

  turnoLabel(v: number): string {
    return this.turnos.find(t => t.value === v)?.label ?? 'Todos';
  }

  turnoBadgeColor(v: number): string {
    return ['#64748b', '#2563eb', '#7c3aed', '#dc2626'][v] ?? '#64748b';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Exportar informe PDF
  // ══════════════════════════════════════════════════════════════════════════

  generarInforme(): void {
    // Capturar cada gráfica como imagen PNG desde su <canvas>
    const imgTipo  = this.chartTipoRef?.nativeElement?.toDataURL('image/png') ?? '';
    const imgHora  = this.chartHoraRef?.nativeElement?.toDataURL('image/png') ?? '';
    const imgDia   = this.chartDiaRef?.nativeElement?.toDataURL('image/png')  ?? '';
    const imgMes   = this.chartMesRef?.nativeElement?.toDataURL('image/png')  ?? '';
    const imgPrio  = this.chartPrioRef?.nativeElement?.toDataURL('image/png') ?? '';

    const filtrosTexto = [
      `Período: ${this.filtro.desde} → ${this.filtro.hasta}`,
      (this.filtro.turnoVigilancia ?? 0) > 0 ? `Turno: ${this.turnoLabel(this.filtro.turnoVigilancia!)}` : null,
      this.filtro.prioridad   ? `Prioridad: ${this.filtro.prioridad}` : null,
      this.filtro.codiPedido  ? `Código caso: ${this.filtro.codiPedido}` : null,
      !this.esSuperAdmin && this.ciudadUsuario ? `Ciudad: ${this.ciudadUsuario}` : null,
      this.esSuperAdmin && this.filtro.ciudad  ? `Ciudad: ${this.filtro.ciudad}` : null,
      this.filtro.barrio      ? `Barrio: ${this.filtro.barrio}` : null,
      this.filtro.soloCerrados ? 'Solo incidentes cerrados' : 'Todos los incidentes',
    ].filter(Boolean).join(' &nbsp;|&nbsp; ');

    const topCasos = this.metricas.porTipoCaso.slice(0, 10)
      .map((c, i) => `<tr>
        <td>${i + 1}</td>
        <td>${c.clave}</td>
        <td>${c.descripcion}</td>
        <td style="text-align:right;font-weight:700">${c.total.toLocaleString('es-CO')}</td>
      </tr>`).join('');

    const topCiudades = this.metricas.porCiudad.length ? `
      <div class="seccion">
        <h2>Distribución por ciudad / municipio</h2>
        <table>
          <thead><tr><th>#</th><th>Ciudad</th><th style="text-align:right">Incidentes</th></tr></thead>
          <tbody>
            ${this.metricas.porCiudad.slice(0, 8).map((c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${c.descripcion}</td>
                <td style="text-align:right;font-weight:700">${c.total.toLocaleString('es-CO')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    const ahora = new Date().toLocaleString('es-CO', {
      dateStyle: 'long', timeStyle: 'short'
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Informe GIS Estadístico Delincuencial</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #222; background: #fff; }

    /* ── Encabezado ─────────────────────────────────────── */
    .encabezado {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 3px solid #003087; padding-bottom: 10px; margin-bottom: 14px;
    }
    .encabezado-titulo h1 { font-size: 17px; color: #003087; font-weight: 900; line-height: 1.2; }
    .encabezado-titulo p  { font-size: 10px; color: #666; margin-top: 3px; }
    .encabezado-logo { text-align: right; font-size: 10px; color: #999; }
    .encabezado-logo strong { display: block; font-size: 13px; color: #003087; }

    /* ── Filtros ─────────────────────────────────────────── */
    .filtros {
      background: #f0f4ff; border: 1px solid #c0d0f0; border-radius: 5px;
      padding: 7px 12px; font-size: 10px; color: #334; margin-bottom: 14px;
    }
    .filtros strong { color: #003087; }

    /* ── KPIs ────────────────────────────────────────────── */
    .kpis { display: flex; gap: 8px; margin-bottom: 16px; }
    .kpi {
      flex: 1; border-radius: 7px; padding: 10px 8px; text-align: center;
      border: 1px solid #e0e0e0;
    }
    .kpi-valor { font-size: 26px; font-weight: 900; line-height: 1; }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #666; margin-top: 4px; }
    .kpi-total  { background: #f0f4ff; }  .kpi-total  .kpi-valor { color: #003087; }
    .kpi-flash  { background: #fff0f0; }  .kpi-flash  .kpi-valor { color: #cc0000; }
    .kpi-inmd   { background: #fff6ee; }  .kpi-inmd   .kpi-valor { color: #e67300; }
    .kpi-rut    { background: #f0f6ff; }  .kpi-rut    .kpi-valor { color: #0066cc; }
    .kpi-coord  { background: #f0fff4; }  .kpi-coord  .kpi-valor { color: #00a36c; }

    /* ── Secciones ───────────────────────────────────────── */
    .seccion { margin-bottom: 18px; break-inside: avoid; }
    .seccion h2 {
      font-size: 11px; font-weight: 800; text-transform: uppercase;
      letter-spacing: .06em; color: #003087; border-left: 3px solid #003087;
      padding-left: 7px; margin-bottom: 8px;
    }

    /* ── Gráficas ────────────────────────────────────────── */
    .graficas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grafica-card  {
      border: 1px solid #e8e8e8; border-radius: 6px; padding: 10px;
      break-inside: avoid;
    }
    .grafica-card h3 {
      font-size: 9px; font-weight: 800; text-transform: uppercase;
      color: #003087; margin-bottom: 6px; letter-spacing: .05em;
    }
    .grafica-card img { width: 100%; height: auto; display: block; }
    .grafica-full   { grid-column: 1 / -1; }

    /* ── Tabla ───────────────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #003087; color: #fff; }
    thead th { padding: 5px 7px; text-align: left; font-weight: 700; font-size: 9px; text-transform: uppercase; }
    tbody tr:nth-child(even) { background: #f8f9fc; }
    tbody td { padding: 4px 7px; color: #333; border-bottom: 1px solid #eee; }

    /* ── Pie de página ───────────────────────────────────── */
    .pie {
      margin-top: 20px; padding-top: 8px; border-top: 1px solid #ddd;
      font-size: 9px; color: #aaa; display: flex; justify-content: space-between;
    }

    /* ── Insights ────────────────────────────────────────── */
    .insights { display: flex; gap: 8px; margin-bottom: 16px; }
    .insight {
      flex: 1; background: #fafbff; border: 1px solid #e0e8f0;
      border-radius: 5px; padding: 8px 10px; font-size: 10px;
    }
    .insight-label { color: #888; font-size: 9px; text-transform: uppercase; margin-bottom: 3px; }
    .insight-valor { font-weight: 700; color: #003087; font-size: 12px; }
  </style>
</head>
<body>

  <!-- Encabezado -->
  <div class="encabezado">
    <div class="encabezado-titulo">
      <h1>Informe GIS Estadístico Delincuencial</h1>
      <p>Sistema de Análisis de Incidentes — SECAD OFTIC</p>
    </div>
    <div class="encabezado-logo">
      <strong>OFTIC · SECAD</strong>
      Generado: ${ahora}
    </div>
  </div>

  <!-- Filtros aplicados -->
  <div class="filtros">
    <strong>Parámetros de consulta:</strong> &nbsp; ${filtrosTexto}
  </div>

  <!-- KPIs principales -->
  <div class="kpis">
    <div class="kpi kpi-total">
      <div class="kpi-valor">${this.metricas.total.toLocaleString('es-CO')}</div>
      <div class="kpi-label">Total incidentes</div>
    </div>
    <div class="kpi kpi-flash">
      <div class="kpi-valor">${this.metricas.totalFlash.toLocaleString('es-CO')}</div>
      <div class="kpi-label">Flash</div>
    </div>
    <div class="kpi kpi-inmd">
      <div class="kpi-valor">${this.metricas.totalInmd.toLocaleString('es-CO')}</div>
      <div class="kpi-label">Inmediata</div>
    </div>
    <div class="kpi kpi-rut">
      <div class="kpi-valor">${this.metricas.totalRutina.toLocaleString('es-CO')}</div>
      <div class="kpi-label">Rutina</div>
    </div>
    <div class="kpi kpi-coord">
      <div class="kpi-valor">${this.puntos.length.toLocaleString('es-CO')}</div>
      <div class="kpi-label">Con coordenadas</div>
    </div>
  </div>

  <!-- Insights clave -->
  <div class="insights">
    <div class="insight">
      <div class="insight-label">Tipo más frecuente</div>
      <div class="insight-valor">${this.topCaso ? (this.topCaso.descripcion || this.topCaso.clave) + ' (' + this.topCaso.total + ')' : '—'}</div>
    </div>
    <div class="insight">
      <div class="insight-label">Hora pico de incidentes</div>
      <div class="insight-valor">${this.horaPico}</div>
    </div>
    <div class="insight">
      <div class="insight-label">Día más activo</div>
      <div class="insight-valor">${this.diaPico}</div>
    </div>
  </div>

  <!-- Gráficas -->
  <div class="seccion">
    <h2>Análisis estadístico</h2>
    <div class="graficas-grid">
      ${imgPrio  ? `<div class="grafica-card"><h3>Distribución por prioridad</h3><img src="${imgPrio}"></div>` : ''}
      ${imgTipo  ? `<div class="grafica-card grafica-full"><h3>Top tipos de caso</h3><img src="${imgTipo}"></div>` : ''}
      ${imgHora  ? `<div class="grafica-card grafica-full"><h3>Incidentes por hora del día</h3><img src="${imgHora}"></div>` : ''}
      ${imgDia   ? `<div class="grafica-card"><h3>Por día de la semana</h3><img src="${imgDia}"></div>` : ''}
      ${imgMes   ? `<div class="grafica-card"><h3>Tendencia mensual</h3><img src="${imgMes}"></div>` : ''}
    </div>
  </div>

  <!-- Top tipos de caso (tabla) -->
  ${topCasos ? `
  <div class="seccion">
    <h2>Ranking de tipos de caso</h2>
    <table>
      <thead><tr><th>#</th><th>Código</th><th>Descripción</th><th style="text-align:right">Incidentes</th></tr></thead>
      <tbody>${topCasos}</tbody>
    </table>
  </div>` : ''}

  <!-- Top ciudades -->
  ${topCiudades}

  <!-- Pie de página -->
  <div class="pie">
    <span>SECAD · Sistema de Estadísticas Delincuenciales · OFTIC</span>
    <span>Documento generado el ${ahora} — Confidencial</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Mapa Leaflet
  // ══════════════════════════════════════════════════════════════════════════

  private initMap(): void {
    if (typeof L === 'undefined') return;

    this.map = L.map('mapaEstadisticoDiv', { zoomControl: true })
                .setView([4.7110, -74.0721], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);

    if (this.codDane) this.cargarCapaMunicipios(this.codDane);
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  cambiarCapa(capa: CapaMapa): void {
    this.capaActiva = capa;
    this.actualizarMapa();
  }

  private actualizarMapa(): void {
    if (!this.map) return;
    this.limpiarCapasIncidentes();
    if (this.puntos.length === 0) return;

    switch (this.capaActiva) {
      case 'calor':    this.renderHeatmap();  break;
      case 'clusters': this.renderClusters(); break;
      case 'puntos':   this.renderPuntos();   break;
    }
  }

  private limpiarCapasIncidentes(): void {
    if (this.heatLayer)    { this.map.removeLayer(this.heatLayer);    this.heatLayer    = null; }
    if (this.clusterGroup) { this.map.removeLayer(this.clusterGroup); this.clusterGroup = null; }
    if (this.puntosGroup)  { this.map.removeLayer(this.puntosGroup);  this.puntosGroup  = null; }
  }

  // ── Capa de calor ──────────────────────────────────────────────────────────

  private renderHeatmap(): void {
    if (typeof (L as any).heatLayer === 'undefined') {
      this.toast.warning('Mapa', 'Plugin leaflet.heat no disponible. Verifique index.html.');
      return;
    }
    const heatData = this.puntos.map(p => [p.lat, p.lng, p.intensidad]);
    this.heatLayer = (L as any).heatLayer(heatData, {
      radius:     45,
      blur:       35,
      maxZoom:    18,
      max:        1.0,
      minOpacity: 0.5,
      gradient: {
        0.0:  '#000033',
        0.25: '#0000ff',
        0.45: '#00ccff',
        0.60: '#00ff88',
        0.75: '#ffff00',
        0.88: '#ff6600',
        1.0:  '#ff0000'
      }
    }).addTo(this.map);
  }

  // ── Capa de clusters ──────────────────────────────────────────────────────

  private renderClusters(): void {
    if (typeof (L as any).markerClusterGroup === 'undefined') {
      this.toast.warning('Mapa', 'Plugin markercluster no disponible.');
      return;
    }

    this.clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius:    70,
      iconCreateFunction: (cluster: any) => {
        const count    = cluster.getChildCount();
        const size     = count < 10 ? 38 : count < 50 ? 48 : count < 200 ? 56 : 64;
        const fontSize = count > 99 ? 11 : 14;
        // Color según volumen: azul < 10, naranja < 50, rojo ≥ 50
        const bg = count < 10 ? '#0066cc' : count < 50 ? '#e67300' : '#cc0000';
        // Inline styles — Leaflet inyecta el HTML fuera del árbol Angular,
        // por lo que las clases SCSS no aplican. Todo debe ir en style="".
        const html = `<div style="
          width:${size}px; height:${size}px; line-height:${size}px;
          font-size:${fontSize}px; font-family:inherit;
          background:${bg}; color:#fff; font-weight:900; text-align:center;
          border-radius:50%;
          border:2.5px solid rgba(255,255,255,.80);
          box-shadow:0 3px 14px rgba(0,0,0,.45), 0 0 0 4px rgba(255,255,255,.20);
          cursor:pointer; display:flex; align-items:center; justify-content:center;
        ">${count}</div>`;
        return (L as any).divIcon({
          html,
          className:  '',
          iconSize:   [size, size],
          iconAnchor: [size / 2, size / 2]
        });
      }
    });

    for (const p of this.puntos) {
      const color  = this.colorPrioridad(p.prioridad);
      const marker = L.circleMarker([p.lat, p.lng], {
        radius:      10,
        fillColor:   color,
        color:       '#ffffff',
        weight:      2.5,
        opacity:     1,
        fillOpacity: 0.92
      }).bindPopup(this.buildPopup(p));
      this.clusterGroup.addLayer(marker);
    }
    this.map.addLayer(this.clusterGroup);
  }

  // ── Capa de puntos individuales ───────────────────────────────────────────

  private renderPuntos(): void {
    this.puntosGroup = L.layerGroup();
    for (const p of this.puntos) {
      const color = this.colorPrioridad(p.prioridad);
      // Halo exterior (ring blanco semitransparente)
      L.circleMarker([p.lat, p.lng], {
        radius:      14,
        fillColor:   color,
        color:       color,
        weight:      0,
        opacity:     0,
        fillOpacity: 0.22,
        interactive: false
      }).addTo(this.puntosGroup);
      // Punto principal
      L.circleMarker([p.lat, p.lng], {
        radius:      9,
        fillColor:   color,
        color:       '#ffffff',
        weight:      2.5,
        opacity:     1,
        fillOpacity: 0.95
      })
       .bindPopup(this.buildPopup(p))
       .addTo(this.puntosGroup);
    }
    this.puntosGroup.addTo(this.map);
  }

  private buildPopup(p: DtoPuntoEstadistico): string {
    return `
      <div style="font-family:sans-serif;min-width:190px;font-size:12px">
        <div style="font-weight:700;color:#003087;margin-bottom:5px;font-size:13px">
          ${p.codiPedido} — ${p.descPedido || 'Sin descripción'}
        </div>
        <div style="margin-bottom:2px">
          <i class="fa-solid fa-location-dot" style="color:#cc0000"></i>
          <strong>${p.direCaso || '—'}</strong>
        </div>
        ${p.barrio ? `<div style="color:#666;margin-bottom:2px">${p.barrio}${p.ciudad ? ', ' + p.ciudad : ''}</div>` : ''}
        <div style="margin-top:5px;margin-bottom:5px">
          <span style="background:${this.colorPrioridad(p.prioridad)};color:#fff;padding:2px 9px;
                       border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.04em">
            ${this.labelPrioridad(p.prioridad)}
          </span>
          <span style="color:#888;font-size:10px;margin-left:6px">
            <i class="fa-regular fa-clock"></i> ${p.horaCaso}
          </span>
        </div>
        <div style="font-size:10px;color:#aaa">ID: ${p.id}</div>
      </div>`;
  }

  // ── Capas institucionales ─────────────────────────────────────────────────

  private cargarCapaMunicipios(codDane: string): void {
    const url = `${this.ARCGIS_BASE}/3/query?where=CODIGO='${encodeURIComponent(codDane)}'&outFields=CODIGO,NOMBRE&returnGeometry=true&f=geojson`;
    fetch(url).then(r => r.json()).then((g: any) => {
      if (!this.map) return;
      this.municipioLayer = L.geoJSON(g, {
        style: { color: '#003087', weight: 2.5, fillColor: '#7d7d7d', fillOpacity: 0.06 }
      }).addTo(this.map);
      const bounds = this.municipioLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [20, 20] });
        this.cargarCuadrantesPorBbox(bounds);
      }
    }).catch(() => {});
  }

  private cargarCuadrantesPorBbox(bounds: any): void {
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    const url  = `${this.ARCGIS_BASE}/11/query?geometry=${encodeURIComponent(bbox)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=geojson&resultRecordCount=2000`;
    fetch(url).then(r => r.json()).then((g: any) => {
      if (!this.map) return;
      if (this.cuadrantesLayer) this.map.removeLayer(this.cuadrantesLayer);
      this.cuadrantesLayer = L.geoJSON(g, {
        style: { color: '#ff0000', weight: 1.2, fillOpacity: 0, opacity: 0.45 }
      }).addTo(this.map);
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Gráficas Chart.js
  // ══════════════════════════════════════════════════════════════════════════

  private renderCharts(): void {
    if (typeof Chart === 'undefined') return;
    this.destroyCharts();
    this.renderChartTipo();
    this.renderChartHora();
    this.renderChartDia();
    this.renderChartMes();
    this.renderChartPrioridad();
  }

  private renderChartTipo(): void {
    const ref = this.chartTipoRef?.nativeElement;
    if (!ref) return;
    const top = this.metricas.porTipoCaso.slice(0, 12);
    this.charts.set('tipo', new Chart(ref, {
      type: 'bar',
      data: {
        labels:   top.map(x => x.descripcion || x.clave),
        datasets: [{ label: 'Incidentes', data: top.map(x => x.total),
          backgroundColor: this.paleta(top.length), borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales:  { x: { grid: { display: false } }, y: { ticks: { font: { size: 10 } } } }
      }
    }));
  }

  private renderChartHora(): void {
    const ref = this.chartHoraRef?.nativeElement;
    if (!ref) return;
    const horas = Array.from({ length: 24 }, (_, i) => {
      const found = this.metricas.porHora.find(h => h.clave === String(i));
      return found?.total ?? 0;
    });
    this.charts.set('hora', new Chart(ref, {
      type: 'line',
      data: {
        labels:   Array.from({ length: 24 }, (_, i) => `${i}h`),
        datasets: [{ label: 'Incidentes por hora', data: horas, fill: true,
          borderColor: '#003087', backgroundColor: 'rgba(0,48,135,0.15)',
          tension: 0.4, pointRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    }));
  }

  private renderChartDia(): void {
    const ref = this.chartDiaRef?.nativeElement;
    if (!ref) return;
    const dias  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const vals  = Array.from({ length: 7 }, (_, i) => {
      return this.metricas.porDiaSemana.find(d => d.clave === String(i))?.total ?? 0;
    });
    this.charts.set('dia', new Chart(ref, {
      type: 'bar',
      data: {
        labels:   dias,
        datasets: [{ label: 'Por día', data: vals,
          backgroundColor: 'rgba(0,48,135,0.7)', borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    }));
  }

  private renderChartMes(): void {
    const ref = this.chartMesRef?.nativeElement;
    if (!ref) return;
    const meses = this.metricas.porMes;
    this.charts.set('mes', new Chart(ref, {
      type: 'line',
      data: {
        labels:   meses.map(m => m.clave),
        datasets: [{ label: 'Tendencia', data: meses.map(m => m.total),
          borderColor: '#e67300', backgroundColor: 'rgba(230,115,0,0.1)',
          fill: true, tension: 0.3, pointRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    }));
  }

  private renderChartPrioridad(): void {
    const ref = this.chartPrioRef?.nativeElement;
    if (!ref) return;
    const items = this.metricas.porPrioridad.filter(x => x.total > 0);
    this.charts.set('prio', new Chart(ref, {
      type: 'doughnut',
      data: {
        labels:   items.map(x => x.descripcion),
        datasets: [{ data: items.map(x => x.total),
          backgroundColor: ['#cc0000','#e67300','#0066cc','#888888'],
          borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
      }
    }));
  }

  private destroyCharts(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch {} });
    this.charts.clear();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Helpers de UI
  // ══════════════════════════════════════════════════════════════════════════

  colorPrioridad(p: string): string {
    const u = (p || '').toUpperCase();
    if (u === 'FLASH'    || u === '01') return '#cc0000';
    if (u === 'INMEDIATA'|| u === '02') return '#e67300';
    if (u === 'RUTINA'   || u === '03') return '#0066cc';
    return '#888888';
  }

  labelPrioridad(p: string): string {
    const u = (p || '').toUpperCase();
    if (u === 'FLASH'    || u === '01') return 'Flash';
    if (u === 'INMEDIATA'|| u === '02') return 'Inmediata';
    if (u === 'RUTINA'   || u === '03') return 'Rutina';
    return p || '—';
  }

  get topCaso(): DtoAgrupacion | null {
    return this.metricas.porTipoCaso[0] ?? null;
  }

  get horaPico(): string {
    if (!this.metricas.porHora.length) return '—';
    const max = this.metricas.porHora.reduce((a, b) => b.total > a.total ? b : a);
    return `${max.clave}:00 h`;
  }

  get diaPico(): string {
    if (!this.metricas.porDiaSemana.length) return '—';
    const max = this.metricas.porDiaSemana.reduce((a, b) => b.total > a.total ? b : a);
    return max.descripcion;
  }

  private paleta(n: number): string[] {
    const base = ['#003087','#0055d4','#0077e6','#3399ff','#66b3ff',
                  '#e67300','#cc0000','#00a36c','#6f42c1','#fd7e14',
                  '#20c997','#d63384'];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  }

  private defaultDesde(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().substring(0, 10);
  }

  private defaultHasta(): string {
    return new Date().toISOString().substring(0, 10);
  }

  private metricasVacias(): DtoMetricasEstadisticas {
    return {
      total: 0, totalFlash: 0, totalInmd: 0, totalRutina: 0,
      totalOtros: 0, conCoordenadas: 0,
      porTipoCaso: [], porHora: [], porDiaSemana: [],
      porMes: [], porCiudad: [], porPrioridad: []
    };
  }

  // Calcula métricas directamente desde los puntos cargados.
  // Se activa cuando el backend devuelve métricas vacías (total=0) pero sí hay puntos.
  private computeMetricasFromPuntos(): DtoMetricasEstadisticas {
    const m = this.metricasVacias();
    m.total          = this.puntos.length;
    m.conCoordenadas = this.puntos.length;

    // Conteos por prioridad
    for (const p of this.puntos) {
      const u = (p.prioridad || '').toUpperCase();
      if      (u === 'FLASH'     || u === '01') m.totalFlash++;
      else if (u === 'INMEDIATA' || u === '02') m.totalInmd++;
      else if (u === 'RUTINA'    || u === '03') m.totalRutina++;
      else                                       m.totalOtros++;
    }

    // Por prioridad (donut)
    m.porPrioridad = [
      { clave: 'FLASH',    descripcion: 'Flash',    total: m.totalFlash },
      { clave: 'INMEDIATA',descripcion: 'Inmediata',total: m.totalInmd  },
      { clave: 'RUTINA',   descripcion: 'Rutina',   total: m.totalRutina },
    ];
    if (m.totalOtros > 0)
      m.porPrioridad.push({ clave: 'OTROS', descripcion: 'Sin prioridad', total: m.totalOtros });

    // Por tipo de caso
    const tipoMap = new Map<string, DtoAgrupacion>();
    for (const p of this.puntos) {
      const clave = p.codiPedido || 'SIN CÓDIGO';
      const desc  = p.descPedido || clave;
      const entry = tipoMap.get(clave);
      if (entry) entry.total++;
      else tipoMap.set(clave, { clave, descripcion: desc, total: 1 });
    }
    m.porTipoCaso = [...tipoMap.values()]
      .sort((a, b) => b.total - a.total).slice(0, 12);

    // Por hora del día — horaCaso = 'DD/MM/YYYY HH:MM'
    const horaMap = new Map<number, number>();
    for (const p of this.puntos) {
      const timePart = (p.horaCaso || '').split(' ')[1];
      if (timePart) {
        const h = parseInt(timePart.split(':')[0], 10);
        if (!isNaN(h)) horaMap.set(h, (horaMap.get(h) ?? 0) + 1);
      }
    }
    m.porHora = Array.from(horaMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([h, total]) => ({ clave: String(h), descripcion: String(h), total }));

    // Por día de la semana — extraemos desde la fecha de horaCaso
    const diasNombre = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const dowMap = new Map<number, number>();
    for (const p of this.puntos) {
      const datePart = (p.horaCaso || '').split(' ')[0]; // 'DD/MM/YYYY'
      if (datePart) {
        const parts = datePart.split('/');
        if (parts.length === 3) {
          const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
          if (!isNaN(d.getTime())) {
            const dow = d.getDay();
            dowMap.set(dow, (dowMap.get(dow) ?? 0) + 1);
          }
        }
      }
    }
    m.porDiaSemana = Array.from(dowMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dow, total]) => ({
        clave:       String(dow),
        descripcion: diasNombre[dow] ?? String(dow),
        total
      }));

    // Tendencia mensual — 'DD/MM/YYYY' → 'YYYY-MM'
    const mesMap = new Map<string, number>();
    for (const p of this.puntos) {
      const datePart = (p.horaCaso || '').split(' ')[0];
      if (datePart) {
        const parts = datePart.split('/');
        if (parts.length === 3) {
          const key = `${parts[2]}-${parts[1].padStart(2,'0')}`;
          mesMap.set(key, (mesMap.get(key) ?? 0) + 1);
        }
      }
    }
    m.porMes = Array.from(mesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([clave, total]) => ({ clave, descripcion: clave, total }));

    // Top ciudades
    const ciudadMap = new Map<string, number>();
    for (const p of this.puntos) {
      if (p.ciudad) ciudadMap.set(p.ciudad, (ciudadMap.get(p.ciudad) ?? 0) + 1);
    }
    m.porCiudad = Array.from(ciudadMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([clave, total]) => ({ clave, descripcion: clave, total }));

    return m;
  }
}
