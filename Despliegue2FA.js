Guía de Implementación 2FA en Otros Sistemas
Contexto y arquitectura
El Api2FA ya existe y está desplegado. Cada nuevo sistema solo consume ese servicio — no implementa lógica TOTP propia. El trabajo en cada sistema nuevo se divide en:

Api2FA (centralizado, ya existe)
    ↑  JWT de sistema (HMAC firmado)
    ↓  State / Enroll / Verify / Reset
Sistema X (nuevo)
  Backend: 4 archivos nuevos + 2 modificados
  Frontend: 1 servicio nuevo + 2 archivos modificados
FASE 0 — Prerrequisitos (antes de tocar código)
0.1 Información que debes obtener del equipo de Api2FA
Antes de empezar pide por escrito:

Dato	Ejemplo	Para qué
URL base del Api2FA	https://api2fa.policia.gov.co	Mfa:ApiBaseUrl
Nombre del sistema	MIAPP	Mfa:Sistema
Secreto HMAC del sistema	aB3x...64chars	Mfa:HmacSecret
El equipo de Api2FA debe agregar en su appsettings.json:

"SistemasConfiables": {
    "MIAPP": "<mismo_secreto_que_te_dieron>"
}
0.2 Verificar que el Api2FA responde
# Prueba rápida (debe devolver 400 o 401, no Connection Refused)
Invoke-WebRequest -Uri "https://api2fa.policia.gov.co/api/Token/TokenSistema" -Method POST
FASE 1 — Backend C# (.NET 8)
Paso 1 — Copiar los 4 archivos de infraestructura MFA
Estos 4 archivos son idénticos en todos los sistemas. Copialos directamente del proyecto SECAD:

📁 SECAD (origen)
  backend/oftic/oftic.sl/ApiInterfaz/IMfaCentralService.cs  → copiar tal cual
  backend/oftic/oftic.sl/Api/MfaCentralService.cs           → copiar tal cual
  backend/oftic/oftic/Services/MfaSessionTokenService.cs    → copiar tal cual
  backend/oftic/oftic.cl/Dtos/Auth/DtoMfaAuth.cs            → copiar tal cual
En el sistema destino pégalos en la carpeta equivalente de cada capa:

📁 Sistema X (destino)
  [CapaServicios]/ApiInterfaz/IMfaCentralService.cs
  [CapaServicios]/Api/MfaCentralService.cs
  [CapaWeb]/Services/MfaSessionTokenService.cs
  [CapaComun]/Dtos/Auth/DtoMfaAuth.cs
⚠️ Ajusta el namespace en cada archivo para que coincida con el del sistema destino. Busca y reemplaza Servicios.Api / Servicios.ApiInterfaz / Comun.Dtos / Api.Services por los namespaces correctos del sistema X.

Paso 2 — Agregar paquetes NuGet
En el proyecto de la capa de servicios (donde está MfaCentralService.cs):

<!-- En el .csproj de la capa de servicios -->
<PackageReference Include="Microsoft.Extensions.Caching.Memory"        Version="8.0.0" />
<PackageReference Include="Microsoft.Extensions.Logging.Abstractions"  Version="8.0.0" />
<PackageReference Include="Microsoft.Extensions.Http"                  Version="8.0.0" />
En el proyecto web/API (donde está MfaSessionTokenService.cs):

<!-- Ya debería tener este paquete si usa JWT -->
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.0.0" />
Paso 3 — Agregar configuración (appsettings.json)
En el appsettings.json del proyecto web agrega:

"Mfa": {
  "Enabled": true,
  "ApiBaseUrl": "https://url-del-api2fa.policia.gov.co",
  "Sistema": "NOMBRE_SISTEMA_REGISTRADO",
  "HmacSecret": "SECRETO_HMAC_QUE_TE_DIO_EL_EQUIPO_API2FA",
  "AllowLoginOnServiceDown": false
}
Para desarrollo local crea o modifica appsettings.Development.json:

"Mfa": {
  "Enabled": false
}
Esto permite desarrollar sin necesitar el Api2FA activo.

Paso 4 — Registrar los servicios (Program.cs)
Agrega estas líneas después de builder.Services.AddMemoryCache():

