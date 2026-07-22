import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IntegracionesService,
  DtoIntegracionEntrante,
  DtoIntegracionEntranteRequest,
  DtoDespachoAuditoria,
  DtoRecepcionAuditoria,
  TIPOS_CANAL_ENTRANTE
} from '../../../core/services/administracion/integraciones.service';
import {
  AgenciaExternaService,
  DtoAgenciaExterna,
  DtoAgenciaExternaRequest,
  TIPOS_AGENCIA
} from '../../../core/services/operacion/agencia-externa.service';
import {
  CamaraIntegracionService,
  DtoCamaraIntegracion,
  DtoCamaraIntegracionRequest,
  DtoVmsDriverDescriptor
} from '../../../core/services/administracion/camara-integracion.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService }   from '../../../core/auth/auth.service';

type Tab     = 'salientes' | 'entrantes' | 'camaras' | 'auditoria';
type ModalT  = 'saliente-create' | 'saliente-edit'
             | 'entrante-create' | 'entrante-edit'
             | 'camara-create'   | 'camara-edit'
             | 'payload-viewer'  | null;

@Component({
  selector:    'app-integraciones',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './integraciones.html',
  styleUrls:   ['./integraciones.scss']
})
export class IntegracionesComponent implements OnInit {

  // ── Tab activa ──────────────────────────────────────────────────────────────
  tab: Tab = 'salientes';

  // ── Estado de carga ─────────────────────────────────────────────────────────
  loadingSal  = false;
  loadingEnt  = false;
  loadingAud  = false;
  saving      = false;

  // ── Tab Salientes ───────────────────────────────────────────────────────────
  salientes:    DtoAgenciaExterna[] = [];
  readonly tiposAgencia = TIPOS_AGENCIA;
  mostrarEjemploSal = false;

  // ── Ejemplos por modo de auth (strings en TS para evitar conflictos con {} en plantilla) ──
  readonly authModes = [
    { value: 'NONE'      as const, label: 'Sin auth',        icon: 'fa-ban'              },
    { value: 'BEARER'    as const, label: 'Bearer',          icon: 'fa-key'              },
    { value: 'BASIC'     as const, label: 'Basic Auth',      icon: 'fa-user-lock'        },
    { value: 'OAUTH2'    as const, label: 'OAuth2',          icon: 'fa-rotate'           },
    { value: 'API_KEY'   as const, label: 'API Key',         icon: 'fa-hashtag'          },
    { value: 'CREDS_BODY'as const, label: 'Creds en body',   icon: 'fa-file-code'        },
    { value: 'PIP_TOKEN' as const, label: 'PIP Institucional',icon: 'fa-shield-halved'   },
  ];
  formSalAuthExampleTab: 'NONE'|'BEARER'|'BASIC'|'OAUTH2'|'API_KEY'|'CREDS_BODY'|'PIP_TOKEN' = 'BEARER';

  readonly ejemploSalCabeceras = '{\n  "X-Sistema-Origen": "SECAD-POLICIA",\n  "X-Version": "2"\n}';
  readonly ejemploSalMapeo     = '{\n  "direCaso":      "direccion_emergencia",\n  "codiPedido":    "tipo_incidente",\n  "latitudCaso":   "gps.latitud",\n  "longitudCaso":  "gps.longitud",\n  "prioridad":     "nivel_urgencia",\n  "nomb_llamante": "reportado_por"\n}';

  readonly ejNone =
    'POST https://api.agencia.gov.co/casos/recibir\n' +
    'Content-Type: application/json\n\n' +
    '{ "direCaso": "Cra 7 # 32-16", "prioridad": "INMEDIATA", ... }';

  readonly ejBearer =
    'POST https://api.bomberos.bogota.gov.co/api/v2/casos/recibir\n' +
    'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…\n' +
    'Content-Type: application/json\n\n' +
    '{ "direccion_emergencia": "Cra 7 # 32-16", "nivel_urgencia": "INMEDIATA", ... }';

  readonly ejBasic =
    '# SECAD codifica: base64("bomberos_user:s3cr3t") = "Ym9tYmVyb3NfdXNlcjpzM2NyM3Q="\n\n' +
    'POST https://api.transito.gov.co/incidentes\n' +
    'Authorization: Basic Ym9tYmVyb3NfdXNlcjpzM2NyM3Q=\n' +
    'Content-Type: application/json\n\n' +
    '{ "direCaso": "Cra 7 # 32-16", "codiPedido": "310", ... }';

