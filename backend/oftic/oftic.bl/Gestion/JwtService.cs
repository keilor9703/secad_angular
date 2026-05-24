using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Negocio.Interfaz;

namespace Negocio.Gestion
{
    public class JwtService : IJwtService
    {
        private readonly IConfiguration _cfg;

        public JwtService(IConfiguration cfg)
        {
            _cfg = cfg;
        }

        public string CreateToken(long idUsuario, string usuario, List<long> roles, string codDane, string? nombreCad,
                                  int sitioGraba = 0, int acd = 0, int fuerzaId = 0, int canalId = 0)
        {
            var issuer = _cfg["Jwt:Issuer"] ?? "oftic.api";
            var audience = _cfg["Jwt:Audience"] ?? issuer;
            var key = _cfg["Jwt:Key"]!;
            var minutes = int.Parse(_cfg["Jwt:Minutes"] ?? "480");

            var claims = new List<Claim>
            {
                new("id_usuario",   idUsuario.ToString()),
                new(ClaimTypes.NameIdentifier, idUsuario.ToString()),
                new(ClaimTypes.Name, usuario ?? ""),
                new("cod_dane",     codDane),
                new("nombre_cad",   nombreCad ?? ""),
                new("sitio_graba",  sitioGraba.ToString()),
                new("acd",          acd.ToString()),
                new("fuerza_id",    fuerzaId.ToString()),
                new("canal_id",     canalId.ToString())
            };

            foreach (var r in roles)
                claims.Add(new Claim(ClaimTypes.Role, r.ToString()));

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
            var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(minutes),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string GenerateToken(string usuario)
        {
            var key = _cfg["Jwt:Key"]!;
            var minutes = 60;

            var claims = new List<Claim>
            {
                new(ClaimTypes.Name, usuario ?? ""),
                new(JwtRegisteredClaimNames.Sub, usuario ?? "")
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
            var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _cfg["Jwt:Issuer"] ?? "oftic.api",
                audience: _cfg["Jwt:Audience"] ?? "oftic.api",
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(minutes),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
