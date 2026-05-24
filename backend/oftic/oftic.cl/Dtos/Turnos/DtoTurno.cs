namespace Comun.Dtos.Turnos;

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de dominio — deben coincidir con cad_referencias_secad
// ─────────────────────────────────────────────────────────────────────────────

public static class ClaseTurno
{
    public const int Primero  = 1;   // 06:00 – 14:00
    public const int Segundo  = 2;   // 14:00 – 22:00
    public const int Tercero  = 3;   // 22:00 – 06:00

    public static string Descripcion(int clase) => clase switch
    {
        1 => "Primer Turno",
        2 => "Segundo Turno",
        3 => "Tercer Turno",
        _ => $"Turno {clase}"
    };
}

public static class EstadoTurno
{
    public const string Activo  = "A";
    public const string Cerrado = "C";
    public const string Anulado = "V";
}

public static class EstadoMedio
{
    public const int Libre           = 27;
    public const int Ocupado         = 28;
    public const int FueraDeServicio = 29;
    public const int EnRuta          = 30;
    public const int EnBase          = 31;

    public static string Descripcion(int estado) => estado switch
    {
        27 => "Libre",
        28 => "Ocupado",
        29 => "Fuera de servicio",
        30 => "En ruta",
        31 => "En base",
        _  => $"Estado {estado}"
    };
}

