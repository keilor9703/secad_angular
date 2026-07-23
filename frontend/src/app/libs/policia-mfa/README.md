# @policia/mfa — Librería de doble autenticación institucional (Angular)

Librería reutilizable para consumir la **API 2FA institucional** de la Policía
Nacional desde cualquier sistema Angular, con la **misma lógica y (próximamente)
las mismas modales de diseño** que SECAD. El objetivo es que un sistema nuevo
tenga el 2FA idéntico con **mínima intervención** — sin copiar/pegar código.

> **Estado (entrega 1):** extraída la **capa de servicio** (`MfaService` +
> modelos + configuración por token). SECAD ya la consume a sí mismo como primer
> cliente. La **entrega 2** extraerá las modales (enroll/verify/reset) a un
> componente standalone `PoliciaMfaFlowComponent`. La **entrega 3** empaqueta con
> ng-packagr para publicarla en el registro npm privado de la Policía.

## Qué contiene hoy

| Archivo | Qué es |
|---|---|
| `mfa.config.ts` | `POLICIA_MFA_CONFIG` (token) + `providePoliciaMfa()` + `PoliciaMfaConfig` |
| `mfa.models.ts` | DTOs `MfaLoginChallenge`, `MfaStepResponse` |
| `mfa.service.ts` | `MfaService` — verify / enrollConfirm / resetRequest / resetConfirm + deviceId |
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

**2) Usar el servicio** en el login:

```ts
import { MfaService } from './libs/policia-mfa/public-api';
// ...
constructor(private mfa: MfaService) {}
this.mfa.verify(sessionToken, code, remember).subscribe(...);
```

## Requisito del backend

El backend del sistema consumidor debe exponer los endpoints MFA
(`.../{controlador}/MfaVerify`, `MfaEnrollConfirm`, `MfaResetRequest`,
`MfaResetConfirm`) que se integran con la API 2FA central. En SECAD los provee
`CuentaController` + `MfaCentralService`. Para los sistemas .NET esto se empaquetará
como un **NuGet** aparte (fuera del alcance de esta librería Angular).

## Roadmap

- [x] Entrega 1 — servicio + modelos + configuración (esta).
- [ ] Entrega 2 — componente standalone con las modales (enroll/verify/reset/blocked/svcdown), incluido el botón otpauth:// de un toque.
- [ ] Entrega 3 — empaquetado ng-packagr + publicación en registro npm privado.
