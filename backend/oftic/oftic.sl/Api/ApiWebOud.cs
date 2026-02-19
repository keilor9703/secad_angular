using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Extensions.Configuration;
using Servicios.ApiInterfaz;
using System.Threading.Tasks;

namespace Servicios.Api
{
    public class ApiWebOud : IApiWebOud
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _cfg;
       public ApiWebOud(HttpClient http, IConfiguration cfg)
        {
            _http = http;
            _cfg = cfg;
        }

        public async Task<string> ConsultarFuncionarioAsync(string identificacion, CancellationToken ct)
        {
            var baseUrl = _cfg["ApiSettings:ConsultaFuncionarios"]!;
            var url = $"{baseUrl}{Uri.EscapeDataString(identificacion)}";

            using var resp = await _http.GetAsync(url, ct);
            resp.EnsureSuccessStatusCode();

            return await resp.Content.ReadAsStringAsync(ct);
        }
    }
}
