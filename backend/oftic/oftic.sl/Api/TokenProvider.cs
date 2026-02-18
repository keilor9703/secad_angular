using Comun.Dtos;                   
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging; 
using Servicios.ApiInterfaz;        
using System;
using System.Net.Http;              
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Servicios.Api             
{
  
    public class TokenProvider : ITokenProvider
    {
        private readonly IHttpClientFactory _factory;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _cfg;
        private readonly ILogger<TokenProvider> _logger;

        public TokenProvider(
            IHttpClientFactory factory,
            IMemoryCache cache,
            IConfiguration cfg,
            ILogger<TokenProvider> logger)
        {
            _factory = factory;
            _cache = cache;
            _cfg = cfg;
            _logger = logger;
        }

        public async Task<string> GetTokenAsync(CancellationToken ct = default)
        {
            if (_cache.TryGetValue("oud_token", out string token))
            {
                _logger.LogDebug("Token obtenido de caché");
                return token;
            }

            token = await FetchTokenAsync(ct);

            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(25))
                .RegisterPostEvictionCallback((key, value, reason, state) =>
                {
                    _logger.LogInformation("Token expirado del caché: {Reason}", reason);
                });

            _cache.Set("oud_token", token, cacheOptions);
            _cache.Set("oud_token_expiry", DateTime.UtcNow.AddMinutes(25));

            _logger.LogInformation("Token guardado en caché por 25 minutos");

            return token;
        }

        private async Task<string> FetchTokenAsync(CancellationToken ct)
        {
            var client = _factory.CreateClient("AuthClient");

            // ✅ URL correcta desde config
            var url = _cfg["ApiSettings:PostPipToken"]?.Trim();
            var usuario = _cfg["ApiSettings:UsuarioPip"];
            var clave = _cfg["ApiSettings:ClavePip"];

            if (string.IsNullOrEmpty(url))
                throw new InvalidOperationException("PostPipToken no configurado");

            _logger.LogInformation("Obteniendo token de: {Url}", url);

            var payload = new
            {
                usuario = usuario,
                clave = clave
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var resp = await client.PostAsync(url, content, ct);

            if (!resp.IsSuccessStatusCode)
            {
                var error = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogError("Error {StatusCode}: {Error}", resp.StatusCode, error);
                throw new HttpRequestException($"API devolvió {resp.StatusCode}: {error}");
            }

            var responseJson = await resp.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<DtoRespuesta<string>>(responseJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (result?.Codigo != 1 || string.IsNullOrEmpty(result.Respuesta))
            {
                throw new InvalidOperationException($"Error en respuesta: {result?.Mensaje}");
            }

            _logger.LogInformation("Token obtenido exitosamente");
            return result.Respuesta!;
        }
    }
}