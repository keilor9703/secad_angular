import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  RecepcionService,
  DtoCanalRecepcion,
  DtoCasoItem,
  DtoReferenciaSecad,
  DtoLlamadaAsociar,
  DtoRecepcion,
  OrigenEvento
} from '../../../core/services/operacion/recepcion.service';
import {
  AsistenteService,
  AsistenteCategoria,
  AsistentePregunta,
  parsearOpciones
} from '../../../core/services/operacion/asistente.service';

// Leaflet loaded via CDN in index.html
declare const L: any;

export interface GrupoCanal {
  fuerza: string;
  canales: DtoCanalRecepcion[];
}

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.scss']
})
export class RecepcionComponent implements OnInit, AfterViewInit, OnDestroy {

  // ── JWT claims ────────────────────────────────────────────────────────────
  sitioGraba = 0;
  acd        = 0;
  fuerzaId   = 0;
  codDane    = '';
  usuario    = '';

  // ── Header fields ─────────────────────────────────────────────────────────
  txtFechaIngreso = '';
  txtNumeLlamada  = '';
  txtAcd          = '';

  // ── Fieldset Llamada ──────────────────────────────────────────────────────
  txtAbonado        = '';
  txtPropAbonado    = '';
  txtDispTelefonico = '';
  hdnCodDispTelefonico = '';
  hdnCeldaMarcacion    = '';
  txtNombreLlamante = '';
  txtDireLlamante   = '';

  // ── Fieldset Datos ────────────────────────────────────────────────────────
  txtCodigCaso  = '';
  txtDescaso    = '';
  txtCodigCaso2 = '';
  txtDescaso2   = '';
  txtCiudadCaso = '';
  txtBarrioCaso = '';
  txtDireCaso   = '';
  latitudCaso   = '';
  longitudCaso  = '';
  txtAsociarLlamada = '';
  tipoPedido        = '';
  caliPedido        = '';
  txtComentario     = '';

  // ── Prioridad / Importancia ───────────────────────────────────────────────
  prioridad   = '03';
  importancia = '01';

  // ── Map ───────────────────────────────────────────────────────────────────
  direccionBusqueda = '';
  private map:              any = null;
  private mapMarker:        any = null;
  private municipioLayer:   any = null;
  private cuadrantesLayer:  any = null;
  private iconoPersona:     any = null;

  // ── Association hidden values ─────────────────────────────────────────────
  hdnNumeLlamadaAsociada = '';
  hdnSitioGrabaAsociada  = '';

  // ── State ─────────────────────────────────────────────────────────────────
  llamadaEncontrada = false;
  saving            = false;
  minimized         = false;
  visible           = true;

  // ── Data ──────────────────────────────────────────────────────────────────
  gruposCanales: GrupoCanal[]        = [];
  canales: DtoCanalRecepcion[]       = [];
  refTipoPedido: DtoReferenciaSecad[] = [];
  refCaliPedido: DtoReferenciaSecad[] = [];
  casosSugeridos1: DtoCasoItem[]     = [];
  casosSugeridos2: DtoCasoItem[]     = [];
  llamadasParaAsociar: DtoLlamadaAsociar[] = [];
  showModalAsociar = false;

  // ── Autocomplete subjects ─────────────────────────────────────────────────
  private buscar1$ = new Subject<string>();
  private buscar2$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private pollTimer: any = null;

  // ── Canal de origen (§multicanal) ────────────────────────────────────────
  /** Valor UI seleccionado por el operador. Se mapea a OrigenEvento al guardar. */
  canalOrigenUI = 'TEL_123';

  readonly canalesOrigen = [
    { value: 'TEL_123',     label: 'Llamada 112/123',          icon: 'fa-phone-volume'      },
    { value: 'TEL_DIRECTO', label: 'Teléfono directo',         icon: 'fa-phone'             },
    { value: 'RADIO',       label: 'Radio policial',            icon: 'fa-tower-broadcast'   },
    { value: 'CAMPO',       label: 'Reporte de campo',          icon: 'fa-person-running'    },
    { value: 'SUPERVISION', label: 'Supervisión / Iniciativa',  icon: 'fa-shield-halved'     },
    { value: 'TRASLADO',    label: 'Traslado otra entidad',     icon: 'fa-right-left'        },
    { value: 'MANUAL',      label: 'Ingreso manual',            icon: 'fa-keyboard'          },
  ] as const;

