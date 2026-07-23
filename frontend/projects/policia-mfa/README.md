# @policia/mfa — Librería de doble autenticación institucional (Angular)

Librería reutilizable para consumir la **API 2FA institucional** de la Policía
Nacional desde cualquier sistema Angular, con la **misma lógica y las mismas
modales de diseño** que SECAD. El objetivo es que un sistema nuevo tenga el 2FA
idéntico con **mínima intervención** — sin copiar/pegar código.

> **Estado (entrega 3 — completa):** es un **paquete Angular publicable**
> (`@policia/mfa`) empaquetado con **ng-packagr** en el formato oficial de
> librerías Angular (Angular Package Format: FESM2022 + `.d.ts` + `exports`).
> Contiene la **capa de servicio** (`MfaService` + modelos + configuración por
> token) y el **componente de UI** `PoliciaMfaFlowComponent` (`<pmfa-flow>`) con
> todas las modales (enroll/verify/reset/blocked/svcdown) y el botón otpauth://
> de un toque. SECAD es el primer cliente y lo consume como proyecto de librería
> dentro del mismo workspace.

## Estructura del proyecto (workspace multi-proyecto)

```
frontend/
├─ angular.json                         → proyecto "@policia/mfa" (builder @angular/build:ng-packagr)
├─ tsconfig.json                        → paths: "@policia/mfa" → projects/policia-mfa/src/public-api.ts
├─ projects/policia-mfa/
│  ├─ ng-package.json                   → dest: dist/policia-mfa, entryFile: src/public-api.ts
│  ├─ package.json                      → nombre, versión, peerDependencies, publishConfig
│  ├─ tsconfig.lib.json / .prod.json    → compilación de la librería (partial mode)
│  └─ src/
│     ├─ public-api.ts                  → barrel (punto de entrada único)
│     └─ lib/
│        ├─ mfa.config.ts               → POLICIA_MFA_CONFIG + providePoliciaMfa() + PoliciaMfaConfig
│        ├─ mfa.models.ts               → MfaLoginChallenge, MfaStepResponse
│        ├─ mfa.service.ts              → MfaService (verify/enrollConfirm/resetRequest/resetConfirm)
│        └─ flow/mfa-flow.component.*   → PoliciaMfaFlowComponent (<pmfa-flow>)
└─ dist/policia-mfa/                    → salida empaquetada (no versionada; lista para npm publish)
```

## Empaquetado y publicación

Desde `frontend/` (los scripts ya están en `package.json`):

```bash
npm run build:mfa      # ng build @policia/mfa  →  genera dist/policia-mfa (APF: FESM2022 + .d.ts)
npm run pack:mfa       # build + npm pack        →  genera policia-mfa-1.0.0.tgz (para probar sin publicar)
npm run publish:mfa    # build + npm publish     →  publica al registro privado
```

**Registro npm privado.** El `package.json` de la librería declara
`publishConfig.registry` (placeholder `https://registro-npm.policia.gov.co/` —
ajústelo al registro real de la institución) con `access: "restricted"`. Para
autenticarse, cada desarrollador/CI configura un `.npmrc` con el scope `@policia`
apuntando a ese registro y un token de acceso (ver `.npmrc.example`). El campo
`version` de `package.json` se sube con SemVer en cada release (`npm version
patch|minor|major` dentro de `projects/policia-mfa/`).

> Nota: `npm publish` requiere conectividad y credenciales del registro privado,
> que no existen en este entorno de desarrollo — por eso el flujo se deja
> automatizado y documentado, y se valida hasta `build:mfa`/`pack:mfa`.

## Cómo lo consume un sistema Angular

Instalar el paquete del registro privado (o usar el `.tgz` de `pack:mfa`):

```bash
npm install @policia/mfa
```

**1) Registrar la configuración** (en `app.config.ts`, providers de bootstrap):

```ts
import { providePoliciaMfa } from '@policia/mfa';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    providePoliciaMfa({ apiBaseUrl: environment.apiBaseUrl }),
  ]
};
```

Opciones de `providePoliciaMfa(config)`:
- `apiBaseUrl` (obligatorio) — base de la API del sistema.
- `controlador` — controlador backend con los endpoints MFA (default `Cuenta`).
- `issuer` — emisor mostrado en la app de autenticación (default `SECAD`).
- `deviceStorageKey` — clave de localStorage del dispositivo recordado
  (default `policia_mfa_device`).

**2) Montar el flujo 2FA** en el login. El componente se encarga de todas las
modales; el login solo le pasa el reto y recibe el JWT:

```html
<pmfa-flow
  [challenge]="mfaChallenge"
  [usuario]="usuario"
  (autenticado)="onMfaAutenticado($event)"
  (cancelado)="mfaChallenge = null">
</pmfa-flow>
```

```ts
import { MfaLoginChallenge, PoliciaMfaFlowComponent } from '@policia/mfa';
// imports: [ ..., PoliciaMfaFlowComponent ]

mfaChallenge: MfaLoginChallenge | null = null;

// tras validar credenciales, si el backend pide 2FA:
if (resp?.requiresMfa) { this.mfaChallenge = resp as MfaLoginChallenge; }

// el componente devuelve el JWT ya validado:
onMfaAutenticado(token: string): void {
  this.authService.storeLoginData(token, this.usuario);
  this.router.navigate(['/home']);
}
```

El componente **no navega ni guarda sesión**: emite `autenticado(token)` para que
cada sistema decida qué hacer. Si se necesita solo el servicio (sin las modales),
`MfaService` sigue disponible de forma independiente.

## Requisito del backend

El backend del sistema consumidor debe exponer los endpoints MFA
(`.../{controlador}/MfaVerify`, `MfaEnrollConfirm`, `MfaResetRequest`,
`MfaResetConfirm`) que se integran con la API 2FA central. En SECAD los provee
`CuentaController` + `MfaCentralService`. Para los sistemas .NET esto se empaquetará
como un **NuGet** aparte (fuera del alcance de esta librería Angular).

## Roadmap

- [x] Entrega 1 — servicio + modelos + configuración.
- [x] Entrega 2 — componente standalone `PoliciaMfaFlowComponent` con las modales (enroll/verify/reset/blocked/svcdown), incluido el botón otpauth:// de un toque.
- [x] Entrega 3 — empaquetado ng-packagr (proyecto de librería en el workspace) + scripts de build/pack/publish + `publishConfig` al registro npm privado (esta).

### Fuera del alcance de esta librería Angular
- **NuGet para sistemas .NET.** Los backends consumidores exponen los endpoints
  MFA (`MfaVerify`/`MfaEnrollConfirm`/`MfaResetRequest`/`MfaResetConfirm`); en
  SECAD los provee `CuentaController` + `MfaCentralService`. Ese wrapper de
  servidor se empaquetará como un paquete NuGet aparte.
