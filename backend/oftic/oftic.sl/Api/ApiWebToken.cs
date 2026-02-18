using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;  
using System;
using System.Net.Http;             
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Comun.Dtos;
using Servicios.ApiInterfaz;

namespace Servicios.Api
{
    public class ApiWebToken : IApiWebToken
    {
        private readonly IHttpClientFactory _factory;
        private readonly IConfiguration _cfg;
        private readonly ILogger<ApiWebToken> _logger;

        public ApiWebToken(
            IHttpClientFactory factory,
            IConfiguration cfg,
            ILogger<ApiWebToken> logger)
        {
            _factory = factory;
            _cfg = cfg;
            _logger = logger;
        }

        public async Task<DtoRespuesta<string>> ObtenerTokenPipAsync(CancellationToken ct)
        {
            var client = _factory.CreateClient("AuthClient");

            var url = _cfg["ApiSettings:OudLogin"]?.Trim();
            var usuario = _cfg["ApiSettings:UsuarioPip"];
            var clave = _cfg["ApiSettings:ClavePip"];

            var payload = new DtoUsuarioPip
            {
                usuario = usuario,
                clave = clave
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var resp = await client.PostAsync(url, content, ct);
            resp.EnsureSuccessStatusCode();

            var responseJson = await resp.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<DtoRespuesta<string>>(responseJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        }

        public async Task<DtoRespuesta<string>> ObtenerTokenSeviciosAsync(DtoUsuarioPip usuario)
        {
            var client = _factory.CreateClient("AuthClient");  
            var url = _cfg["ApiSettings:OudLogin"]!;

            var content = new StringContent(
                JsonSerializer.Serialize(usuario),
                Encoding.UTF8,
                "application/json");

            using var resp = await client.PostAsync(url, content);
            resp.EnsureSuccessStatusCode();

            var json = await resp.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<DtoRespuesta<string>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        }

        public async Task<string> GetTokenAsync(string usuario, string contrasena)
        {
            try
            {
                var client = _factory.CreateClient("AuthClient");
                var url = _cfg["ApiSettings:PostPipToken"] ?? "https://internalpip.policia.gov.co:8080/api/Cuenta/Token";

                var payload = new { Usuario = usuario, Contrasena = contrasena };
                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var resp = await client.PostAsync(url, content);
                
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Token request failed: {StatusCode}", resp.StatusCode);
                    return string.Empty;
                }

                var responseJson = await resp.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<DtoTokenResponse>(responseJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                return result?.token ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting token");
                return string.Empty;
            }
        }

        public async Task<DtoFuncionario> GetFuncionarioAsync(string token, string identificacion)
        {
            try
            {
                var client = _factory.CreateClient("AuthClient");
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

                var url = _cfg["ApiSettings:ConsultaFuncionarios"] ?? "https://internalpip.policia.gov.co:8080/api/Icahu/FuncionarioPorIdentificacion";
                url = $"{url}{identificacion}";

                var resp = await client.GetAsync(url);

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("GetFuncionario request failed: {StatusCode}", resp.StatusCode);
                    return new DtoFuncionario();
                }

                var json = await resp.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<DtoFuncionario>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new DtoFuncionario();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting employee");
                return new DtoFuncionario();
            }
        }

        public async Task<string> GetFotoFuncionarioAsync(string token, string identificacion)
        {
            try
            {
                var client = _factory.CreateClient("AuthClient");
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

                var baseUrl = "https://internalpip.policia.gov.co:8080/api/Icahu/ImagenFuncionarioB64";
                var url = $"{baseUrl}?_Identificacion={identificacion}";

                var resp = await client.GetAsync(url);

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("GetFoto request failed: {StatusCode}", resp.StatusCode);
                    return string.Empty;
                }

                return await resp.Content.ReadAsStringAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting photo");
                return string.Empty;
            }
        }
    }
}