// ── MFA / 2FA ─────────────────────────────────────────────────────────────
builder.Services.AddHttpClient<IMfaCentralService, MfaCentralService>(c =>
    c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddSingleton<MfaSessionTokenService>();
Si AddMemoryCache() no está, agrégalo antes: builder.Services.AddMemoryCache();

Paso 5 — Modificar el controlador de login
Este es el único archivo existente que se modifica. El patrón es siempre el mismo, independientemente de cómo se llame el controlador:

5.1 — Inyectar los servicios MFA en el constructor:

// Agregar estas dos propiedades privadas
private readonly IMfaCentralService    _mfa;
private readonly MfaSessionTokenService _mfaSession;

// Agregarlas al constructor
public MiLoginController(
    /* ... parámetros existentes ..., */
    IMfaCentralService mfa,
    MfaSessionTokenService mfaSession)
{
    /* ... asignaciones existentes ... */
    _mfa        = mfa;
    _mfaSession = mfaSession;
}
5.2 — En el método de login, después de validar credenciales y antes de emitir el JWT:

Ubica el punto exacto donde el sistema emite el token (busca algo como return Ok(new { token = jwtToken })). Justo antes de esa línea inserta:

// ── DOBLE AUTENTICACIÓN ──────────────────────────────────────────────────
if (_configuration.GetValue<bool>("Mfa:Enabled") && !esCivilUser)
{
    long identificacion = idUsuario; // cedula del funcionario, o id del usuario

    var mfaState = await _mfa.GetStateAsync(identificacion, usuario, ct);

    if (mfaState.ServiceDown)
    {
        if (!_configuration.GetValue<bool>("Mfa:AllowLoginOnServiceDown"))
            return Ok(new DtoMfaLoginResponse
            {
                success = false, RequiresMfa = true, MfaMode = "svcdown",
                message = "Servicio 2FA no disponible."
            });
        // Si AllowLoginOnServiceDown=true continúa sin MFA
    }
    else
    {
        // Bloqueado
        if (mfaState.BloqueoHasta.HasValue && mfaState.BloqueoHasta.Value > DateTime.Now)
            return Ok(BuildMfaChallenge(idUsuario, usuario, /* datos para el JWT */,
                mfaMode: "blocked",
                bloqueoHasta: mfaState.BloqueoHasta.Value.ToString("yyyy-MM-dd HH:mm:ss")));

        // Dispositivo confiable
        var deviceId = Request.Cookies["SISTEMA_MFA_DEVICE"];
        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            if (await _mfa.IsTrustedAsync(identificacion, usuario, deviceId, ct))
                goto SkipMfa; // dispositivo confiable → emitir JWT
        }

        // No enrolado → iniciar enrolamiento
        if (mfaState.MfaHabilitado != 1 || mfaState.RequireReenroll == 1)
        {
            var enroll = await _mfa.EnrollStartAsync(identificacion, usuario, ct);
            if (!enroll.Ok) return /* error */;
            return Ok(BuildMfaChallenge(idUsuario, usuario, /* datos */,
                mfaMode: "enroll",
                qrBase64: enroll.QrBase64, manualKey: enroll.ManualKey, enrollToken: enroll.EnrollToken));
        }

        // Enrolado → pedir código
        return Ok(BuildMfaChallenge(idUsuario, usuario, /* datos */,
            mfaMode: "verify"));
    }
}
SkipMfa:
// ── Emitir JWT (mismo código que antes) ────────────────────────────────
5.3 — Agregar el helper BuildMfaChallenge y los 4 nuevos endpoints:

Copia los métodos BuildMfaChallenge, BuildFinalJwt, MfaVerify, MfaEnrollConfirm, MfaResetRequest, MfaResetConfirm y ParseRoles del CuentaController.cs de SECAD y adáptalos al sistema destino (ajusta cómo se construye el JWT final con los datos de ese sistema).

💡 El único punto de adaptación real es la función BuildFinalJwt y los parámetros de BuildMfaChallenge — deben usar los claims/roles específicos del sistema destino. Todo lo demás es idéntico.

FASE 2 — Frontend Angular
Paso 6 — Copiar el servicio MFA
Copia este archivo tal cual (solo ajusta la URL base si el sistema usa una diferente):

