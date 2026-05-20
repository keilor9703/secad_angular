using Comun.Dtos;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Servicios.ApiInterfaz;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Servicios.Api
{
    public class ApiWebOud : IApiWebOud
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _cfg;
        private readonly ILogger<ApiWebOud> _logger;

       public ApiWebOud(HttpClient http, IConfiguration cfg, ILogger<ApiWebOud> logger)
        {
            _http = http;
            _cfg = cfg;
            _logger = logger;
        }

        public async Task<string> ConsultarFuncionarioAsync(string identificacion, CancellationToken ct)
        {
            var baseUrl = _cfg["ApiSettings:ConsultaFuncionarios"]!;
            var url = $"{baseUrl}{Uri.EscapeDataString(identificacion)}";

            using var resp = await _http.GetAsync(url, ct);
            resp.EnsureSuccessStatusCode();

            return await resp.Content.ReadAsStringAsync(ct);
        }

        public async Task<bool> ValidarCredencialesAsync(string usuario, string contrasena, CancellationToken ct)
        {
            var url = _cfg["ApiSettings:OudLogin"]?.Trim();
            if (string.IsNullOrWhiteSpace(url))
            {
                _logger.LogWarning("ApiSettings:OudLogin no configurado.");
                return false;
            }

            var normalizedUser = usuario?.Trim().ToLowerInvariant() ?? string.Empty;
            var normalizedPassword = contrasena ?? string.Empty;
            var payload = new
            {
                Usuario = normalizedUser,
                Contrasena = normalizedPassword
            };

            var json = JsonSerializer.Serialize(payload);
            try
            {
                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var resp = await _http.PostAsync(url, content, ct);
                var body = await resp.Content.ReadAsStringAsync(ct);

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("OUD login failed: {StatusCode}. Payload: {Payload}. Body: {Body}", resp.StatusCode, json, body);
                    return false;
                }

                if (IsSuccessfulAuthResponse(body))
                {
                    return true;
                }

                _logger.LogWarning("OUD login response rejected as invalid credentials. Payload: {Payload}. Body: {Body}", json, body);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error llamando OUD login. Payload: {Payload}", json);
                return false;
            }
        }

        private static bool IsSuccessfulAuthResponse(string body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return false;
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            if (!TryGetPropertyIgnoreCase(root, "estado", out var estadoElement))
            {
                return false;
            }

            if (estadoElement.ValueKind != JsonValueKind.True)
            {
                return false;
            }

            if (!TryGetPropertyIgnoreCase(root, "respuesta", out var respuestaElement))
            {
                return false;
            }

            if (respuestaElement.ValueKind == JsonValueKind.True)
            {
                return true;
            }

            if (respuestaElement.ValueKind == JsonValueKind.False || respuestaElement.ValueKind == JsonValueKind.Null)
            {
                return false;
            }

            if (respuestaElement.ValueKind == JsonValueKind.Array)
            {
                return respuestaElement.GetArrayLength() > 0;
            }

            if (respuestaElement.ValueKind == JsonValueKind.String &&
                bool.TryParse(respuestaElement.GetString(), out var asBool))
            {
                return asBool;
            }

            return false;
        }

        private static bool TryGetPropertyIgnoreCase(JsonElement element, string name, out JsonElement value)
        {
            if (element.TryGetProperty(name, out value))
            {
                return true;
            }

            foreach (var prop in element.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                {
                    value = prop.Value;
                    return true;
                }
            }

            value = default;
            return false;
        }
    }
}
