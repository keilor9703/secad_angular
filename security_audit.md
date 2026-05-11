# Security Audit Report - SICOE (Headless Migration State)

## 1. Authentication & Authorization
- **JWT Implementation**: The system uses JWT Bearer authentication. 
- **Secret Management**: **CRITICAL**. The `Jwt:Key` and database `ConnectionStrings` are hardcoded in `appsettings.json`. 
    - *Recommendation*: Move these to environment variables or a Secret Manager (like Azure Key Vault or AWS Secrets Manager).
- **Validation**: `ValidateLifetime`, `ValidateIssuer`, and `ValidateAudience` are enabled. This is good.

## 2. CORS (Cross-Origin Resource Sharing)
- **Configuration**: `DevCors` is correctly restricted to `localhost`. 
- **PublicCors**: Defined with `SetIsOriginAllowed(_ => true)`, which is permissive. 
- **Usage**: `app.UseCors("DevCors")` is hardcoded in `Program.cs`. 
    - *Warning*: This will break production if the frontend is hosted on a different domain unless changed to a production policy.

## 3. Data Exposure & API Security
- **Endpoints**: Most content-management endpoints (Sliders, News, Radio, Modals, Eventos) have been removed, reducing the attack surface.
- **VideoUnidad**: This controller still handles local file uploads (up to 100MB). 
    - *Security Feature*: Uses `SecurityGuards.HasValidVideoSignature` to verify file headers. This is a strong defense against malicious file uploads.
- **Audit Logs**: Controllers use `User.FindFirstValue(ClaimTypes.Name)` for auditing, which is correct.

## 4. Infrastructure & Storage
- **File System**: `AppSettings:UploadsPath` points to `/opt/oftic/uploads`. 
    - *Observation*: This is a Linux-style path. Ensure the environment matches or use a cross-platform path resolution.
- **Kestrel Limits**: Max request body size is 150MB. 
    - *Observation*: High limit, but justified for `VideoUnidad` uploads.

## 5. Front-End Security
- **Token Storage**: Ensure `localStorage` or `sessionStorage` is used securely. 
- **XSS Prevention**: Angular's default interpolation and `SafeUrlPipe` are being used, which provides good protection.

## Summary Checklist
- [ ] Move secrets out of `appsettings.json`.
- [ ] Update CORS policy for production deployment.
- [ ] Review if `VideoUnidad` should also be migrated to the external API.
- [ ] Verify SSL/TLS certificates for the external API host (`srvdockergusof`).
