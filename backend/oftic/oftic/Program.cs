using Api.Converters;
using Api.Middleware;
using Comun.Snowflake;
using Datos.Gestion;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Negocio.Gestion;
using Negocio.Interfaz;
using Npgsql;
using Servicios.Api;
using Servicios.ApiInterfaz;
using Servicios.Snowflake;
using System.IO;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Kestrel: aumentar límite para videos (150 MB)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 150 * 1024 * 1024;
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        // Serializar long / long? como cadena JSON para evitar pérdida de precisión
        // en JavaScript (Number.MAX_SAFE_INTEGER ≈ 9 × 10^15; Snowflake IDs ≈ 10^18).
        options.JsonSerializerOptions.Converters.Add(new LongToStringJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new NullableLongToStringJsonConverter());
    });

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", p =>
        p.WithOrigins("http://localhost:4200", "https://localhost:4200", "http://localhost:4300", "https://localhost:4300")
         .AllowAnyHeader().AllowAnyMethod().AllowCredentials());

    options.AddPolicy("PublicCors", p =>
        p.SetIsOriginAllowed(_ => true)
         .AllowAnyHeader().AllowAnyMethod().AllowCredentials());
});

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "oftic.api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? jwtIssuer;

if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException(
        "Jwt:Key no configurada o demasiado corta (mínimo 32 caracteres).");

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

// Master DB (PostgreSQL): NpgsqlDataSource singleton
var masterConnStr = builder.Configuration.GetConnectionString("MasterDb")
    ?? throw new InvalidOperationException("ConnectionStrings:MasterDb no configurada.");
builder.Services.AddSingleton(NpgsqlDataSource.Create(masterConnStr));

// Tenant infrastructure
builder.Services.AddSingleton<ConnectionPoolManager>();
builder.Services.AddScoped<TenantContext>();

// Snowflake ID generator — singleton: one instance per process, shared across all requests.
// NodeId is read from appsettings.json "Snowflake:NodeId".
// Main node = 1, Edge node = 2. Never share the same NodeId between two live nodes.
builder.Services.AddSingleton<ISnowflakeGenerator, SnowflakeGenerator>();

// HTTP clients for external APIs
builder.Services.AddHttpClient("AuthClient");
builder.Services.AddScoped<ITokenProvider, TokenProvider>();
builder.Services.AddTransient<AuthHeaderHandler>();

builder.Services.AddHttpClient<IApiWebOud, ApiWebOud>(c =>
    c.Timeout = TimeSpan.FromSeconds(15))
    .AddHttpMessageHandler<AuthHeaderHandler>();

builder.Services.AddScoped<IApiWebToken, ApiWebToken>();

// Data repositories
builder.Services.AddScoped<IDbMasterRepository, DbMasterRepository>();
builder.Services.AddScoped<IDbAuthRepository, DbAuthRepository>();
builder.Services.AddScoped<IDbMenuRepository, DbMenuRepository>();
builder.Services.AddScoped<IDbMenuService, DbMenuService>();
builder.Services.AddScoped<IDbUsuarioRepository, DbUsuarioRepository>();
builder.Services.AddScoped<IDbHomeRepository, DbHomeRepository>();
builder.Services.AddScoped<IDbDominioRepository, DbDominioRepository>();
builder.Services.AddScoped<IDbDominioService, DbDominioService>();
builder.Services.AddScoped<IDbVideoRepository, DbVideoRepository>();
builder.Services.AddScoped<IDbVideoService, DbVideoService>();
builder.Services.AddScoped<IDbLineaMandoRepository, DbLineaMandoRepository>();
builder.Services.AddScoped<IDbLineaMandoService, DbLineaMandoService>();
builder.Services.AddScoped<IDbPedidoRepository, DbPedidoRepository>();
builder.Services.AddScoped<IDbPedidoService, DbPedidoService>();
builder.Services.AddScoped<IDbRecepcionRepository, DbRecepcionRepository>();
builder.Services.AddScoped<IDbRecepcionService, DbRecepcionService>();
builder.Services.AddScoped<IDbActuacionRepository, DbActuacionRepository>();
builder.Services.AddScoped<IDbActuacionService, DbActuacionService>();
builder.Services.AddScoped<IDbTurnoRepository, DbTurnoRepository>();
builder.Services.AddScoped<IDbTurnoService, DbTurnoService>();

// Business services
builder.Services.AddScoped<IJwtService, JwtService>();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "SECAD API", Version = "v1" });
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
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseCors("DevCors");

// Serve uploaded files (videos, backgrounds, etc.)
var uploadsDir = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsDir);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads"
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();

// TenantMiddleware: runs after auth, resolves tenant from JWT cod_dane claim
app.UseMiddleware<TenantMiddleware>();

app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok("OK"));

app.Run();