  // ── §6.17 Asistente Inteligente ──────────────────────────────────────────────
  asistenteAbierto     = false;
  asistenteCategorias: AsistenteCategoria[]  = [];
  asistenteLoadingCat  = false;
  asistenteCategoriaSel = '';
  asistentePreguntas:  AsistentePregunta[]   = [];
  asistenteLoadingPreg = false;
  readonly asisParseOpc = parsearOpciones;

  constructor(
    private auth:        AuthService,
    private svc:         RecepcionService,
    private toast:       ToastService,
    private zone:        NgZone,
    private cdr:         ChangeDetectorRef,
    private asistenteSvc: AsistenteService
  ) {}

  ngOnInit(): void {
    const claims = this.auth.getJwtClaims();
    this.sitioGraba = claims.sitioGraba;
    this.acd        = claims.acd;
    this.fuerzaId   = claims.fuerzaId;
    this.codDane    = claims.codDane;
    this.usuario    = claims.usuario;
    this.txtAcd     = String(this.acd);

    this.cargarReferencias();
    this.cargarCanales();
    this.iniciarPollLlamada();

    // Autocomplete debounce (minLength 3)
    this.buscar1$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => { if (q.length >= 3) this.doSearchCasos(q, 1); else this.casosSugeridos1 = []; });

