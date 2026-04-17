using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Comun.Dtos;
using Comun.Dtos.Dominio;
using Datos.Interfaz;
using Negocio.Interfaz;
using Servicios.ApiInterfaz;
using System.Globalization;
using System.Security.Claims;
using System.Text;

namespace ofic.Controllers.Administracion
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsuarioController : ControllerBase
    {
        private readonly IApiWebToken _apiWebToken;
        private readonly IDbUsuarioRepository _dbUsuarioRepository;
        private readonly IDbDominioService _dominioService;
        private readonly ILogger<UsuarioController> _logger;
        private readonly IConfiguration _configuration;

        private static readonly string[] CategoriasPermitidas =
        {
            "Oficiales",
            "Nivel Ejecutivo",
            "Patrulleros",
            "Suboficiales",
            "Agentes",
            "Estudiantes",
            "Auxiliares de Policía"
        };

        private static readonly Dictionary<string, string[]> AliasCategorias = new(StringComparer.OrdinalIgnoreCase)
        {
            ["oficiales"] = new[] { "oficiales", "oficial" },
            ["nivel ejecutivo"] = new[] { "nivel ejecutivo", "ejecutivo" },
            ["patrulleros"] = new[] { "patrulleros", "patrullero", "patrullero de policia" },
            ["suboficiales"] = new[] { "suboficiales", "suboficial" },
            ["agentes"] = new[] { "agentes", "agente" },
            ["estudiantes"] = new[] { "estudiantes", "estudiante" },
            ["auxiliares de policia"] = new[] { "auxiliares de policia", "auxiliar de policia", "auxiliares", "auxiliar" }
        };

        private static readonly (string Grado, string Categoria)[] ReglasGradoCategoria = new (string Grado, string Categoria)[]
        {
            ("Teniente General", "Oficiales"),
            ("Mayor General", "Oficiales"),
            ("Brigadier General", "Oficiales"),
            ("Teniente Coronel", "Oficiales"),
            ("Subteniente", "Oficiales"),
            ("Coronel", "Oficiales"),
            ("Capitán", "Oficiales"),
            ("Teniente", "Oficiales"),
            ("General", "Oficiales"),
            ("Mayor", "Oficiales"),
            ("Subcomisario", "Nivel Ejecutivo"),
            ("Comisario", "Nivel Ejecutivo"),
            ("Intendente Jefe", "Nivel Ejecutivo"),
            ("Subintendente", "Nivel Ejecutivo"),
            ("Intendente", "Nivel Ejecutivo"),
            ("Patrullero de Policía", "Patrulleros"),
            ("Patrullero", "Patrulleros"),
            ("Sargento Mayor", "Suboficiales"),
            ("Sargento Primero", "Suboficiales"),
            ("Sargento Viceprimero", "Suboficiales"),
            ("Sargento Segundo", "Suboficiales"),
            ("Cabo Primero", "Suboficiales"),
            ("Cabo Segundo", "Suboficiales"),
            ("Auxiliares de Policía", "Auxiliares de Policía"),
            ("Auxiliar de Policía", "Auxiliares de Policía"),
            ("Estudiantes", "Estudiantes"),
            ("Estudiante", "Estudiantes"),
            ("Agentes", "Agentes"),
            ("Agente", "Agentes")
        }
        .OrderByDescending(item => item.Grado.Length)
        .ToArray();

        public UsuarioController(
            IApiWebToken apiWebToken,
            IDbUsuarioRepository dbUsuarioRepository,
            IDbDominioService dominioService,
            ILogger<UsuarioController> logger,
            IConfiguration configuration)
        {
            _apiWebToken = apiWebToken;
            _dbUsuarioRepository = dbUsuarioRepository;
            _dominioService = dominioService;
            _logger = logger;
            _configuration = configuration;
        }

        private async Task<string> GetTechnicalTokenAsync(CancellationToken ct)
        {
            try
            {
                var tokenResp = await _apiWebToken.ObtenerTokenPipAsync(ct);
                if (tokenResp is not null && tokenResp.Estado && !string.IsNullOrWhiteSpace(tokenResp.Respuesta))
                {
                    return tokenResp.Respuesta!;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "FallÃ³ ObtenerTokenPipAsync; se intentarÃ¡ fallback con PostPipToken.");
            }

            // Fallback robusto: usa credenciales tÃ©cnicas de appsettings contra PostPipToken.
            var usuarioPip = _configuration["ApiSettings:UsuarioPip"] ?? string.Empty;
            var clavePip = _configuration["ApiSettings:ClavePip"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(usuarioPip) || string.IsNullOrWhiteSpace(clavePip))
            {
                _logger.LogWarning("ApiSettings:UsuarioPip/ClavePip no configurados.");
                return string.Empty;
            }

            try
            {
                return await _apiWebToken.GetTokenAsync(usuarioPip, clavePip);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "FallÃ³ fallback GetTokenAsync con credenciales tÃ©cnicas.");
            }

            return string.Empty;
        }

        [HttpGet("Funcionario")]
        public async Task<IActionResult> GetFuncionario([FromQuery] string identificacion)
        {
            try
            {
                if (string.IsNullOrEmpty(identificacion))
                {
                    return BadRequest(new { message = "IdentificaciÃ³n requerida" });
                }

                // Obtener token tÃ©cnico de API externa configurado en ApiSettings.
                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                // Consultar empleado
                var empleado = await _apiWebToken.GetFuncionarioAsync(tokenPip, identificacion);

                if (empleado is null)
                {
                    return NotFound(new { message = "No se encontrÃ³ informaciÃ³n del funcionario." });
                }

                // Validar situaciÃ³n laboral
                var situacionLaboral = (empleado.situacionLaboral ?? string.Empty).Trim().ToUpperInvariant();
                if (situacionLaboral != "LABORANDO" && situacionLaboral != "COMISION DEL SERVICIO")
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Usuario no estÃ¡ en situaciÃ³n laboral vÃ¡lida. SituaciÃ³n actual: '{empleado.situacionLaboral ?? "No reportada"}'. Solo se permiten 'LABORANDO' o 'COMISIÃ“N DEL SERVICIO'."
                    });
                }

                // Persistir automÃ¡ticamente en DB local si no existe.
                // No debe romper la consulta principal si falla la persistencia local.
                if (empleado is not null)
                {
                    try
                    {
                        await _dbUsuarioRepository.EnsureUsuarioExistsAsync(empleado, HttpContext.RequestAborted);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(
                            ex,
                            "No se pudo persistir el usuario local para identificacion={Identificacion}, usuario={Usuario}",
                            empleado.identificacion,
                            empleado.usuario);
                    }
                }

                // Si el usuario existe en BD local, reflejar estado real (bloqueado/activo).
                if (empleado is not null)
                {
                    try
                    {
                        var activoDb = await _dbUsuarioRepository.GetActivoByIdentificacionOrUsernameAsync(
                            empleado.identificacion,
                            empleado.usuario,
                            HttpContext.RequestAborted);
                        if (activoDb.HasValue)
                        {
                            empleado.activo = activoDb.Value;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo resolver estado local de usuario. identificacion={Identificacion}, usuario={Usuario}",
                            empleado.identificacion, empleado.usuario);
                    }
                }

                if (empleado is not null)
                {
                    try
                    {
                        await ResolverCategoriaFuncionarioAsync(empleado, HttpContext.RequestAborted);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo resolver categoría para el funcionario. identificacion={Identificacion}", empleado.identificacion);
                    }
                }

                return Ok(empleado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando empleado");
                return StatusCode(500, new { message = "Error al consultar empleado" });
            }
        }

        [HttpGet("Foto")]
        public async Task<IActionResult> GetFoto([FromQuery] string identificacion)
        {
            try
            {
                if (string.IsNullOrEmpty(identificacion))
                {
                    return BadRequest(new { message = "IdentificaciÃ³n requerida" });
                }

                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                var fotoBase64 = await _apiWebToken.GetFotoFuncionarioAsync(tokenPip, identificacion);

                return Ok(fotoBase64);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando foto");
                return StatusCode(500, new { message = "Error al consultar foto" });
            }
        }

        [HttpGet("MiFoto")]
        public async Task<IActionResult> GetMiFoto()
        {
            try
            {
                var username =
                    User?.Identity?.Name
                    ?? User?.FindFirstValue(ClaimTypes.Name)
                    ?? User?.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

                if (string.IsNullOrWhiteSpace(username))
                {
                    return BadRequest(new { message = "No se pudo resolver el usuario autenticado." });
                }

                var identificacion = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(
                    username.Trim(),
                    HttpContext.RequestAborted);

                if (string.IsNullOrWhiteSpace(identificacion))
                {
                    return NotFound(new { message = "No se encontrÃ³ identificaciÃ³n para el usuario autenticado." });
                }

                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                var fotoBase64 = await _apiWebToken.GetFotoFuncionarioAsync(tokenPip, identificacion.Trim());
                return Ok(fotoBase64);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando foto del usuario autenticado");
                return StatusCode(500, new { message = "Error al consultar foto del usuario autenticado" });
            }
        }

        [HttpGet("MiPerfil")]
        public async Task<IActionResult> GetMiPerfil()
        {
            try
            {
                var username =
                    User?.Identity?.Name
                    ?? User?.FindFirstValue(ClaimTypes.Name)
                    ?? User?.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

                if (string.IsNullOrWhiteSpace(username))
                {
                    return BadRequest(new { message = "No se pudo resolver el usuario autenticado." });
                }

                var identificacion = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(
                    username.Trim(),
                    HttpContext.RequestAborted);

                if (string.IsNullOrWhiteSpace(identificacion))
                {
                    return NotFound(new { message = "No se encontrÃ³ identificaciÃ³n para el usuario autenticado." });
                }

                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                var empleado = await _apiWebToken.GetFuncionarioAsync(tokenPip, identificacion.Trim());
                if (empleado is null)
                {
                    return NotFound(new { message = "No se encontrÃ³ informaciÃ³n de perfil." });
                }

                var nombreCompleto = $"{(empleado.nombres ?? string.Empty).Trim()} {(empleado.apellidos ?? string.Empty).Trim()}".Trim();

                return Ok(new
                {
                    identificacion = (empleado.identificacion ?? identificacion).Trim(),
                    grado = (empleado.nombreGrado ?? string.Empty).Trim(),
                    nombreCompleto,
                    cargo = (empleado.cargo ?? string.Empty).Trim(),
                    situacionLaboral = (empleado.situacionLaboral ?? string.Empty).Trim(),
                    tiempoServicio = (empleado.tiempoServicio ?? string.Empty).Trim()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando perfil del usuario autenticado");
                return StatusCode(500, new { message = "Error al consultar perfil del usuario autenticado" });
            }
        }

        [HttpGet("Roles")]
        public async Task<IActionResult> GetRoles()
        {
            try
            {
                var roles = await _dbUsuarioRepository.GetRolesAsync(HttpContext.RequestAborted);
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando catÃ¡logo de roles");
                return StatusCode(500, new { message = "Error al consultar roles" });
            }
        }

        [HttpGet("RolesAsignados")]
        public async Task<IActionResult> GetRolesAsignados([FromQuery] string usuario)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(usuario))
                {
                    return BadRequest(new { message = "Usuario requerido" });
                }

                var roles = await _dbUsuarioRepository.GetRolesAsignadosAsync(usuario.Trim(), HttpContext.RequestAborted);
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando roles asignados para usuario {Usuario}", usuario);
                return StatusCode(500, new { message = "Error al consultar roles asignados" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SaveUsuario([FromBody] DtoUsuarioRequest request)
        {
            try
            {
                if (request is null || string.IsNullOrWhiteSpace(request.identificacion))
                {
                    return BadRequest(new { success = false, message = "IdentificaciÃ³n requerida" });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    request.identificacion,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.SaveUsuarioAsync(
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idUsuario <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        idUsuario = result.idUsuario,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible guardar el usuario."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idUsuario = result.idUsuario,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Usuario guardado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando usuario");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al guardar usuario"
                });
            }
        }

        private async Task<string> ResolveUsuarioAuditoriaAsync(
            ClaimsPrincipal? user,
            string? identificacionRequest,
            CancellationToken ct)
        {
            // Requisito funcional: auditar con cÃ©dula (no id interno).
            var cedula =
                user?.Claims?.FirstOrDefault(c =>
                    c.Type == "identificacion" ||
                    c.Type == "cedula" ||
                    c.Type == "numeroDocumento" ||
                    c.Type == "documento")?.Value;

            if (!string.IsNullOrWhiteSpace(cedula))
            {
                return cedula.Trim();
            }

            // Si no viene cÃ©dula como claim, resolver por username del JWT en CTR_USUARIOS.
            var username =
                user?.Identity?.Name
                ?? user?.Claims?.FirstOrDefault(c =>
                    c.Type == ClaimTypes.Name ||
                    c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value;

            if (!string.IsNullOrWhiteSpace(username))
            {
                try
                {
                    var cedulaDb = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(username.Trim(), ct);
                    if (!string.IsNullOrWhiteSpace(cedulaDb))
                    {
                        return cedulaDb.Trim();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo resolver cÃ©dula del usuario logueado desde DB. username={Username}", username);
                }
            }

            // Fallback final: identificaciÃ³n del usuario objetivo.
            if (!string.IsNullOrWhiteSpace(identificacionRequest))
            {
                return identificacionRequest.Trim();
            }

            return "N/A";
        }

        [HttpPost("Roles")]
        public async Task<IActionResult> AsignarRol([FromBody] DtoAsignarRolRequest request)
        {
            try
            {
                if (request is null || request.rolId <= 0)
                {
                    return BadRequest(new { success = false, message = "Rol requerido" });
                }

                if (string.IsNullOrWhiteSpace(request.justificacion))
                {
                    return BadRequest(new { success = false, message = "JustificaciÃ³n requerida" });
                }

                if (string.IsNullOrWhiteSpace(request.fechaFin))
                {
                    return BadRequest(new { success = false, message = "Fecha fin requerida" });
                }

                if (!DateTime.TryParse(request.fechaFin, out var fechaFin))
                {
                    return BadRequest(new { success = false, message = "Fecha fin invÃ¡lida" });
                }

                request.fechaFin = fechaFin.ToString("yyyy-MM-dd");

                long idUsuario = request.usuarioId;
                if (idUsuario <= 0 && !string.IsNullOrWhiteSpace(request.identificacion))
                {
                    var idByDoc = await _dbUsuarioRepository.GetUsuarioIdByIdentificacionAsync(
                        request.identificacion.Trim(),
                        HttpContext.RequestAborted);
                    if (idByDoc.HasValue)
                    {
                        idUsuario = idByDoc.Value;
                    }
                }

                if (idUsuario <= 0 && !string.IsNullOrWhiteSpace(request.usuario))
                {
                    var idByUser = await _dbUsuarioRepository.GetUsuarioIdByUsernameAsync(
                        request.usuario.Trim(),
                        HttpContext.RequestAborted);
                    if (idByUser.HasValue)
                    {
                        idUsuario = idByUser.Value;
                    }
                }

                if (idUsuario <= 0)
                {
                    return BadRequest(new { success = false, message = "No se encontrÃ³ el usuario para asignar el rol." });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    request.identificacion,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.AsignarRolAsync(
                    idUsuario,
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idUsuario <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible asignar el rol."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idRolUserAdmin = result.idUsuario,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Rol asignado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error asignando rol");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al asignar rol"
                });
            }
        }

        [HttpDelete("Roles/{rolId}")]
        public IActionResult EliminarRol(int rolId)
        {
            try
            {
                // AquÃ­ eliminarÃ­as de tu BD
                return Ok(new { success = true, message = "Rol eliminado correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eliminando rol");
                return StatusCode(500, new { message = "Error al eliminar rol" });
            }
        }

        [HttpGet("Roles/Admin")]
        public async Task<IActionResult> GetRolesAdmin()
        {
            try
            {
                var roles = await _dbUsuarioRepository.GetRolesAdminAsync(HttpContext.RequestAborted);
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando administraciÃ³n de roles");
                return StatusCode(500, new { success = false, message = "Error al consultar roles." });
            }
        }

        [HttpPost("Roles/Admin")]
        public async Task<IActionResult> SaveRolAdmin([FromBody] DtoSaveRolRequest request)
        {
            try
            {
                if (request is null)
                {
                    return BadRequest(new { success = false, message = "Payload invÃ¡lido." });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    null,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.SaveRolAdminAsync(
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idRol <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible guardar el rol."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idRol = result.idRol,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Rol guardado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando rol");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al guardar rol"
                });
            }
        }

        [HttpPatch("Roles/Admin/{idRol:int}/Estado")]
        public async Task<IActionResult> SetRolEstado(int idRol, [FromBody] DtoSetRolEstadoRequest request)
        {
            try
            {
                if (idRol <= 0)
                {
                    return BadRequest(new { success = false, message = "Id de rol invÃ¡lido." });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    null,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.SetRolEstadoAsync(
                    idRol,
                    request?.vigente ?? 0,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idRol <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible actualizar el estado del rol."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idRol = result.idRol,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Estado del rol actualizado."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando estado del rol. idRol={IdRol}", idRol);
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al actualizar estado del rol"
                });
            }
        }

        private async Task ResolverCategoriaFuncionarioAsync(DtoFuncionario empleado, CancellationToken ct)
        {
            var catalogoCategorias = await _dominioService.GetAllAsync(ct);
            var categoriasPermitidas = (catalogoCategorias ?? new List<DtoDominio>())
                .Where(item => item.IdPadre == 1 && item.Vigente == 1)
                .Where(item => EsCategoriaPermitida(item.Descripcion))
                .OrderBy(item => item.Descripcion)
                .ToList();

            var categoria = BuscarCategoriaConsultadaEnCatalogo(empleado, categoriasPermitidas)
                ?? BuscarCategoriaEnCatalogo(empleado, categoriasPermitidas);

            if (categoria is null)
            {
                empleado.idCategoria = null;
                empleado.categoriaDescripcion = null;
                return;
            }

            empleado.idCategoria = categoria.IdDominio;
            empleado.categoriaDescripcion = categoria.Descripcion;
        }

        private static DtoDominio? BuscarCategoriaConsultadaEnCatalogo(DtoFuncionario empleado, IReadOnlyCollection<DtoDominio> catalogoCategorias)
        {
            if (catalogoCategorias.Count == 0)
            {
                return null;
            }

            if (empleado.idCategoria.HasValue && empleado.idCategoria.Value > 0)
            {
                var matchById = catalogoCategorias.FirstOrDefault(item => item.IdDominio == empleado.idCategoria.Value);
                if (matchById is not null)
                {
                    return matchById;
                }
            }

            if (string.IsNullOrWhiteSpace(empleado.categoriaDescripcion))
            {
                return null;
            }

            foreach (var alias in ObtenerAliasCategoria(empleado.categoriaDescripcion))
            {
                var match = catalogoCategorias.FirstOrDefault(
                    item => NormalizeCategoria(item.Descripcion) == alias);

                if (match is not null)
                {
                    return match;
                }
            }

            return null;
        }

        private static DtoDominio? BuscarCategoriaEnCatalogo(DtoFuncionario empleado, IReadOnlyCollection<DtoDominio> catalogoCategorias)
        {
            if (catalogoCategorias.Count == 0)
            {
                return null;
            }

            var categoriaEsperada = ObtenerCategoriaPorGrado(empleado.nombreGrado)
                ?? ObtenerCategoriaPorGrado(empleado.cargo);

            if (string.IsNullOrWhiteSpace(categoriaEsperada))
            {
                return null;
            }

            foreach (var alias in ObtenerAliasCategoria(categoriaEsperada))
            {
                var match = catalogoCategorias.FirstOrDefault(
                    item => NormalizeCategoria(item.Descripcion) == alias);

                if (match is not null)
                {
                    return match;
                }
            }

            return null;
        }

        private static string? ObtenerCategoriaPorGrado(string? grado)
        {
            var gradoNormalizado = NormalizeText(grado);
            if (string.IsNullOrWhiteSpace(gradoNormalizado))
            {
                return null;
            }

            foreach (var regla in ReglasGradoCategoria)
            {
                var alias = NormalizeText(regla.Grado);
                if (gradoNormalizado == alias || gradoNormalizado.Contains(alias, StringComparison.Ordinal))
                {
                    return regla.Categoria;
                }
            }

            return null;
        }

        private static IEnumerable<string> ObtenerAliasCategoria(string? categoria)
        {
            var categoriaNormalizada = NormalizeCategoria(categoria);
            return AliasCategorias.TryGetValue(categoriaNormalizada, out var alias)
                ? alias
                : new[] { categoriaNormalizada };
        }

        private static bool EsCategoriaPermitida(string? descripcion)
        {
            var descripcionNormalizada = NormalizeCategoria(descripcion);
            return CategoriasPermitidas.Any(item =>
                ObtenerAliasCategoria(item).Contains(descripcionNormalizada, StringComparer.Ordinal));
        }

        private static string NormalizeCategoria(string? value)
        {
            return NormalizeText(value)
                .Replace("categoria ", string.Empty, StringComparison.Ordinal)
                .Trim();
        }

        private static string NormalizeText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var normalized = value.Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(normalized.Length);

            foreach (var character in normalized)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(character);
                if (unicodeCategory == UnicodeCategory.NonSpacingMark)
                {
                    continue;
                }

                builder.Append(char.IsLetterOrDigit(character) || char.IsWhiteSpace(character)
                    ? character
                    : ' ');
            }

            return string.Join(' ', builder
                .ToString()
                .Normalize(NormalizationForm.FormC)
                .ToLowerInvariant()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
    }
}


