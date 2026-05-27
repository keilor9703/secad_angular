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
        private readonly string _key = "EstaEsUnaClaveSecretaMuyLargaParaJWT2024!";
        private readonly string _issuer = "oftic.api";
        private readonly string _audience = "oftic.api";

        public JwtService(IConfiguration cfg)
        {
            _cfg = cfg;
        }

        public string CreateToken(long idUsuario, string usuario, List<long> roles)
        {
            var issuer = _cfg["Jwt:Issuer"] ?? _issuer;
            var audience = _cfg["Jwt:Audience"] ?? _audience;
            var key = _cfg["Jwt:Key"] ?? _key;
            var minutes = int.Parse(_cfg["Jwt:Minutes"] ?? "60");

            var claims = new List<Claim>
                {
                new Claim("id_usuario", idUsuario.ToString()),
                new Claim(ClaimTypes.NameIdentifier, idUsuario.ToString()),
                new Claim(ClaimTypes.Name, usuario ?? "")
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
            signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string GenerateToken(string usuario)
        {
            var minutes = 60;
            
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, usuario ?? ""),
                new Claim(JwtRegisteredClaimNames.Sub, usuario ?? "")
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key));
            var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _issuer,
                audience: _audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(minutes),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

}

