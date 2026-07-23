/*
 * @policia/mfa — API pública de la librería de doble autenticación institucional.
 *
 * Punto de entrada único: los sistemas consumidores importan solo desde aquí.
 * (Cuando se empaquete con ng-packagr, este será el `public-api.ts` del paquete.)
 */
export * from './mfa.config';
export * from './mfa.models';
export * from './mfa.service';
