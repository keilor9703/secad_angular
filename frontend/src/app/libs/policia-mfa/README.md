# @policia/mfa — Librería de doble autenticación institucional (Angular)

Librería reutilizable para consumir la **API 2FA institucional** de la Policía
Nacional desde cualquier sistema Angular, con la **misma lógica y (próximamente)
las mismas modales de diseño** que SECAD. El objetivo es que un sistema nuevo
tenga el 2FA idéntico con **mínima intervención** — sin copiar/pegar código.

> **Estado (entrega 2):** además de la **capa de servicio** (`MfaService` +
> modelos + configuración por token), ya está extraído el **componente de UI**
> `PoliciaMfaFlowComponent` (`<pmfa-flow>`) con todas las modales
> (enroll/verify/reset/blocked/svcdown) y el botón otpauth:// de un toque. SECAD
> ya consume ambas capas como primer cliente: su login solo emite el reto y
> recibe el JWT. La **entrega 3** empaqueta con ng-packagr para publicarla en el
> registro npm privado de la Policía.

## Qué contiene hoy

| Archivo | Qué es |
|---|---|
| `mfa.config.ts` | `POLICIA_MFA_CONFIG` (token) + `providePoliciaMfa()` + `PoliciaMfaConfig` |
| `mfa.models.ts` | DTOs `MfaLoginChallenge`, `MfaStepResponse` |
| `mfa.service.ts` | `MfaService` — verify / enrollConfirm / resetRequest / resetConfirm + deviceId |
| `flow/mfa-flow.component.*` | `PoliciaMfaFlowComponent` (`<pmfa-flow>`) — modales enroll/verify/reset/blocked/svcdown + otpauth:// |
| `public-api.ts` | Punto de entrada único (barrel) |

## Cómo lo consume un sistema Angular

**1) Registrar la configuración** (en `app.config.ts`, providers de bootstrap):

```ts
import { providePoliciaMfa } from './libs/policia-mfa/public-api';
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
import { MfaLoginChallenge, PoliciaMfaFlowComponent } from './libs/policia-mfa/public-api';
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
- [x] Entrega 2 — componente standalone `PoliciaMfaFlowComponent` con las modales (enroll/verify/reset/blocked/svcdown), incluido el botón otpauth:// de un toque (esta).
- [ ] Entrega 3 — empaquetado ng-packagr + publicación en registro npm privado.