📁 SECAD (origen)
  frontend/src/app/core/services/auth/mfa.service.ts
📁 Sistema X (destino)
  src/app/core/services/auth/mfa.service.ts
  (o donde el sistema organice sus servicios)
El único ajuste: cambiar environment.apiBaseUrl si el sistema usa una variable de entorno diferente:

// Busca esta línea y ajusta si es necesario:
private readonly base = `${environment.apiBaseUrl}/Cuenta`;
//                                                  ↑ Cambia 'Cuenta' si el controlador de login
//                                                    tiene otro nombre en el sistema destino
Paso 7 — Agregar storeLoginData al AuthService existente
Abre el auth.service.ts (o equivalente) del sistema destino y agrega este método:

/**
 * Persiste el JWT y los metadatos de sesión tras completar 2FA.
 * Llamado por el LoginComponent cuando el backend devuelve el token definitivo.
 */
storeLoginData(token: string, usuario: string): void {
  localStorage.setItem(this.tokenKey, token);     // usa las keys existentes del servicio
  localStorage.setItem(this.authKey, '1');
  localStorage.setItem(this.userKey, usuario);
  // Agrega cualquier otro dato que el sistema guarde al hacer login normal
}
💡 Usa las mismas claves (tokenKey, authKey, userKey) que ya usa el auth service del sistema.

Paso 8 — Modificar el componente de login
El componente de login del sistema destino probablemente se llama diferente, pero la lógica es la misma. Los cambios son mínimos:

8.1 — Agregar imports al componente:

import { MfaService, MfaLoginChallenge, MfaStepResponse } 
  from '../../core/services/auth/mfa.service';  // ajusta la ruta
8.2 — Agregar al constructor:

constructor(
  /* ... existentes ... */
  private mfaService: MfaService
) {}
8.3 — Agregar propiedades de estado MFA:

// ── Estado MFA ─────────────────────────────────────────────────────────────
mfaModal: 'enroll' | 'verify' | 'reset' | 'blocked' | 'svcdown' | null = null;
mfaSessionToken = '';
mfaQrBase64 = '';
mfaManualKey = '';
mfaEnrollToken = '';
mfaBloqueoHasta = '';
mfaSvcMsg = '';
otpDigits: string[] = ['', '', '', '', '', ''];
mfaRememberDevice = false;
mfaLoading = false;
mfaError = '';
mfaInfo = '';
resetStep = 1;
resetInfo = '';
get otpCode(): string { return this.otpDigits.join(''); }
8.4 — Modificar el método de submit del formulario:

En el subscribe de la llamada de login, agrega el manejo de requiresMfa antes del manejo del login exitoso normal:

next: (resp: any) => {
  this.isLoading = false;

  // ── Nuevo: verificar si requiere 2FA ──────────────────────
  if (resp?.requiresMfa) {
    this.handleMfaChallenge(resp);
    return;
  }

  // El resto del código de login exitoso que ya existe...
  if (resp?.token || resp?.success) {
    // login normal...
  }
}
8.5 — Agregar todos los métodos MFA:

Copia estos métodos completos del login.ts de SECAD al componente del sistema destino:

handleMfaChallenge()
openModal() / closeModal() / cancelMfa()
openResetModal()
onOtpInput() / onOtpKeydown() / onOtpPaste()
clearOtp() / focusOtp()
onOtpComplete()
submitVerify() / submitEnroll() / submitResetRequest() / submitResetConfirm()
handleStepResponse()
trackByIdx()
Paso 9 — Agregar los modales al HTML del login
En el template HTML del componente de login, justo antes del cierre del </body> o del tag principal del componente, agrega:

<!-- Copiar el bloque completo del login.html de SECAD -->
<!-- Empieza en: <div *ngIf="mfaModal" class="mfa-overlay"> -->
<!-- Termina en: </div><!-- /mfa-overlay -->
El bloque HTML de los modales es completamente reutilizable — no tiene ninguna referencia específica al sistema SECAD.

Paso 10 — Agregar los estilos MFA
En el archivo SCSS del componente de login del sistema destino, agrega al final la sección MFA completa del login.scss de SECAD.