  readonly ejOAuth2 =
    '# PASO 1 — SECAD pide token automáticamente:\n' +
    'POST https://auth.agencia.gov.co/oauth2/token\n' +
    'Content-Type: application/x-www-form-urlencoded\n\n' +
    'grant_type=client_credentials&client_id=secad_client&client_secret=abc123\n\n' +
    '# Respuesta del servidor de auth:\n' +
    '{ "access_token": "eyJhbGci…", "token_type": "bearer", "expires_in": 3600 }\n\n' +
    '# PASO 2 — SECAD envía el caso con el token obtenido:\n' +
    'POST https://api.agencia.gov.co/casos/recibir\n' +
    'Authorization: Bearer eyJhbGci…\n' +
    'Content-Type: application/json\n\n' +
    '{ "direCaso": "Cra 7 # 32-16", "prioridad": "INMEDIATA", ... }';

  readonly ejApiKey =
    '# La agencia entrega una API Key; se envía en el header configurado:\n\n' +
    'POST https://api.cruzroja.org.co/emergencias/nueva\n' +
    'X-Api-Key: sk-cr-8f4a2c1e9b3d7f0e5a6c\n' +
    'Content-Type: application/json\n\n' +
    '{ "direCaso": "Cra 7 # 32-16", "prioridad": "INMEDIATA", ... }';

  readonly ejPip =
    '# SECAD usa automáticamente el token técnico institucional ya cacheado.\n' +
    '# No se configuran credenciales — el token se renueva solo cada 25 min.\n' +
    '# La URL debe ser el endpoint de PIP para esa integración.\n\n' +
    'POST https://internalpip.policia.gov.co:8080/api/{servicio}/{operacion}\n' +
    'Authorization: Bearer <token_tecnico_SECAD_en_PIP>  ← obtenido automáticamente\n' +
    'Content-Type: application/json\n\n' +
    '{ "direCaso": "Cra 7 # 32-16", "prioridad": "INMEDIATA", ... }\n\n' +
    '# PIP luego reenvía a la agencia externa con las credenciales\n' +
    '# que el equipo de PIP configuró en su plataforma.\n\n' +
    '# Para configurar esta agencia necesitas:\n' +
    '#  1. Solicitar al equipo de PIP el endpoint para la integración\n' +
    '#  2. Pegar esa URL en el campo "URL del endpoint"\n' +
    '#  3. Seleccionar modo "PIP — Canal institucional"\n' +
    '#  4. PIP maneja la auth con la agencia — no configuras nada más';

  readonly ejCredsBody =
    '# Las credenciales van dentro del body del caso (sin cabecera Authorization):\n' +
    '# Configura los nombres de campo que espera la agencia.\n\n' +
    'POST https://api.defensa.civil.co/recibir-emergencia\n' +
    'Content-Type: application/json\n\n' +
    '{\n' +
    '  "usuario":    "secad_despacho",\n' +
    '  "contrasena": "s3cr3t_key",\n' +
    '  "direCaso":   "Cra 7 # 32-16",\n' +
    '  "prioridad":  "INMEDIATA",\n' +
    '  ...\n' +
    '}';

  formSal:  DtoAgenciaExternaRequest = this.emptySal();
  formSalCabeceras   = '';
  formSalMapeo       = '';
  editSalId          = '';

  // ── Campos de auth descompuestos (se serializan a authExtra al guardar) ────
  formSalTokenUrl      = '';   // OAUTH2
  formSalKeyHeader     = 'X-Api-Key';  // API_KEY
  formSalBodyUserField = 'usuario';    // CREDS_BODY
  formSalBodyPassField = 'contrasena'; // CREDS_BODY

  // ── Tab Entrantes ───────────────────────────────────────────────────────────
  entrantes:    DtoIntegracionEntrante[] = [];
  readonly tiposCanal = TIPOS_CANAL_ENTRANTE;

  formEnt:  DtoIntegracionEntranteRequest = this.emptyEnt();
  formEntHeaders  = '';
  formEntPayload  = '';
  editEntId       = '';

  // ── Tab Cámaras (integraciones VMS) ─────────────────────────────────────────
  camaras:        DtoCamaraIntegracion[] = [];
  loadingCam      = false;
  drivers:        DtoVmsDriverDescriptor[] = [];
  /** Driver seleccionado en el formulario (para pintar sus campos). */
  camDriver:      DtoVmsDriverDescriptor | null = null;
  /** Valores del formulario dinámico (config + secretos), por key de campo. */
  camForm:        Record<string, string> = {};
  camNombre       = '';
  camDescripcion  = '';
  camActiva       = true;
  editCamId       = '';
  camPrueba       = '';        // resultado de "validar configuración"