public static class TipoMedio
{
    public const int Motocicleta    = 20;
    public const int Bicicleta      = 21;
    public const int Patrulla       = 22;
    public const int Ambulancia     = 23;
    public const int CamionBomberos = 24;
    public const int Helicoptero    = 25;
    public const int Lancha         = 26;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de Turno (header)
// ─────────────────────────────────────────────────────────────────────────────

public class DtoTurno
{
    public long    Id                  { get; set; }
    public int     SitioGraba          { get; set; }
    public int     FuerzaId            { get; set; }
    public string  FuerzaDescripcion   { get; set; } = "";
    public int     ClaseTurno          { get; set; }
    public string  ClaseTurnoDesc      { get; set; } = "";
    public int?    TipoTurno           { get; set; }
    public string  TipoTurnoDesc       { get; set; } = "";
    public string  HoraInicia          { get; set; } = "";   // dd/MM/yyyy HH:mm
    public string  HoraTermina         { get; set; } = "";
    public string  DiaInicia           { get; set; } = "";   // dd/MM/yyyy
    public string? Consignas           { get; set; }
    public string  Estado              { get; set; } = EstadoTurno.Activo;
    public bool    SiviccSincronizado  { get; set; }
    public string? SiviccFechaSync     { get; set; }
    public string  FechaCreacion       { get; set; } = "";
    public string? UsuarioCrea         { get; set; }
    // Conteos para la lista
    public int     TotalUnidades       { get; set; }
    public int     TotalMedios         { get; set; }
}

public class DtoTurnoListItem
{
    public long   Id               { get; set; }
    public int    ClaseTurno       { get; set; }
    public string ClaseTurnoDesc   { get; set; } = "";
    public string FuerzaDesc       { get; set; } = "";
    public string HoraInicia       { get; set; } = "";
    public string HoraTermina      { get; set; } = "";
    public string Estado           { get; set; } = "";
    public int    TotalUnidades    { get; set; }
    public int    TotalMedios      { get; set; }
    public bool   SiviccSync       { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de Unidad en Turno
// ─────────────────────────────────────────────────────────────────────────────

public class DtoTurnoUnidad
{
    public long    Id                { get; set; }
    public long    TurnoId           { get; set; }
    public string  UnidadCodigo      { get; set; } = "";
    public string  UnidadDesc        { get; set; } = "";
    public int?    FuerzaId          { get; set; }
    public string? Consignas         { get; set; }
    public string  Origen            { get; set; } = "MANUAL";
    public int?    SiviccMinutaId    { get; set; }
    public int?    SiviccConsecutivo { get; set; }
    public int     TotalMedios       { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de Medio Disponible
// ─────────────────────────────────────────────────────────────────────────────

public class DtoPersonalMedio
{
    public string  CeduEmpleado   { get; set; } = "";
    public string? NombrePolicial { get; set; }
    public string? DescCargo      { get; set; }
}

/// <summary>
/// Medio disponible en turno — versión completa para el panel de despacho.
/// Incluye posición GPS y personal asignado.
/// </summary>
public class DtoMedioDisponible
{
    public long    Id               { get; set; }
    public int     SitioGraba       { get; set; }
    public long    TurnoId          { get; set; }
    public long?   TurnoUnidadId    { get; set; }
    public string? UnidadCodigo     { get; set; }
    public int?    FuerzaId         { get; set; }

    // Canal de radio
    public int?    CanalFuerzaId    { get; set; }
    public int?    CanalCodigo      { get; set; }
    public string  CanalDesc        { get; set; } = "";

    // Identificación del recurso
    public string  PatrullaCodigo   { get; set; } = "";
    public string  PatrullaDesc     { get; set; } = "";
    public int     TipoMedio        { get; set; } = global::Comun.Dtos.Turnos.TipoMedio.Patrulla;
    public string  TipoMedioDesc    { get; set; } = "";

    // Estado operativo
    public int     Estado           { get; set; } = EstadoMedio.Libre;
    public string  EstadoDesc       { get; set; } = "";

    // Ubicación GPS (última posición reportada por GESPO)
    public double? Latitud          { get; set; }
    public double? Longitud         { get; set; }
    public double? VelocidadKmh     { get; set; }
    public double? RumboGrados      { get; set; }
    public string? FechaUbicacion   { get; set; }
    /// <summary>True si la última posición tiene menos de 10 minutos.</summary>
    public bool    GpsActivo        { get; set; }

    // Incidente actual (si está ocupado/en ruta)
    public long?   EventoId         { get; set; }
    public long?   ActuacionId      { get; set; }

    // Personal asignado
    public List<DtoPersonalMedio> Personal { get; set; } = new();

    // Distancia al incidente activo (calculada en el cliente o en el servidor)
    public double? DistanciaKm      { get; set; }
}

/// <summary>
/// Versión reducida para la grilla en tiempo real del módulo de Eventos.
/// Se serializa compacto para minimizar payload en polling.
/// </summary>
public class DtoMedioDisponibleResumen
{
    public long    Id             { get; set; }
    public string  PatrullaCodigo { get; set; } = "";
    public string  PatrullaDesc   { get; set; } = "";
    public int     TipoMedio      { get; set; }
    public int     Estado         { get; set; }
    public string  EstadoDesc     { get; set; } = "";
    public string  CanalDesc      { get; set; } = "";
    public double? Lat            { get; set; }
    public double? Lng            { get; set; }
    public bool    GpsActivo      { get; set; }
    public long?   EventoId       { get; set; }
    public double? DistanciaKm    { get; set; }
    // Personal resumido
    public string  PersonalResumen { get; set; } = "";  // "Cédula1 / Cédula2"
}

// ─────────────────────────────────────────────────────────────────────────────
// Requests y resultados
// ─────────────────────────────────────────────────────────────────────────────

public class DtoCrearTurnoRequest
{
    public int     SitioGraba   { get; set; }
    public int     FuerzaId     { get; set; }
    public int     ClaseTurno   { get; set; }
    public int?    TipoTurno    { get; set; }
    /// <summary>Formato: dd/MM/yyyy HH:mm</summary>
    public string  HoraInicia   { get; set; } = "";
    public string  HoraTermina  { get; set; } = "";
    public string? Consignas    { get; set; }
}

public class DtoCopiarTurnoRequest
{
    public long    TurnoOrigenId { get; set; }
    public int     ClaseTurno    { get; set; }
    public int?    TipoTurno     { get; set; }
    public string  HoraInicia    { get; set; } = "";
    public string  HoraTermina   { get; set; } = "";
}

public class DtoAgregarUnidadRequest
{
    public long    TurnoId          { get; set; }
    public string  UnidadCodigo     { get; set; } = "";
    public string? UnidadDesc       { get; set; }
    public int?    FuerzaId         { get; set; }
    public string? Consignas        { get; set; }
    /// <summary>MANUAL | SIVICC</summary>
    public string  Origen           { get; set; } = "MANUAL";
    public int?    SiviccMinutaId   { get; set; }
    public int?    SiviccConsecutivo { get; set; }
}

public class DtoAgregarMedioRequest
{
    public long    TurnoId         { get; set; }
    public long?   TurnoUnidadId   { get; set; }
    public string? UnidadCodigo    { get; set; }
    public int?    FuerzaId        { get; set; }
    public int?    CanalFuerzaId   { get; set; }
    public int?    CanalCodigo     { get; set; }
    public string  PatrullaCodigo  { get; set; } = "";
    public string? PatrullaDesc    { get; set; }
    public int     TipoMedio       { get; set; } = global::Comun.Dtos.Turnos.TipoMedio.Patrulla;
    public List<DtoPersonalMedio> Personal { get; set; } = new();
}

public class DtoImportarSiviccRequest
{
    public long   TurnoId           { get; set; }
    public int    SiviccMinutaId    { get; set; }
    public int    SiviccConsecutivo { get; set; }  // CONS_SIATH de la unidad
    public int?   CanalCodigo       { get; set; }  // canal de radio a asignar
    public int?   CanalFuerzaId     { get; set; }
    public int    FuerzaId          { get; set; }
    public int    SitioGraba        { get; set; }
}

public class DtoCambiarEstadoMedioRequest
{
    public int     NuevoEstado    { get; set; }
    public long?   EventoId       { get; set; }
    public long?   ActuacionId    { get; set; }
    public string? Observacion    { get; set; }
}

/// <summary>
/// Posición GPS recibida desde GESPO (un item por patrulla).
/// </summary>
public class DtoGespoUbicacion
{
    public string  PatrullaCodigo { get; set; } = "";
    public double  Latitud        { get; set; }
    public double  Longitud       { get; set; }
    public double? VelocidadKmh   { get; set; }
    public double? RumboGrados    { get; set; }
    public string  FechaGps       { get; set; } = "";   // ISO-8601
}

public class DtoTurnoResult
{
    public bool   Success   { get; set; }
    public string Message   { get; set; } = "";
    public long   Id        { get; set; }
}