⚠️ Si el sistema usa variables CSS propias en vez de las de SECAD (--policia-*, --ui-*), tendrás que mapear los colores. Busca en la sección MFA del SCSS y reemplaza:

Variable SECAD	Descripción	Valor fallback hardcoded
var(--policia-medio, #002a66)	Azul oscuro	#002a66
var(--policia-cielo, #08a6cb)	Cielo/acento	#08a6cb
var(--policia-acento, #cdff00)	Lima primario	#cdff00
var(--ui-surface, #fff)	Fondo tarjeta	#ffffff
var(--ui-radius, 14px)	Borde redondo	14px
var(--ui-focus-ring)	Foco inputs	0 0 0 4px rgba(8,166,203,.18)
FASE 3 — Checklist de verificación
Antes de probar, verifica que:
✅ BACKEND
[ ] 4 archivos nuevos existen y compilan sin errores
[ ] Namespaces correctos en todos los archivos nuevos
[ ] appsettings.json tiene la sección Mfa:
[ ] appsettings.Development.json tiene Mfa:Enabled = false
[ ] Program.cs registra IMfaCentralService y MfaSessionTokenService
[ ] Controlador de login inyecta _mfa y _mfaSession
[ ] 4 nuevos endpoints existen: MfaVerify, MfaEnrollConfirm, MfaResetRequest, MfaResetConfirm
[ ] El proyecto compila: dotnet build (sin errores)
✅ FRONTEND
[ ] mfa.service.ts existe y apunta al controlador correcto
[ ] storeLoginData() existe en el auth service
[ ] login.ts/component importa MfaService
[ ] login.ts tiene todas las propiedades y métodos MFA
[ ] login.html tiene el bloque de modales MFA
[ ] login.scss tiene la sección de estilos MFA
[ ] ng build (sin errores)
Prueba con Mfa:Enabled = false primero
Antes de activar el MFA, asegúrate de que el login normal sigue funcionando exactamente igual. Con Mfa:Enabled = false el código MFA no se ejecuta y el sistema se comporta como antes.

Activar y probar
Activa con Mfa:Enabled = true
Inicia sesión con un usuario → debe aparecer el modal de enrolamiento (QR)
Escanea el QR con Google Authenticator
Ingresa el código de 6 dígitos → el sistema debe emitir el JWT y entrar
Vuelve a entrar → ahora debe pedir el código (modal verify) sin QR
Marca "Recordar este equipo" → la próxima vez entra directamente sin MFA
FASE 4 — Resumen de archivos por sistema
Cada sistema nuevo requiere exactamente esto:

NUEVOS (copiar de SECAD, ajustar namespace):
├── IMfaCentralService.cs
├── MfaCentralService.cs
├── MfaSessionTokenService.cs
├── DtoMfaAuth.cs
└── mfa.service.ts (Angular)
MODIFICADOS (mínimos cambios):
├── appsettings.json        → agregar sección "Mfa": {}
├── Program.cs              → 2 líneas de registro
├── LoginController.cs      → inyección + lógica MFA + 4 endpoints
├── auth.service.ts         → agregar storeLoginData()
├── login.component.ts      → propiedades + métodos MFA
├── login.component.html    → bloque de modales
└── login.component.scss    → estilos MFA
Tiempo estimado por sistema: 2–4 horas si el sistema tiene una estructura similar a SECAD.

Errores comunes y soluciones
Error	Causa	Solución
KeyNotFoundException en MfaCentralService	Propiedades JSON sin case-insensitive	Verificar que _jOpts tiene PropertyNameCaseInsensitive = true
Mfa:HmacSecret no configurado al arrancar	Falta la clave en appsettings	Agregar la sección Mfa: en appsettings
Modal no aparece	requiresMfa no llega al frontend	Verificar que DtoMfaLoginResponse hereda de DtoTokenResponse y que los campos se serializan
Sesión MFA expirada inmediatamente	Jwt:MfaSessionKey muy corta	Asegurar que la clave tiene mínimo 32 caracteres
OTP siempre inválido	Reloj del servidor desfasado	Sincronizar hora del servidor con NTP
Sistema no autorizado (401)	Nombre del sistema no registrado en Api2FA	Confirmar con el equipo Api2FA que registraron el nombre exacto