    this.buscar2$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => { if (q.length >= 3) this.doSearchCasos(q, 2); else this.casosSugeridos2 = []; });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.map) { this.map.off(); this.map.remove(); this.map = null; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAP – Migrado desde JsMapaRecepcion.js (ArcGIS → Leaflet + Nominatim)
  // ══════════════════════════════════════════════════════════════════════════

  private readonly ARCGIS_BASE =
    'https://services3.arcgis.com/8cBoM4o6pnuUb1z1/ArcGIS/rest/services/SIDENCO_SinMalla/FeatureServer';

  // ── Inicialización del mapa ───────────────────────────────────────────────

  private initMap(): void {
    if (typeof L === 'undefined') {
      console.warn('Leaflet no disponible – verifique index.html');
      return;
    }

    // Ícono persona verde (equivalente al crearMunecoVerde() del original)
    this.iconoPersona = L.divIcon({
      className: '',
      html: `<span style="
               display:inline-block;
               font-size:26px;
               line-height:1;
               color:#0a9242;
               filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));
             "><i class="fa-solid fa-person"></i></span>`,
      iconSize:    [26, 30],
      iconAnchor:  [13, 30],
      popupAnchor: [0, -32]
    });

    // Centro inicial: Bogotá (se reemplaza con el municipio del codDane)
    this.map = L.map('mapaDiv', { zoomControl: true })
                .setView([4.7110, -74.0721], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);

    // Click: coloca marcador + reverse-geocode → llena campos dirección
    this.map.on('click', (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      this.zone.run(() => {
        this.latitudCaso  = lat.toFixed(6);
        this.longitudCaso = lng.toFixed(6);
        this.colocarMarcador(lat, lng);
        this.cdr.detectChanges();
      });
      this.reverseGeocode(lat, lng); // ← llena txtDireCaso, txtBarrioCaso, txtCiudadCaso
    });

    // Cargar capas al inicio
    if (this.codDane) {
      this.cargarCapaMunicipios(this.codDane);   // resalta el municipio activo
      this.cargarCapaCuadrantes(this.codDane);   // dibuja cuadrantes en rojo
    }
  }

  // ── Marcador verde persona ────────────────────────────────────────────────

  private colocarMarcador(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.mapMarker) this.map.removeLayer(this.mapMarker);
    this.mapMarker = L.marker([lat, lng], { icon: this.iconoPersona }).addTo(this.map);
  }

  // ── Reverse-geocode (Nominatim) → rellena campos dirección ───────────────
  // Equivalente a obtenerDireccionPorCoordenadas() del original

  private reverseGeocode(lat: number, lng: number): void {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    fetch(url)
      .then(r => r.json())
      .then((data: any) => {
        if (!data?.address) return;
        const a = data.address;

        const calle   = a.road ?? a.pedestrian ?? a.path ?? a.footway ?? '';
        const num     = a.house_number ? ` # ${a.house_number}` : '';
        const dir     = (calle + num).trim() || (data.display_name ?? '');
        const barrio  = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.district ?? '';
        const ciudad  = a.city ?? a.town ?? a.municipality ?? a.county ?? '';

        this.zone.run(() => {
          this.txtDireCaso    = dir;
          this.txtDireLlamante = dir;
          this.txtBarrioCaso  = barrio;
          this.txtCiudadCaso  = ciudad;
          this.cdr.detectChanges();
        });
      })
      .catch(err => console.warn('[Mapa] Error geocodificación inversa:', err));
  }

  // ── Forward geocode por texto (Nominatim) + rellena campos ───────────────
  // Equivalente a buscarDireccion() del original

  geocodificarDireccion(): void {
    const q = this.direccionBusqueda.trim();
    if (!q) return;

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
    fetch(url)
      .then(r => r.json())
      .then((data: any[]) => {
        if (!data?.length) {
          this.toast.warning('Mapa', 'Dirección no encontrada');
          return;
        }
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        this.zone.run(() => {
          this.latitudCaso  = lat.toFixed(6);
          this.longitudCaso = lon.toFixed(6);
          this.map?.setView([lat, lon], 17);
          this.colocarMarcador(lat, lon);
          this.cdr.detectChanges();
        });

        // Rellena campos a partir del resultado de Nominatim
        const a = data[0].address ?? {};
        const calle  = a.road ?? a.pedestrian ?? a.path ?? '';
        const num    = a.house_number ? ` # ${a.house_number}` : '';
        const dir    = (calle + num).trim() || q;
        const barrio = a.suburb ?? a.neighbourhood ?? a.quarter ?? '';
        const ciudad = a.city ?? a.town ?? a.municipality ?? '';

        this.zone.run(() => {
          this.txtDireCaso    = dir;
          this.txtDireLlamante = dir;
          if (barrio) this.txtBarrioCaso = barrio;
          if (ciudad) this.txtCiudadCaso = ciudad;
          this.cdr.detectChanges();
        });
      })
      .catch(() => this.toast.error('Mapa', 'Error al geocodificar'));
  }

  // ── Capa de municipios (ArcGIS REST → GeoJSON → Leaflet) ─────────────────
  // Equivalente a municipiosExtent() + mpioLayer del original

  private cargarCapaMunicipios(codDane: string): void {
    if (!codDane) return;
    const url =
      `${this.ARCGIS_BASE}/3/query?` +
      `where=CODIGO='${encodeURIComponent(codDane)}'` +
      `&outFields=CODIGO,NOMBRE&returnGeometry=true&f=geojson`;

    fetch(url)
      .then(r => r.json())
      .then((geojson: any) => {
        if (!this.map) return;
        if (this.municipioLayer) this.map.removeLayer(this.municipioLayer);

        this.municipioLayer = L.geoJSON(geojson, {
          style: {
            color:       '#ff0000',
            weight:      1.5,
            fillColor:   '#7d7d7d',
            fillOpacity: 0.30
          }
        }).addTo(this.map);

        const bounds = this.municipioLayer.getBounds();
        if (bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [20, 20] });
          // Después de centrar el municipio, cargamos cuadrantes en ese bbox
          this.cargarCapaCuadrantesPorBbox(bounds);
        }
      })
      .catch(err => console.warn('[Mapa] Error cargando municipio:', err));
  }

  // ── Capa de cuadrantes (ArcGIS REST → GeoJSON → Leaflet) ─────────────────
  // Equivalente a cuadrantesLayer del original (líneas rojas)

  private cargarCapaCuadrantes(codDane: string): void {
    // Primero intentamos via bbox; si no hay municipio cargado,
    // esperamos a que cargarCapaMunicipios() llame a cargarCapaCuadrantesPorBbox()
    if (!codDane) return; // bbox se cargará tras municipiosExtent
  }

  private cargarCapaCuadrantesPorBbox(bounds: any): void {
    if (!this.map) return;
    const sw  = bounds.getSouthWest();
    const ne  = bounds.getNorthEast();
    // ArcGIS espera: xmin,ymin,xmax,ymax en WGS84
    const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;

    const url =
      `${this.ARCGIS_BASE}/11/query?` +
      `geometry=${encodeURIComponent(bbox)}` +
      `&geometryType=esriGeometryEnvelope` +
      `&spatialRel=esriSpatialRelIntersects` +
      `&outFields=*&returnGeometry=true&f=geojson` +
      `&resultRecordCount=2000`;

    fetch(url)
      .then(r => r.json())
      .then((geojson: any) => {
        if (!this.map) return;
        if (this.cuadrantesLayer) this.map.removeLayer(this.cuadrantesLayer);

        this.cuadrantesLayer = L.geoJSON(geojson, {
          style: {
            color:       '#ff0000',
            weight:      2,
            fillOpacity: 0,
            opacity:     0.75
          }
        }).addTo(this.map);
      })
      .catch(err => console.warn('[Mapa] Error cargando cuadrantes:', err));
  }

  // ── Centrar mapa en municipio (equivalente a CentrarMapaPorMunicipio) ─────

  centrarMapaPorMunicipio(codDane: string): void {
    this.cargarCapaMunicipios(codDane);
  }

  // ── Polling CTI ───────────────────────────────────────────────────────────

  private iniciarPollLlamada(): void {
    if (this.llamadaEncontrada || this.txtNumeLlamada) return;
    this.svc.getLlamada().subscribe({
      next: resp => {
        if (resp.success && resp.data) {
          const d = resp.data;
          this.txtNumeLlamada       = String(d.NUME_LLAMADA);
          this.txtAbonado           = String(d.NUME_TELEFONO);
          this.longitudCaso         = d.CORDX;
          this.latitudCaso          = d.CORDY;
          this.txtFechaIngreso      = d.FECHAGMLC;
          this.hdnCeldaMarcacion    = d.OPERADOR;
          this.detectarDispositivo(d.NUME_TELEFONO);
          if (d.CORDY && d.CORDX && d.CORDY !== '0' && d.CORDX !== '0') {
            const lat = parseFloat(d.CORDY);
            const lng = parseFloat(d.CORDX);
            this.map?.setView([lat, lng], 16);
            this.colocarMarcador(lat, lng);
            // Equivalente a ubicarLlamadaEnMapa(): reverse-geocode → rellena dirección
            this.reverseGeocode(lat, lng);
          }
          this.llamadaEncontrada = true;
          this.canalOrigenUI     = 'TEL_123'; // llamada CTI → origen automático
          this.cdr.detectChanges();
        } else {
          // Schedule next poll only if no call yet
          this.pollTimer = setTimeout(() => this.iniciarPollLlamada(), 5000);
        }
      },
      error: () => {
        this.pollTimer = setTimeout(() => this.iniciarPollLlamada(), 5000);
      }
    });
  }

  reiniciarPoll(): void {
    this.llamadaEncontrada = false;
    this.iniciarPollLlamada();
  }

  // ── Consecutivo (manual / quick-close path) ────────────────────────────────

  consultarConsecutivo(thenDo?: () => void): void {
    this.svc.getConsecutivo().subscribe({
      next: resp => {
        if (resp.success) {
          this.txtNumeLlamada  = String(resp.data);
          this.txtFechaIngreso = this.obtenerFechaActual();
          if (thenDo) thenDo();
        } else {
          this.toast.warning('ID Llamada', 'Error al obtener consecutivo');
        }
      },
      error: () => this.toast.error('ID Llamada', 'Error de comunicación')
    });
  }

  onAbonadoEnter(): void {
    const v = this.txtAbonado.trim();
    if (!this.txtNumeLlamada && v.length >= 3 && v.length <= 10) {
      this.consultarConsecutivo();
    } else if (v.length < 3 || v.length > 10) {
      this.toast.warning('Abonado', 'El número debe tener entre 3 y 10 dígitos');
    }
  }

  onAbonadoChange(val: string | number): void {
    this.txtAbonado = String(val ?? ''); // garantiza que siempre sea string
    this.detectarDispositivo(Number(this.txtAbonado.replace(/\D/g, '')) || 0);
  }

  private detectarDispositivo(raw: number): void {
    const n = String(raw).replace(/\D/g, '');
    if (!n) { this.txtDispTelefonico = ''; this.hdnCodDispTelefonico = ''; return; }
    if (n.length === 10 && n.startsWith('3'))      { this.txtDispTelefonico = 'Celular';           this.hdnCodDispTelefonico = '02'; }
    else if (n.length === 7)                        { this.txtDispTelefonico = 'Teléfono fijo';     this.hdnCodDispTelefonico = '01'; }
    else if (n.length === 10 && !n.startsWith('3')){ this.txtDispTelefonico = 'Teléfono fijo';     this.hdnCodDispTelefonico = '01'; }
    else if (n.length === 3 && n.startsWith('1'))  { this.txtDispTelefonico = 'Linea Emergencias'; this.hdnCodDispTelefonico = '01'; }
    else                                            { this.txtDispTelefonico = 'Otros';             this.hdnCodDispTelefonico = '00'; }
  }

  // ── Case autocomplete ────────────────────────────────────────────────────

  onDescaso1Change(val: string): void { this.buscar1$.next(val); }
  onDescaso2Change(val: string): void { this.buscar2$.next(val); }

  private doSearchCasos(q: string, slot: 1 | 2): void {
    this.svc.buscarCasos(q).subscribe({
      next: resp => {
        if (slot === 1) this.casosSugeridos1 = resp.data ?? [];
        else            this.casosSugeridos2 = resp.data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {
        if (slot === 1) this.casosSugeridos1 = [];
        else            this.casosSugeridos2 = [];
      }
    });
  }

  seleccionarSugerencia(c: DtoCasoItem, slot: 1 | 2): void {
    if (slot === 1) {
      this.txtCodigCaso = c.CODIGO_CASO;
      this.txtDescaso   = c.DESCRIPCION_CASO;
      this.casosSugeridos1 = [];
    } else {
      this.txtCodigCaso2 = c.CODIGO_CASO;
      this.txtDescaso2   = c.DESCRIPCION_CASO;
      this.casosSugeridos2 = [];
    }
  }

  cerrarSugerencias(): void {
    setTimeout(() => {
      this.casosSugeridos1 = [];
      this.casosSugeridos2 = [];
    }, 200);
  }

  buscarCasoPorCodigo(codigo: string, slot: 1 | 2): void {
    if (!codigo.trim()) return;
    this.svc.getCasoPorCodigo(codigo).subscribe({
      next: resp => {
        if (resp.success && resp.data) {
          if (slot === 1) this.txtDescaso  = resp.data.DESCRIPCION_CASO;
          else            this.txtDescaso2 = resp.data.DESCRIPCION_CASO;
        } else {
          this.toast.warning('Caso', 'Código no encontrado');
        }
      },
      error: () => this.toast.error('Caso', 'Error al buscar código')
    });
  }

  // ── Channels ─────────────────────────────────────────────────────────────

  private cargarCanales(): void {
    this.svc.getCanales(this.sitioGraba).subscribe({
      next: data => {
        this.canales = (data ?? []).map(c => ({ ...c, seleccionado: false }));
        this.construirGruposCanales();
      },
      error: () => this.toast.error('Canales', 'No se pudieron cargar los canales')
    });
  }

  private construirGruposCanales(): void {
    const mapa: Record<string, DtoCanalRecepcion[]> = {};
    for (const c of this.canales) {
      const k = (c.fuerza || 'SIN FUERZA').trim();
      (mapa[k] ??= []).push(c);
    }
    this.gruposCanales = Object.keys(mapa)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map(f => ({
        fuerza: f,
        canales: mapa[f].sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
      }));
  }

  toggleCanal(c: DtoCanalRecepcion): void {
    c.seleccionado = !c.seleccionado;
  }

  private canalesSeleccionados(): number[] {
    return this.canales.filter(c => c.seleccionado).map(c => c.codigo);
  }

  // ── References ────────────────────────────────────────────────────────────

  private cargarReferencias(): void {
    this.svc.getReferencias('TIPO_PEDIDO').subscribe({
      next: data => this.refTipoPedido = data ?? []
    });
    this.svc.getReferencias('CALI_PEDIDO').subscribe({
      next: data => this.refCaliPedido = data ?? []
    });
  }

  // ── Validate & Send ───────────────────────────────────────────────────────

  validarYGuardar(): void {
    if (!this.txtNumeLlamada) {
      this.toast.warning('Validar', 'Debe generar un ID de llamada (ingrese abonado y presione Enter)');
      return;
    }
    if (!this.txtAbonado) {
      this.toast.warning('Validar', 'El número de abonado es obligatorio');
      return;
    }
    if (!this.txtNombreLlamante) {
      this.toast.warning('Validar', "El campo 'Llamante' es obligatorio");
      return;
    }
    if (!this.txtCodigCaso) {
      this.toast.warning('Validar', 'Debe seleccionar al menos un caso');
      return;
    }
    if (!this.txtDireCaso) {
      this.toast.warning('Validar', 'Debe ingresar la dirección del caso');
      return;
    }
    if (!this.txtComentario) {
      this.toast.warning('Validar', 'Debe ingresar la descripción del caso');
      return;
    }
    const canalesSel = this.canalesSeleccionados();
    if (canalesSel.length < 1) {
      this.toast.warning('Validar', 'Debe seleccionar al menos un canal de despacho');
      return;
    }

    const dto = this.buildDtoRecepcion('P', 'S', canalesSel);
    this.saving = true;

    this.svc.guardar(dto).subscribe({
      next: resp => {
        this.saving = false;
        if (resp.success) {
          this.toast.success('Recepción', resp.message);
          this.limpiarFormulario();
          this.reiniciarPoll();
        } else {
          this.toast.warning('Recepción', resp.message);
        }
      },
      error: () => { this.saving = false; this.toast.error('Recepción', 'Error de comunicación'); }
    });
  }

  // ── Quick-close ────────────────────────────────────────────────────────────

  cerrarRapido(comentarioBoton: string): void {
    const v = this.txtAbonado.trim();
    if (!v || v.length < 3 || v.length > 10) {
      this.toast.warning('Cerrar', 'Ingrese un número de abonado válido (3–10 dígitos)');
      return;
    }

    const doClose = () => {
      const dto = this.buildDtoRapido(comentarioBoton);
      this.svc.cerrarRapido(dto).subscribe({
        next: resp => {
          if (resp.success) {
            this.toast.success('Cerrar', resp.message);
            this.limpiarFormulario();
            this.reiniciarPoll();
          } else {
            this.toast.warning('Cerrar', resp.message);
          }
        },
        error: () => this.toast.error('Cerrar', 'Error de comunicación')
      });
    };

    if (!this.txtNumeLlamada) {
      this.consultarConsecutivo(doClose);
    } else {
      doClose();
    }
  }

  // ── Association modal ──────────────────────────────────────────────────────

  abrirModalAsociar(): void {
    if (!this.txtNumeLlamada) {
      this.toast.warning('Asociar', 'Debe haber una llamada activa');
      return;
    }
    const dto = {
      sitioGraba:  this.sitioGraba,
      horaCaso:    this.txtFechaIngreso,
      numeLlamada: Number(this.txtNumeLlamada)
    };
    this.svc.buscarAsociar(dto).subscribe({
      next: resp => {
        if (resp.success) {
          this.llamadasParaAsociar = resp.data ?? [];
          this.showModalAsociar    = true;
          this.cdr.detectChanges();
        } else {
          this.toast.warning('Asociar', resp.message || 'Sin llamadas disponibles');
        }
      },
      error: () => this.toast.error('Asociar', 'Error al consultar llamadas')
    });
  }

  cerrarModalAsociar(): void {
    this.showModalAsociar = false;
  }

  seleccionarAsociada(ll: DtoLlamadaAsociar): void {
    this.hdnNumeLlamadaAsociada = String(ll.NUME_LLAMADA);
    this.hdnSitioGrabaAsociada  = String(ll.SITIO_GRABA);
    this.txtAsociarLlamada      = `${ll.NUME_LLAMADA} - ${ll.CODI_PEDIDO} - ${ll.DIRE_CASO}`;
    this.showModalAsociar       = false;
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  toggleMinimize(): void { this.minimized = !this.minimized; }
  closePanel():    void { this.visible    = false; }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'A': return 'badge-activo';
      case 'C': return 'badge-cerrado';
      case 'P': return 'badge-pendiente';
      default:  return 'badge-default';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'A': return 'Activo';
      case 'C': return 'Cerrado';
      case 'P': return 'Pendiente';
      default:  return estado;
    }
  }

  // ── Canal → OrigenEvento mapping ─────────────────────────────────────────
  // Nota: los valores de Origen deben coincidir con el CHECK de cad_eventos.origen.
  // RADIO/CAMPO/SUPERVISION se registran como INTERNO hasta que el backend amplíe el constraint.

  private mapCanalOrigen(canal: string): OrigenEvento {
    switch (canal) {
      case 'TEL_123':     return 'CTI';
      case 'TEL_DIRECTO': return 'RECEPCION';
      case 'RADIO':       return 'INTERNO';
      case 'CAMPO':       return 'INTERNO';
      case 'SUPERVISION': return 'INTERNO';
      case 'TRASLADO':    return 'INTEGRACION';
      default:            return 'MANUAL';
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private obtenerFechaActual(): string {
    const now = new Date();
    const dd  = String(now.getDate()).padStart(2, '0');
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const yy  = now.getFullYear();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mi  = String(now.getMinutes()).padStart(2, '0');
    const ss  = String(now.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
  }

  private buildDtoRecepcion(estado: string, enviar: string, canalesSel: number[]): DtoRecepcion {
    return {
      SITIO_GRABA:           this.sitioGraba,
      NUME_LLAMADA:          Number(this.txtNumeLlamada) || 0,
      HORA_CASO:             this.txtFechaIngreso || this.obtenerFechaActual(),
      NUME_TELEFONO:         Number(this.txtAbonado) || 0,
      PROP_TELEFONO:         this.txtPropAbonado,
      NOMB_LLAMANTE:         this.txtNombreLlamante,
      DIRE_LLAMANTE:         this.txtDireLlamante,
      TIPO_PEDIDO:           this.tipoPedido,
      CALI_PEDIDO:           this.caliPedido,
      BARRIO:                this.txtBarrioCaso,
      CIUDAD:                this.txtCiudadCaso,
      DIRE_CASO:             this.txtDireCaso,
      LATITUD_CASO:          this.latitudCaso,
      LONGITUD_CASO:         this.longitudCaso,
      COMENTARIO:            this.txtComentario,
      CODI_PEDIDO:           this.txtCodigCaso,
      CODI_PEDIDO2:          this.txtCodigCaso2,
      IMPORTANCIA:           this.importancia,
      PRIORIDAD:             this.prioridad,
      DISP_TELEFONICO:       this.hdnCodDispTelefonico,
      OPERADOR:              this.hdnCeldaMarcacion,
      ESTADO:                estado,
      ENVIAR:                enviar,
      Origen:                this.mapCanalOrigen(this.canalOrigenUI),
      CANALES_SELECCIONADOS: canalesSel,
      CANAL_FUERZA:          this.fuerzaId || null,
      CADPEDI_SITIO_GRABA:   this.txtAsociarLlamada ? this.hdnSitioGrabaAsociada : null,
      CADPEDI_NUME_LLAMADA:  this.txtAsociarLlamada ? this.hdnNumeLlamadaAsociada : null
    };
  }

  private buildDtoRapido(comentario: string): DtoRecepcion {
    return {
      SITIO_GRABA:           this.sitioGraba,
      NUME_LLAMADA:          Number(this.txtNumeLlamada) || 0,
      HORA_CASO:             this.txtFechaIngreso || this.obtenerFechaActual(),
      NUME_TELEFONO:         Number(this.txtAbonado) || 0,
      PROP_TELEFONO:         this.txtPropAbonado,
      NOMB_LLAMANTE:         '',
      DIRE_LLAMANTE:         '',
      TIPO_PEDIDO:           '',
      CALI_PEDIDO:           '',
      BARRIO:                '',
      CIUDAD:                '',
      DIRE_CASO:             '',
      LATITUD_CASO:          '',
      LONGITUD_CASO:         '',
      COMENTARIO:            comentario,
      CODI_PEDIDO:           '900',
      CODI_PEDIDO2:          '',
      IMPORTANCIA:           '01',
      PRIORIDAD:             '01',
      DISP_TELEFONICO:       this.hdnCodDispTelefonico,
      OPERADOR:              this.hdnCeldaMarcacion,
      ESTADO:                'C',
      ENVIAR:                'N',
      Origen:                'RECEPCION',   // cierre rápido siempre es del operador
      CANALES_SELECCIONADOS: [],
      CANAL_FUERZA:          null,
      CADPEDI_SITIO_GRABA:   null,
      CADPEDI_NUME_LLAMADA:  null
    };
  }

  limpiarFormulario(): void {
    this.txtFechaIngreso   = '';
    this.txtNumeLlamada    = '';
    this.txtAbonado        = '';
    this.txtPropAbonado    = '';
    this.txtDispTelefonico = '';
    this.hdnCodDispTelefonico = '';
    this.hdnCeldaMarcacion    = '';
    this.txtNombreLlamante = '';
    this.txtDireLlamante   = '';
    this.txtCodigCaso      = '';
    this.txtDescaso        = '';
    this.txtCodigCaso2     = '';
    this.txtDescaso2       = '';
    this.txtCiudadCaso     = '';
    this.txtBarrioCaso     = '';
    this.txtDireCaso       = '';
    this.latitudCaso       = '';
    this.longitudCaso      = '';
    this.txtComentario     = '';
    this.txtAsociarLlamada = '';
    this.hdnNumeLlamadaAsociada = '';
    this.hdnSitioGrabaAsociada  = '';
    this.tipoPedido   = '';
    this.caliPedido   = '';
    this.prioridad      = '03';
    this.importancia    = '01';
    this.canalOrigenUI  = 'MANUAL';   // sin llamada activa → ingreso manual por defecto
    this.canales.forEach(c => c.seleccionado = false);
    this.llamadaEncontrada = false;
    // Solo retira el marcador de la llamada; las capas de municipio/cuadrantes se mantienen
    if (this.mapMarker && this.map) { this.map.removeLayer(this.mapMarker); this.mapMarker = null; }
    // Resetea el asistente para la próxima llamada
    this.resetAsistente();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  §6.17 Asistente Inteligente — métodos
  // ════════════════════════════════════════════════════════════════════════════

  toggleAsistente(): void {
    this.asistenteAbierto = !this.asistenteAbierto;
    if (this.asistenteAbierto && this.asistenteCategorias.length === 0) {
      this.cargarAsistenteCategorias();
    }
  }

  private cargarAsistenteCategorias(): void {
    this.asistenteLoadingCat = true;
    this.asistenteSvc.getCategorias(true).subscribe({
      next: (r) => {
        this.asistenteCategorias = r.data ?? [];
        this.asistenteLoadingCat = false;
      },
      error: () => {
        this.asistenteLoadingCat = false;
        this.toast.error('Asistente', 'No fue posible cargar las categorías.');
      }
    });
  }

  onAsistenteCategoriaChange(idCategoria: string): void {
    this.asistentePreguntas  = [];
    this.asistenteCategoriaSel = idCategoria;
    if (!idCategoria) return;

    this.asistenteLoadingPreg = true;
    this.asistenteSvc.getPreguntas(idCategoria, true).subscribe({
      next: (r) => {
        this.asistentePreguntas  = r.data ?? [];
        this.asistenteLoadingPreg = false;
      },
      error: () => {
        this.asistenteLoadingPreg = false;
        this.toast.error('Asistente', 'No fue posible cargar las preguntas.');
      }
    });
  }

  resetAsistente(): void {
    this.asistenteAbierto      = false;
    this.asistenteCategoriaSel = '';
    this.asistentePreguntas    = [];
    this.asistenteLoadingPreg  = false;
  }
}
