using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Servicios.ApiInterfaz;

namespace Servicios.Api
{
    /// <summary>
    /// Envío de SMS vía Infobip (https://www.infobip.com/docs/api) — endpoint
    /// POST /sms/3/messages. Configuración en la sección "Sms:Infobip" de
    /// appsettings (BaseUrl/ApiKey/Sender) — nunca commitear el ApiKey real acá:
    /// va en appsettings.Local.json (ignorado en git) o en la variable de entorno
    /// Sms__Infobip__ApiKey.
    ///
    /// Mientras la cuenta Infobip esté en modo de prueba gratuito, solo entrega a
    /// números verificados en el portal y con un cupo limitado de mensajes — fuera
    /// de eso (o si BaseUrl/ApiKey no están configurados), el método degrada
    /// igual que antes: deja el intento en el log y devuelve false, sin romper el
    /// flujo de videollamada — el despachador siempre ve el link en la respuesta
    /// de VideoLlamadaController para copiarlo y enviarlo manualmente.
    /// </summary>
    public class InfobipProveedorSms : IProveedorSms
    {
        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy   = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private readonly HttpClient _http;
        private readonly IConfiguration _cfg;
        private readonly ILogger<InfobipProveedorSms> _logger;

        public InfobipProveedorSms(HttpClient http, IConfiguration cfg, ILogger<InfobipProveedorSms> logger)
        {
            _http   = http;
            _cfg    = cfg;
            _logger = logger;
        }

        public async Task<bool> EnviarSmsAsync(string numero, string mensaje, CancellationToken ct = default)
        {
            var host   = NormalizarHost(_cfg["Sms:Infobip:BaseUrl"]);
            var apiKey = _cfg["Sms:Infobip:ApiKey"]?.Trim();

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning(
                    "Sms:Infobip no configurado (BaseUrl/ApiKey) — SMS NO enviado. Destino={Numero}", numero);
                return false;
            }

            var destino = NormalizarNumero(numero);
            if (destino is null)
            {
                _logger.LogWarning("Número de destino inválido para SMS: {Numero}", numero);
                return false;
            }

            var body = new InfobipRequest
            {
                Messages = new[]
                {
                    new InfobipMensaje
                    {
                        Destinations = new[] { new InfobipDestino { To = destino } },
                        Text         = mensaje,
                        From         = string.IsNullOrWhiteSpace(_cfg["Sms:Infobip:Sender"])
                            ? null
                            : _cfg["Sms:Infobip:Sender"]!.Trim()
                    }
                }
            };

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, $"https://{host}/sms/3/messages");
                req.Headers.TryAddWithoutValidation("Authorization", $"App {apiKey}");
                req.Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json");

                using var resp = await _http.SendAsync(req, ct);
                var respBody = await resp.Content.ReadAsStringAsync(ct);

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Infobip SMS falló ({Status}) para {Numero}: {Body}", resp.StatusCode, destino, respBody);
                    return false;
                }

                _logger.LogInformation("Infobip SMS enviado a {Numero}. Respuesta: {Body}", destino, respBody);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error llamando a Infobip SMS, destino={Numero}", destino);
                return false;
            }
        }

        /// <summary>Quita el esquema si vino incluido (el portal de Infobip solo entrega el host, p.ej. "xxxxx.api.infobip.com").</summary>
        private static string NormalizarHost(string? baseUrl)
        {
            var h = (baseUrl ?? "").Trim().TrimEnd('/');
            if (h.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) h = h[8..];
            else if (h.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) h = h[7..];
            return h;
        }

        /// <summary>
        /// Formato internacional sin '+' (requerido por Infobip). Asume Colombia
        /// (57) cuando el número viene en formato nacional celular de 10 dígitos.
        /// </summary>
        private static string? NormalizarNumero(string numero)
        {
            var digitos = new string((numero ?? "").Where(char.IsDigit).ToArray());
            if (digitos.Length == 10 && digitos.StartsWith('3'))
                return "57" + digitos;
            if (digitos.Length == 12 && digitos.StartsWith("57"))
                return digitos;
            return digitos.Length >= 8 ? digitos : null;
        }

        private sealed class InfobipRequest
        {
            public InfobipMensaje[] Messages { get; init; } = Array.Empty<InfobipMensaje>();
        }

        private sealed class InfobipMensaje
        {
            public InfobipDestino[] Destinations { get; init; } = Array.Empty<InfobipDestino>();
            public string?          From         { get; init; }
            public string           Text         { get; init; } = "";
        }

        private sealed class InfobipDestino
        {
            public string To { get; init; } = "";
        }
    }
}
