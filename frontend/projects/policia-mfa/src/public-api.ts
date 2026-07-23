/*
 * @policia/mfa — API pública de la librería de doble autenticación institucional.
 *
 * Punto de entrada único del paquete: los sistemas consumidores importan solo
 * desde `@policia/mfa`. Este archivo es el `entryFile` que ng-packagr empaqueta.
 */
export * from './lib/mfa.config';
export * from './lib/mfa.models';
export * from './lib/mfa.service';
export * from './lib/flow/mfa-flow.component';