  // ── Tab Auditoría ───────────────────────────────────────────────────────────
  audTab:       'salientes' | 'entrantes' = 'salientes';
  audSalientes: DtoDespachoAuditoria[]   = [];
  audEntrantes: DtoRecepcionAuditoria[]  = [];
  audSalLimit   = 50;
  audEntLimit   = 50;
  audCanalFiltro = '';

  // ── Modal ───────────────────────────────────────────────────────────────────
  modal: ModalT = null;
  payloadViewer      = '';
  payloadViewerTitle = 'Payload JSON';  // se cambia al abrir cada modal

  /** cod_dane del usuario logueado — se embebe en la callbackUrl del preview. */
  private readonly codDane: string;

  constructor(
    private svc:        IntegracionesService,
    private agSvc:      AgenciaExternaService,
    private camSvc:     CamaraIntegracionService,
    private toast:      ToastService,
    private auth:       AuthService
  ) {
    this.codDane = this.auth.getJwtClaims().codDane ?? '';
  }

  ngOnInit(): void {
    this.loadSalientes();
    this.loadEntrantes();
  }

  // ── Navegación de tabs ──────────────────────────────────────────────────────

  setTab(t: Tab): void {
    this.tab = t;
    if (t === 'auditoria' && !this.audSalientes.length && !this.audEntrantes.length)
      this.loadAuditoria();
    if (t === 'camaras') {
      if (!this.drivers.length) this.loadDrivers();
      this.loadCamaras();
    }
  }

