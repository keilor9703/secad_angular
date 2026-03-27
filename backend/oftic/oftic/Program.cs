using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;
using System.Text;
using Datos.Gestion;
using Datos.Interfaz;
using Negocio.Gestion;
using Negocio.Interfaz;
using Servicios.Api;
using Servicios.ApiInterfaz;

var builder = WebApplication.CreateBuilder(args);

// Kestrel: aumentar límite de tamaño de request para videos (150MB)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 150 * 1024 * 1024; // 150MB
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// CORS - Políticas separadas para desarrollo y producción
builder.Services.AddCors(options =>
{
    // Política Dev: solo localhost
    options.AddPolicy("DevCors", p =>
        p.WithOrigins("http://localhost:4200", "https://localhost:4200", "http://localhost:4300", "https://localhost:4300")
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());

    // Política Pública: permite cualquier origen para endpoints públicos
    options.AddPolicy("PublicCors", p =>
        p.SetIsOriginAllowed(_ => true)
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());
});

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "oftic.api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? jwtIssuer;

if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Configuracion insegura: Jwt:Key no configurada o demasiado corta. Defina una clave de al menos 32 caracteres en appsettings o variables de entorno.");
}

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddMemoryCache();

builder.Services.AddHttpClient("AuthClient");

builder.Services.AddScoped<ITokenProvider, TokenProvider>();

builder.Services.AddTransient<AuthHeaderHandler>();

builder.Services.AddHttpClient<IApiWebOud, ApiWebOud>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(15);
})
.AddHttpMessageHandler<AuthHeaderHandler>();

builder.Services.AddScoped<IApiWebToken, ApiWebToken>();

builder.Services.AddScoped<IDbMenuService, DbMenuService>();
builder.Services.AddScoped<IDbMenuRepository, DbMenuRepository>();
builder.Services.AddScoped<IDbUsuarioRepository, DbUsuarioRepository>();
builder.Services.AddScoped<IDbSliders, DbSliders>();
builder.Services.AddScoped<IDbHomeRepository, DbHomeRepository>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "OFTIC API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Ingrese: Bearer {token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddScoped<IDbAuthRepository, DbAuthRepository>();
builder.Services.AddScoped<IJwtService, JwtService>();


builder.Services.AddScoped<IDbLineaMandoService, DbLineaMandoService>();
builder.Services.AddScoped<IDbLineaMandoRepository, DbLineaMandoRepository>();
builder.Services.AddScoped<IDbRadioService, DbRadioService>();
builder.Services.AddScoped<IDbRadioRepository, DbRadioRepository>();

builder.Services.AddScoped<IDbDominioService, DbDominioService>();
builder.Services.AddScoped<IDbDominioRepository, DbDominioRepository>();

var app = builder.Build();

var uploadsRoot = Path.Combine(app.Environment.ContentRootPath, "uploads", "sliders");
Directory.CreateDirectory(uploadsRoot);

var radioLogosRoot = Path.Combine(app.Environment.ContentRootPath, "uploads", "radio");
Directory.CreateDirectory(radioLogosRoot);

app.UseCors("DevCors");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads/sliders"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(radioLogosRoot),
    RequestPath = "/uploads/radio"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok("OK"));

app.Run();