  setAudTab(t: 'salientes' | 'entrantes'): void {
    this.audTab = t;
    if (t === 'salientes' && !this.audSalientes.length) this.loadAudSalientes();
    if (t === 'entrantes' && !this.audEntrantes.length) this.loadAudEntrantes();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TAB SALIENTES
  // ════════════════════════════════════════════════════════════════════════════

  loadSalientes(): void {
    this.loadingSal = true;
    this.svc.getSalientes().subscribe({
      next:  d => { this.salientes = d; this.loadingSal = false; },
      error: () => { this.loadingSal = false; this.toast.error('Error', 'No se pudieron cargar las agencias.'); }
    });
  }

  openCreateSal(): void {
    this.formSal              = this.emptySal();
    this.formSalCabeceras     = '';
    this.formSalMapeo         = '';
    this.formSalTokenUrl      = '';
    this.formSalKeyHeader     = 'X-Api-Key';
    this.formSalBodyUserField = 'usuario';
    this.formSalBodyPassField = 'contrasena';
    this.editSalId            = '';
    this.modal                = 'saliente-create';
    document.body.classList.add('ui-modal-open');
  }

  openEditSal(a: DtoAgenciaExterna): void {
    this.editSalId = a.id;
    // Deserializar authExtra para los campos individuales
    const extra = this.parseAuthExtra(a.authExtra);
    this.formSalTokenUrl      = extra['tokenUrl']      ?? '';
    this.formSalKeyHeader     = extra['keyHeader']     ?? 'X-Api-Key';
    this.formSalBodyUserField = extra['bodyUserField'] ?? 'usuario';
    this.formSalBodyPassField = extra['bodyPassField'] ?? 'contrasena';
    this.formSal = {
      nombre:         a.nombre,
      descripcion:    a.descripcion ?? '',
      tipoAgencia:    a.tipoAgencia,
      apiUrl:         a.apiUrl ?? '',
      apiMetodo:      a.apiMetodo,
      tipoAuth:       a.tipoAuth ?? 'BEARER',
      apiToken:       '',         // vacío = mantener existente
      apiUsuario:     a.apiUsuario ?? '',
      apiPassword:    '',         // vacío = mantener existente
      apiCabeceras:   a.apiCabeceras ?? '',
      campoMapeo:     a.campoMapeo ?? '',
      formatoPayload: a.formatoPayload ?? 'PLANO',
      activa:         a.activa,
    };
    this.formSalCabeceras = a.apiCabeceras ?? '';
    this.formSalMapeo     = a.campoMapeo ?? '';
    this.modal            = 'saliente-edit';
    document.body.classList.add('ui-modal-open');
  }

  saveSal(): void {
    if (!this.formSal.nombre.trim())
      return void this.toast.warning('Validar', 'El nombre es obligatorio.');

    if (this.formSalCabeceras.trim() && !this.isValidJson(this.formSalCabeceras))
      return void this.toast.warning('JSON inválido', 'Las cabeceras HTTP no son un JSON válido.');
    if (this.formSalMapeo.trim() && !this.isValidJson(this.formSalMapeo))
      return void this.toast.warning('JSON inválido', 'El mapeo de campos no es un JSON válido.');

    this.formSal.apiCabeceras = this.formSalCabeceras.trim() || undefined;
    this.formSal.campoMapeo   = this.formSalMapeo.trim()     || undefined;
    // Serializar campos específicos de auth extra
    this.formSal.authExtra    = this.buildAuthExtra();

    this.saving = true;
    const obs = this.editSalId
      ? this.svc.actualizarSaliente(this.editSalId, this.formSal)
      : this.svc.crearSaliente(this.formSal);

    obs.subscribe({
      next: r => {
        this.saving = false;
        if (r.success) {
          this.toast.success('Agencia', r.message);
          this.closeModal();
          this.loadSalientes();
        } else {
          this.toast.warning('Agencia', r.message);
        }
      },
      error: () => { this.saving = false; this.toast.error('Error', 'No se pudo guardar.'); }
    });
  }

  toggleSal(a: DtoAgenciaExterna): void {
    this.svc.toggleSaliente(a.id).subscribe({
      next: r => {
        if (r.success) { this.toast.success('Agencia', r.message); this.loadSalientes(); }
        else this.toast.warning('Agencia', r.message);
      },
      error: () => this.toast.error('Error', 'No se pudo cambiar el estado.')
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TAB ENTRANTES
  // ════════════════════════════════════════════════════════════════════════════

  loadEntrantes(): void {
    this.loadingEnt = true;
    this.svc.getEntrantes().subscribe({
      next:  r => { this.entrantes = r.data ?? []; this.loadingEnt = false; },
      error: () => { this.loadingEnt = false; this.toast.error('Error', 'No se pudieron cargar las integraciones entrantes.'); }
    });
  }

  openCreateEnt(): void {
    this.formEnt        = this.emptyEnt();
    this.formEntHeaders = '';
    this.formEntPayload = '';
    this.editEntId      = '';
    this.modal          = 'entrante-create';
    document.body.classList.add('ui-modal-open');
  }

  openEditEnt(e: DtoIntegracionEntrante): void {
    this.editEntId = e.id;
    this.formEnt = {
      nombre:            e.nombre,
      descripcion:       e.descripcion ?? '',
      tipoCanal:         e.tipoCanal,
      endpointRelativo:  e.endpointRelativo,
      headersRequeridos: e.headersRequeridos ?? '',
      ejemploPayload:    e.ejemploPayload ?? '',
      sitioGrabaDefecto: e.sitioGrabaDefecto,
      activa:            e.activa,
      notas:             e.notas ?? '',
    };
    this.formEntHeaders = e.headersRequeridos ?? '';
    this.formEntPayload = e.ejemploPayload ?? '';
    this.modal          = 'entrante-edit';
    document.body.classList.add('ui-modal-open');
  }

  saveEnt(): void {
    if (!this.formEnt.nombre.trim())
      return void this.toast.warning('Validar', 'El nombre es obligatorio.');
    if (!this.formEnt.endpointRelativo.trim())
      return void this.toast.warning('Validar', 'El endpoint es obligatorio.');
    if (this.formEntHeaders.trim() && !this.isValidJson(this.formEntHeaders))
      return void this.toast.warning('JSON inválido', 'Los headers requeridos no son un JSON válido.');
    if (this.formEntPayload.trim() && !this.isValidJson(this.formEntPayload))
      return void this.toast.warning('JSON inválido', 'El payload de ejemplo no es un JSON válido.');

    this.formEnt.headersRequeridos = this.formEntHeaders.trim() || undefined;
    this.formEnt.ejemploPayload    = this.formEntPayload.trim() || undefined;

    this.saving = true;
    const obs = this.editEntId
      ? this.svc.actualizarEntrante(this.editEntId, this.formEnt)
      : this.svc.crearEntrante(this.formEnt);

    obs.subscribe({
      next: r => {
        this.saving = false;
        if (r.success) {
          this.toast.success('Integración', r.message);
          this.closeModal();
          this.loadEntrantes();
        } else {
          this.toast.warning('Integración', r.message);
        }
      },
      error: () => { this.saving = false; this.toast.error('Error', 'No se pudo guardar.'); }
    });
  }

  toggleEnt(e: DtoIntegracionEntrante): void {
    this.svc.toggleEntrante(e.id).subscribe({
      next: r => {
        if (r.success) { this.toast.success('Integración', r.message); this.loadEntrantes(); }
        else this.toast.warning('Integración', r.message);
      },
      error: () => this.toast.error('Error', 'No se pudo cambiar el estado.')
    });
  }

  verEjemplo(e: DtoIntegracionEntrante): void {
    this.payloadViewer = e.ejemploPayload
      ? this.prettyJson(e.ejemploPayload)
      : '{}';
    this.modal = 'payload-viewer';
    document.body.classList.add('ui-modal-open');
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TAB CÁMARAS (integraciones VMS)
  // ════════════════════════════════════════════════════════════════════════════

  loadDrivers(): void {
    this.camSvc.getDrivers().subscribe({
      next:  d => { this.drivers = d; },
      error: () => { this.toast.error('Error', 'No se pudieron cargar los drivers de VMS.'); }
    });
  }

  loadCamaras(): void {
    this.loadingCam = true;
    this.camSvc.getAll().subscribe({
      next:  d => { this.camaras = d; this.loadingCam = false; },
      error: () => { this.loadingCam = false; this.toast.error('Error', 'No se pudieron cargar las integraciones de cámaras.'); }
    });
  }

  /** Campo actual del driver seleccionado (para el template). */
  get camCampos() { return this.camDriver?.campos ?? []; }

  onCamDriverChange(driverId: string): void {
    this.camDriver = this.drivers.find(d => d.driver === driverId) ?? null;
    // Reiniciar valores del formulario a los campos del nuevo driver.
    this.camForm = {};
    for (const c of this.camDriver?.campos ?? []) this.camForm[c.key] = '';
  }

  openCreateCam(): void {
    this.editCamId      = '';
    this.camNombre      = '';
    this.camDescripcion = '';
    this.camActiva      = true;
    this.camPrueba      = '';
    this.camDriver      = null;
    this.camForm        = {};
    if (!this.drivers.length) this.loadDrivers();
    this.modal = 'camara-create';
    document.body.classList.add('ui-modal-open');
  }

  openEditCam(c: DtoCamaraIntegracion): void {
    this.editCamId      = c.id;
    this.camNombre      = c.nombre;
    this.camDescripcion = c.descripcion ?? '';
    this.camActiva      = c.activa;
    this.camPrueba      = '';
    this.camDriver      = this.drivers.find(d => d.driver === c.driver) ?? null;
    // Cargar valores no secretos; los secretos quedan vacíos (write-only).
    this.camForm = {};
    for (const campo of this.camDriver?.campos ?? [])
      this.camForm[campo.key] = campo.secreto ? '' : (c.config[campo.key] ?? '');
    this.modal = 'camara-edit';
    document.body.classList.add('ui-modal-open');
  }

  /** Arma el request separando config (no secreto) de secretos. */
  private buildCamRequest(): DtoCamaraIntegracionRequest {
    const config: Record<string, string> = {};
    const secretos: Record<string, string> = {};
    for (const campo of this.camDriver?.campos ?? []) {
      const v = (this.camForm[campo.key] ?? '').trim();
      if (campo.secreto) { if (v) secretos[campo.key] = v; }
      else               { config[campo.key] = v; }
    }
    return {
      nombre:      this.camNombre.trim(),
      descripcion: this.camDescripcion.trim() || undefined,
      driver:      this.camDriver?.driver ?? '',
      config,
      secretos,
      activa:      this.camActiva
    };
  }

  probarCam(): void {
    if (!this.camDriver) { this.toast.warning('Cámaras', 'Seleccione un driver.'); return; }
    this.camSvc.validar(this.buildCamRequest()).subscribe({
      next:  r => { this.camPrueba = r.mensaje; if (r.ok) this.toast.success('Validación', r.mensaje); else this.toast.warning('Validación', r.mensaje); },
      error: e => { this.camPrueba = e.error?.mensaje ?? 'Error al validar.'; }
    });
  }

  saveCam(): void {
    if (!this.camNombre.trim()) { this.toast.warning('Cámaras', 'El nombre es obligatorio.'); return; }
    if (!this.camDriver)        { this.toast.warning('Cámaras', 'Seleccione un driver.'); return; }
    this.saving = true;
    const req = this.buildCamRequest();
    const obs = this.editCamId
      ? this.camSvc.actualizar(this.editCamId, req)
      : this.camSvc.crear(req);
    obs.subscribe({
      next: r => {
        this.saving = false;
        if (r.success) { this.toast.success('Cámaras', r.message); this.closeModal(); this.loadCamaras(); }
        else           { this.toast.warning('Cámaras', r.message); }
      },
      error: e => { this.saving = false; this.toast.error('Cámaras', e.error?.message ?? 'Error al guardar.'); }
    });
  }

  toggleCam(c: DtoCamaraIntegracion): void {
    this.camSvc.toggle(c.id).subscribe({
      next:  () => { c.activa = !c.activa; },
      error: () => { this.toast.error('Cámaras', 'No se pudo cambiar el estado.'); }
    });
  }

  deleteCam(c: DtoCamaraIntegracion): void {
    if (!confirm(`¿Eliminar la integración de cámaras "${c.nombre}"? Esto también quita su catálogo de cámaras.`)) return;
    this.camSvc.eliminar(c.id).subscribe({
      next:  r => { if (r.success) { this.toast.success('Cámaras', r.message); this.loadCamaras(); } },
      error: () => { this.toast.error('Cámaras', 'No se pudo eliminar.'); }
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TAB AUDITORÍA
  // ════════════════════════════════════════════════════════════════════════════

  loadAuditoria(): void {
    this.loadAudSalientes();
    this.loadAudEntrantes();
  }

  loadAudSalientes(): void {
    this.loadingAud = true;
    this.svc.getAuditoriaSalientes(this.audSalLimit).subscribe({
      next:  r => { this.audSalientes = r.data ?? []; this.loadingAud = false; },
      error: () => { this.loadingAud = false; }
    });
  }

  loadAudEntrantes(): void {
    this.loadingAud = true;
    this.svc.getAuditoriaEntrantes(this.audEntLimit, this.audCanalFiltro || undefined).subscribe({
      next:  r => { this.audEntrantes = r.data ?? []; this.loadingAud = false; },
      error: () => { this.loadingAud = false; }
    });
  }

  verPayload(json: string | null): void {
    this.payloadViewerTitle = 'Payload enviado → agencia externa';
    this.payloadViewer = json ? this.prettyJson(json) : '{}';
    this.modal = 'payload-viewer';
    document.body.classList.add('ui-modal-open');
  }

  verRespuestaApi(d: DtoDespachoAuditoria): void {
    this.payloadViewerTitle =
      `Respuesta API — ${d.agenciaNombre} · HTTP ${d.httpStatus ?? '—'}`;
    this.payloadViewer = d.respuestaApi
      ? this.prettyJson(d.respuestaApi)
      : '(sin respuesta)';
    this.modal = 'payload-viewer';
    document.body.classList.add('ui-modal-open');
  }

  /** Recorta la respuesta de la API para mostrarla inline en la tabla. */
  snippetRespuesta(resp: string | null, max = 120): string {
    if (!resp) return '';
    const s = resp.replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  /** Muestra el payload REAL que SECAD enviaría a esta agencia, con el mapeo aplicado. */
  verPayloadSaliente(a: DtoAgenciaExterna): void {
    this.payloadViewerTitle = `Payload que SECAD envía → ${a.nombre}`;
    this.payloadViewer      = this.generarPayloadSaliente(a);
    this.modal              = 'payload-viewer';
    document.body.classList.add('ui-modal-open');
  }

  /** Etiqueta legible del modo de autenticación. */
  labelAuthMode(mode: string): string {
    const labels: Record<string, string> = {
      NONE: 'Sin auth', BEARER: 'Bearer', BASIC: 'Basic Auth',
      OAUTH2: 'OAuth2', API_KEY: 'API Key',
      CREDS_BODY: 'Creds en body', PIP_TOKEN: 'PIP Institucional'
    };
    return labels[mode] ?? mode;
  }

  /** Genera el cuerpo HTTP completo (headers + JSON body) que SECAD enviaría a la agencia,
   *  con datos de ejemplo realistas y el campo_mapeo real aplicado. */
  private generarPayloadSaliente(a: DtoAgenciaExterna): string {
    const ts  = new Date().toISOString().slice(0, 19) + '-05:00';
    const url = a.apiUrl || 'https://api.agencia.gov.co/recibir-caso';
    const extra = this.parseAuthExtra(a.authExtra ?? null);

    // ── 1. Líneas de request ──────────────────────────────────────────────────
    const lines: string[] = [`${a.apiMetodo} ${url}`];

    switch ((a.tipoAuth ?? 'BEARER').toUpperCase()) {
      case 'BEARER':
        lines.push('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…');
        break;
      case 'BASIC':
        lines.push('Authorization: Basic ' +
          btoa(`${a.apiUsuario || 'usuario'}:<contraseña>`));
        break;
      case 'OAUTH2':
        lines.push('Authorization: Bearer <token_obtenido_de_tokenUrl>');
        if (extra['tokenUrl'])
          lines.push(`# Token obtenido de: ${extra['tokenUrl']}`);
        break;
      case 'API_KEY':
        lines.push(`${extra['keyHeader'] || 'X-Api-Key'}: <api_key_configurada>`);
        break;
      case 'PIP_TOKEN':
        lines.push('Authorization: Bearer <token_técnico_institucional_PIP>');
        break;
      case 'NONE':
        lines.push('# Sin cabecera de autenticación');
        break;
    }

    lines.push('Content-Type: application/json');

    if (a.apiCabeceras) {
      try {
        const cabs: Record<string, string> = JSON.parse(a.apiCabeceras);
        for (const [k, v] of Object.entries(cabs)) lines.push(`${k}: ${v}`);
      } catch { /* cabeceras malformadas */ }
    }

    lines.push(''); // línea en blanco antes del body

    // ── 2. Campos planos del pedido (mismos nombres que el backend) ───────────
    const casoFlat: Record<string, unknown> = {
      id:               '1234567890123456789',
      sitioGraba:       1,
      horaCaso:         ts,
      fechaCreacion:    ts,
      fechaPrimerAcceso: ts,
      codiPedido:       '310',
      codiPedido2:      null,
      tipoPedido:       'INCIDENTE',
      caliPedido:       'REAL',
      importancia:      '01',
      prioridad:        'INMEDIATA',
      estado:           'A',
      descripcion:      'Ciudadano reporta incendio en bodega',
      nombLlamante:     'Juan Gómez',
      numeTelefono:     '3001234567',
      propTelefono:     'Juan Gómez',
      direLlamante:     'Cra 7 # 32-16',
      barrio:           'Chapinero',
      ciudad:           'Bogotá',
      direCaso:         'Cra 7 # 32-16, Chapinero',
      latitudCaso:      '4.6451',
      longitudCaso:     '-74.0624',
      cordX:            null,
      cordY:            null,
      dispTelefonico:   null,
      celdaMarcacion:   null,
      descCaso:         'Incendio en estructura habitacional',
    };

    // ── 3. Aplicar campo_mapeo y filtrar nulos (igual que el backend) ──────────
    const camposMapeadosRaw = this.aplicarMapeoFront(casoFlat, a.campoMapeo);
    const camposMapeados    = this.filtrarNulos(camposMapeadosRaw);

    // ── 4. Construir body según formato configurado en la agencia ─────────────
    let body: Record<string, unknown>;

    const codDaneSufijo = this.codDane ? `?codDane=${this.codDane}` : '';
    if ((a.formatoPayload ?? 'PLANO') === 'ESTRUCTURADO') {
      // ESTRUCTURADO: body jerárquico completo con _secad, caso, ubicacion, etc.
      body = {
        _secad: {
          version:       '2.0',
          sistemaOrigen: 'SECAD',
          timestamp:     ts,
          callbackUrl:   `https://secad.policia.gov.co/api/ActualizacionExterna/1234567890123456789${codDaneSufijo}`
        },
        caso: {
          id:               '1234567890123456789',
          sitioGraba:       1,
          codigoCaso:       '310',
          descripcionCaso:  'Incendio en estructura habitacional',
          tipoCaso:         'INCIDENTE',
          prioridad:        'INMEDIATA',
          calidad:          'REAL',
          estado:           'A',
          horaCaso:         ts,
          fechaCreacion:    ts,
          fechaPrimerAcceso: ts,
          descripcion:      'Ciudadano reporta incendio en bodega'
        },
        ubicacion: {
          direccion: 'Cra 7 # 32-16, Chapinero',
          barrio:    'Chapinero',
          ciudad:    'Bogotá',
          latitud:   '4.6451',
          longitud:  '-74.0624'
        },
        reportante: {
          nombre:              'Juan Gómez',
          telefono:            '3001234567',
          propietarioTelefono: 'Juan Gómez',
          direccion:           'Cra 7 # 32-16'
        },
        despacho: {
          eventoId:      '9876543210987654321',
          origen:        'RECEPCION',
          fuerzaId:      65920007,
          fuerza:        'Policía Metropolitana Bogotá',
          estado:        'D',
          despachador:   'OPC-001',
          fechaDespacho: ts
        },
        actuaciones: [{
          fuerza:        'Policía',
          canal:         'CAI Centro',
          unidad:        'PTL-001',
          placa:         'ABC123',
          estado:        'D',
          fechaDespacho: ts
        }],
        camposMapeados
      };
    } else {
      // PLANO (default): _secad para callback bidireccional + campos del caso sin nulos
      const codDaneSufijo = this.codDane ? `?codDane=${this.codDane}` : '';
      body = {
        _secad: {
          version:       '2.0',
          sistemaOrigen: 'SECAD',
          timestamp:     ts,
          callbackUrl:   `https://secad.policia.gov.co/api/ActualizacionExterna/1234567890123456789${codDaneSufijo}`
        },
        ...camposMapeados
      };
    }

    // CREDS_BODY: inyectar credenciales en el body (aplica a ambos formatos)
    if ((a.tipoAuth ?? '').toUpperCase() === 'CREDS_BODY') {
      body[extra['bodyUserField'] || 'usuario']    = a.apiUsuario || '<usuario>';
      body[extra['bodyPassField'] || 'contrasena'] = '<contraseña>';
    }

    lines.push(JSON.stringify(body, null, 2));
    return lines.join('\n');
  }

  /** Elimina claves con valor null/undefined — espeja el comportamiento del backend. */
  private filtrarNulos(campos: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== null && v !== undefined)
    );
  }

  /** Aplica el campo_mapeo: renombra las claves del objeto según la configuración. */
  private aplicarMapeoFront(
    campos: Record<string, unknown>,
    mapeoJson: string | null | undefined
  ): Record<string, unknown> {
    if (!mapeoJson?.trim()) return { ...campos };
    try {
      const mapeo: Record<string, string> = JSON.parse(mapeoJson);
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(campos)) {
        const dest = (mapeo[k]?.trim()) ? mapeo[k] : k;
        result[dest] = v;
      }
      return result;
    } catch { return { ...campos }; }
  }

  // ── Modal helpers ────────────────────────────────────────────────────────────

  closeModal(): void {
    this.modal = null;
    document.body.classList.remove('ui-modal-open');
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────

  getTipoAgenciaLabel  = (t: string) => this.agSvc.getTipoLabel(t);
  getTipoAgenciaIcon   = (t: string) => this.agSvc.getTipoIcon(t);
  getTipoCanalLabel    = (t: string) => this.svc.getTipoCanalLabel(t);
  getTipoCanalIcon     = (t: string) => this.svc.getTipoCanalIcon(t);
  getStatusClass       = (s: number | null) => this.svc.getHttpStatusClass(s);

  isValidJson(s: string): boolean {
    try { JSON.parse(s); return true; } catch { return false; }
  }

  prettyJson(s: string): string {
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  }

  // ── Builders ──────────────────────────────────────────────────────────────────

  private emptySal(): DtoAgenciaExternaRequest {
    return { nombre: '', descripcion: '', tipoAgencia: 'OTRA',
             apiUrl: '', apiMetodo: 'POST',
             tipoAuth: 'BEARER', apiToken: '', apiUsuario: '', apiPassword: '',
             formatoPayload: 'PLANO',
             activa: true };
  }

  /** Serializa los campos individuales de authExtra al JSON que espera el backend. */
  private buildAuthExtra(): string | undefined {
    const mode = this.formSal.tipoAuth;
    const obj: Record<string, string> = {};
    if (mode === 'OAUTH2'     && this.formSalTokenUrl.trim())
      obj['tokenUrl']      = this.formSalTokenUrl.trim();
    if (mode === 'API_KEY'    && this.formSalKeyHeader.trim())
      obj['keyHeader']     = this.formSalKeyHeader.trim();
    if (mode === 'CREDS_BODY') {
      if (this.formSalBodyUserField.trim()) obj['bodyUserField'] = this.formSalBodyUserField.trim();
      if (this.formSalBodyPassField.trim()) obj['bodyPassField'] = this.formSalBodyPassField.trim();
    }
    return Object.keys(obj).length ? JSON.stringify(obj) : undefined;
  }

  /** Deserializa authExtra JSON a un objeto plano para rellenar los campos del form. */
  private parseAuthExtra(json: string | null): Record<string, string> {
    if (!json) return {};
    try { return JSON.parse(json); } catch { return {}; }
  }

  private emptyEnt(): DtoIntegracionEntranteRequest {
    return { nombre: '', descripcion: '', tipoCanal: 'OTRA',
             endpointRelativo: '', sitioGrabaDefecto: 0, activa: true };
  }
}
