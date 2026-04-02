-- =====================================================
-- Tabla: CTR_NOTICIAS
-- Administración de noticias institucionales
-- =====================================================
CREATE TABLE CTR_NOTICIAS (
    ID_NOTICIA         NUMBER          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    UNIDAD             VARCHAR2(100)   NOT NULL,
    TITULO             VARCHAR2(300)  NOT NULL,
    SECCION            VARCHAR2(50)   NOT NULL,
    CIUDAD             VARCHAR2(100)  NOT NULL,
    IMAGEN_NOTICIA     VARCHAR2(500),
    SUBTITULO          VARCHAR2(500),
    CONTENIDO          CLOB,
    VIGENTE            NUMBER(1)      DEFAULT 1,
    FECHA_CREACION     DATE           DEFAULT SYSDATE,
    USUARIO_CREACION   VARCHAR2(100)  NOT NULL,
    MAQUINA_CREACION   VARCHAR2(100),
    FECHA_MODIFICA     DATE,
    USUARIO_MODIFICA   VARCHAR2(100),
    MAQUINA_MODIFICA   VARCHAR2(100)
);

COMMENT ON TABLE  CTR_NOTICIAS             IS 'Tabla de noticias institucionales';
COMMENT ON COLUMN CTR_NOTICIAS.ID_NOTICIA       IS 'Identificador único de la noticia';
COMMENT ON COLUMN CTR_NOTICIAS.UNIDAD           IS 'Unidad policiva responsable';
COMMENT ON COLUMN CTR_NOTICIAS.TITULO           IS 'Título de la noticia';
COMMENT ON COLUMN CTR_NOTICIAS.SECCION          IS 'Sección: Comunicado, Servicio, Importante, Evento, Galería';
COMMENT ON COLUMN CTR_NOTICIAS.CIUDAD           IS 'Ciudad de la noticia';
COMMENT ON COLUMN CTR_NOTICIAS.IMAGEN_NOTICIA   IS 'Ruta o nombre del archivo de imagen';
COMMENT ON COLUMN CTR_NOTICIAS.SUBTITULO        IS 'Subtítulo o resumen breve';
COMMENT ON COLUMN CTR_NOTICIAS.CONTENIDO        IS 'Contenido HTML o texto de la noticia';
COMMENT ON COLUMN CTR_NOTICIAS.VIGENTE          IS '1=Activo, 0=Inactivo';
COMMENT ON COLUMN CTR_NOTICIAS.FECHA_CREACION   IS 'Fecha de creación del registro';
COMMENT ON COLUMN CTR_NOTICIAS.USUARIO_CREACION IS 'Usuario que creó el registro';
COMMENT ON COLUMN CTR_NOTICIAS.MAQUINA_CREACION IS 'Máquina donde se creó el registro';
COMMENT ON COLUMN CTR_NOTICIAS.FECHA_MODIFICA   IS 'Fecha de última modificación';
COMMENT ON COLUMN CTR_NOTICIAS.USUARIO_MODIFICA IS 'Usuario que modificó el registro';
COMMENT ON COLUMN CTR_NOTICIAS.MAQUINA_MODIFICA IS 'Máquina donde se modificó el registro';

-- Índices para búsquedas frecuentes
CREATE INDEX IDX_NOTICIAS_VIGENTE    ON CTR_NOTICIAS(VIGENTE);
CREATE INDEX IDX_NOTICIAS_SECCION    ON CTR_NOTICIAS(SECCION);
CREATE INDEX IDX_NOTICIAS_UNIDAD    ON CTR_NOTICIAS(UNIDAD);
CREATE INDEX IDX_NOTICIAS_FECHA     ON CTR_NOTICIAS(FECHA_CREACION DESC);

-- Insertar datos de prueba
INSERT INTO CTR_NOTICIAS (UNIDAD, TITULO, SECCION, CIUDAD, IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE, USUARIO_CREACION, MAQUINA_CREACION)
VALUES (
    'Policía Nacional',
    'Actualización del sistema SISGE',
    'Comunicado',
    'Bogotá',
    'noticia1.jpg',
    'Se implementaron mejoras de rendimiento y ajustes visuales',
    '<p>Se implementaron mejoras de rendimiento y ajustes visuales en formularios y turnos de pago.</p><p>El equipo de desarrollo trabajó durante varias semanas para optimizar el sistema.</p>',
    1,
    'admin',
    'SERVIDOR-01'
);

INSERT INTO CTR_NOTICIAS (UNIDAD, TITULO, SECCION, CIUDAD, IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE, USUARIO_CREACION, MAQUINA_CREACION)
VALUES (
    'GUTIC',
    'Nueva guía para radicación',
    'Servicio',
    'Bogotá',
    'noticia2.jpg',
    'Consulta el paso a paso actualizado para radicar documentos',
    '<p>Consulta el paso a paso actualizado para radicar y validar documentos en el módulo judicial.</p><p>Esta guía contiene todos los pasos necesarios para el correcto trámite.</p>',
    1,
    'admin',
    'SERVIDOR-01'
);

INSERT INTO CTR_NOTICIAS (UNIDAD, TITULO, SECCION, CIUDAD, IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE, USUARIO_CREACION, MAQUINA_CREACION)
VALUES (
    'OFTIC',
    'Ventana de mantenimiento programada',
    'Importante',
    'Nacional',
    'noticia3.jpg',
    'El sistema tendrá una ventana programada el fin de semana',
    '<p>El sistema tendrá una ventana programada el fin de semana para actualización de seguridad.</p><p>Se recomienda guardar su trabajo antes del mantenimiento.</p>',
    1,
    'admin',
    'SERVIDOR-01'
);

INSERT INTO CTR_NOTICIAS (UNIDAD, TITULO, SECCION, CIUDAD, IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE, USUARIO_CREACION, MAQUINA_CREACION)
VALUES (
    'OFTIC',
    'SISGE - Sistema de Gestión Institucional',
    'Comunicado',
    'Nacional',
    'sisge-sistema.jpg',
    'Nueva plataforma tecnológica para la gestión de información policial',
    '<p>La Oficina de Tecnologías de la Información y las Comunicaciones (OFTIC) presenta el nuevo Sistema de Gestión Institucional (SISGE), una plataforma tecnológica diseñada para optimizar la administración de información dentro de la Policía Nacional.</p><p><strong>Características principales:</strong></p><ul><li>Gestión centralizada de dominios organizacionales</li><li>Administración de línea de mando</li><li>Sliders y contenido multimedia institucional</li><li>Radioemisoras en línea</li><li>Videos institucionales y de unidad</li><li>Control de acceso basado en roles</li></ul><p>Este sistema representa un avance significativo en la digitalización de nuestros procesos internos, permitiendo una gestión más eficiente y transparente de la información.</p><p>Para acceder al sistema, utilize sus credenciales institucionales. Si requiere asistencia técnica, contacte a la Oficina de Tecnologías de la Información.</p>',
    1,
    'sistema',
    'SERVIDOR-OFTIC'
);

COMMIT;

-- =====================================================
-- Stored Procedures para CTR_NOTICIAS
-- =====================================================

-- SP: Crear noticia
CREATE OR REPLACE PROCEDURE SP_CREAR_NOTICIA(
    P_UNIDAD             IN CTR_NOTICIAS.UNIDAD%TYPE,
    P_TITULO             IN CTR_NOTICIAS.TITULO%TYPE,
    P_SECCION            IN CTR_NOTICIAS.SECCION%TYPE,
    P_CIUDAD             IN CTR_NOTICIAS.CIUDAD%TYPE,
    P_IMAGEN_NOTICIA     IN CTR_NOTICIAS.IMAGEN_NOTICIA%TYPE,
    P_SUBTITULO          IN CTR_NOTICIAS.SUBTITULO%TYPE,
    P_CONTENIDO          IN CTR_NOTICIAS.CONTENIDO%TYPE,
    P_USUARIO_CREACION   IN CTR_NOTICIAS.USUARIO_CREACION%TYPE,
    P_MAQUINA_CREACION   IN CTR_NOTICIAS.MAQUINA_CREACION%TYPE,
    P_RESULTADO          OUT NUMBER,
    P_MENSAJE            OUT VARCHAR2
) AS
BEGIN
    P_RESULTADO := 0;
    P_MENSAJE := 'OK';
    
    INSERT INTO CTR_NOTICIAS (
        UNIDAD, TITULO, SECCION, CIUDAD, IMAGEN_NOTICIA, 
        SUBTITULO, CONTENIDO, VIGENTE, 
        USUARIO_CREACION, MAQUINA_CREACION
    ) VALUES (
        P_UNIDAD, P_TITULO, P_SECCION, P_CIUDAD, P_IMAGEN_NOTICIA,
        P_SUBTITULO, P_CONTENIDO, 1,
        P_USUARIO_CREACION, P_MAQUINA_CREACION
    );
    
    COMMIT;
    
EXCEPTION
    WHEN OTHERS THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'Error al crear noticia: ' || SQLERRM;
        ROLLBACK;
END SP_CREAR_NOTICIA;
/

-- SP: Actualizar noticia
CREATE OR REPLACE PROCEDURE SP_ACTUALIZAR_NOTICIA(
    P_ID_NOTICIA         IN CTR_NOTICIAS.ID_NOTICIA%TYPE,
    P_UNIDAD             IN CTR_NOTICIAS.UNIDAD%TYPE,
    P_TITULO             IN CTR_NOTICIAS.TITULO%TYPE,
    P_SECCION            IN CTR_NOTICIAS.SECCION%TYPE,
    P_CIUDAD             IN CTR_NOTICIAS.CIUDAD%TYPE,
    P_IMAGEN_NOTICIA     IN CTR_NOTICIAS.IMAGEN_NOTICIA%TYPE,
    P_SUBTITULO          IN CTR_NOTICIAS.SUBTITULO%TYPE,
    P_CONTENIDO          IN CTR_NOTICIAS.CONTENIDO%TYPE,
    P_USUARIO_MODIFICA   IN CTR_NOTICIAS.USUARIO_MODIFICA%TYPE,
    P_MAQUINA_MODIFICA   IN CTR_NOTICIAS.MAQUINA_MODIFICA%TYPE,
    P_RESULTADO          OUT NUMBER,
    P_MENSAJE            OUT VARCHAR2
) AS
BEGIN
    P_RESULTADO := 0;
    P_MENSAJE := 'OK';
    
    UPDATE CTR_NOTICIAS SET
        UNIDAD = P_UNIDAD,
        TITULO = P_TITULO,
        SECCION = P_SECCION,
        CIUDAD = P_CIUDAD,
        IMAGEN_NOTICIA = P_IMAGEN_NOTICIA,
        SUBTITULO = P_SUBTITULO,
        CONTENIDO = P_CONTENIDO,
        FECHA_MODIFICA = SYSDATE,
        USUARIO_MODIFICA = P_USUARIO_MODIFICA,
        MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
    WHERE ID_NOTICIA = P_ID_NOTICIA;
    
    IF SQL%ROWCOUNT = 0 THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'La noticia no existe';
        ROLLBACK;
        RETURN;
    END IF;
    
    COMMIT;
    
EXCEPTION
    WHEN OTHERS THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'Error al actualizar noticia: ' || SQLERRM;
        ROLLBACK;
END SP_ACTUALIZAR_NOTICIA;
/

-- SP: Eliminar (inactivar) noticia
CREATE OR REPLACE PROCEDURE SP_ELIMINAR_NOTICIA(
    P_ID_NOTICIA         IN CTR_NOTICIAS.ID_NOTICIA%TYPE,
    P_USUARIO_MODIFICA   IN CTR_NOTICIAS.USUARIO_MODIFICA%TYPE,
    P_MAQUINA_MODIFICA   IN CTR_NOTICIAS.MAQUINA_MODIFICA%TYPE,
    P_RESULTADO          OUT NUMBER,
    P_MENSAJE            OUT VARCHAR2
) AS
BEGIN
    P_RESULTADO := 0;
    P_MENSAJE := 'OK';
    
    UPDATE CTR_NOTICIAS SET
        VIGENTE = 0,
        FECHA_MODIFICA = SYSDATE,
        USUARIO_MODIFICA = P_USUARIO_MODIFICA,
        MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
    WHERE ID_NOTICIA = P_ID_NOTICIA;
    
    IF SQL%ROWCOUNT = 0 THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'La noticia no existe';
        ROLLBACK;
        RETURN;
    END IF;
    
    COMMIT;
    
EXCEPTION
    WHEN OTHERS THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'Error al eliminar noticia: ' || SQLERRM;
        ROLLBACK;
END SP_ELIMINAR_NOTICIA;
/

-- SP: Consultar todas las noticias (para admin)
CREATE OR REPLACE PROCEDURE SP_CONSULTAR_NOTICIAS(
    P_CURSOR   OUT SYS_REFCURSOR,
    P_RESULTADO OUT NUMBER,
    P_MENSAJE  OUT VARCHAR2
) AS
BEGIN
    P_RESULTADO := 0;
    P_MENSAJE := 'OK';
    
    OPEN P_CURSOR FOR
        SELECT 
            ID_NOTICIA, UNIDAD, TITULO, SECCION, CIUDAD,
            IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE,
            FECHA_CREACION, USUARIO_CREACION, MAQUINA_CREACION,
            FECHA_MODIFICA, USUARIO_MODIFICA, MAQUINA_MODIFICA
        FROM CTR_NOTICIAS
        ORDER BY FECHA_CREACION DESC;
        
EXCEPTION
    WHEN OTHERS THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'Error al consultar noticias: ' || SQLERRM;
END SP_CONSULTAR_NOTICIAS;
/

-- SP: Consultar noticia por ID
CREATE OR REPLACE PROCEDURE SP_CONSULTAR_NOTICIA_ID(
    P_ID_NOTICIA  IN CTR_NOTICIAS.ID_NOTICIA%TYPE,
    P_CURSOR      OUT SYS_REFCURSOR,
    P_RESULTADO   OUT NUMBER,
    P_MENSAJE     OUT VARCHAR2
) AS
BEGIN
    P_RESULTADO := 0;
    P_MENSAJE := 'OK';
    
    OPEN P_CURSOR FOR
        SELECT 
            ID_NOTICIA, UNIDAD, TITULO, SECCION, CIUDAD,
            IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE,
            FECHA_CREACION, USUARIO_CREACION, MAQUINA_CREACION,
            FECHA_MODIFICA, USUARIO_MODIFICA, MAQUINA_MODIFICA
        FROM CTR_NOTICIAS
        WHERE ID_NOTICIA = P_ID_NOTICIA;
        
EXCEPTION
    WHEN OTHERS THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'Error al consultar noticia: ' || SQLERRM;
END SP_CONSULTAR_NOTICIA_ID;
/

-- SP: Consultar noticias activas (para pública)
CREATE OR REPLACE PROCEDURE SP_CONSULTAR_NOTICIAS_ACTIVAS(
    P_CURSOR    OUT SYS_REFCURSOR,
    P_RESULTADO OUT NUMBER,
    P_MENSAJE   OUT VARCHAR2
) AS
BEGIN
    P_RESULTADO := 0;
    P_MENSAJE := 'OK';
    
    OPEN P_CURSOR FOR
        SELECT 
            ID_NOTICIA, UNIDAD, TITULO, SECCION, CIUDAD,
            IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE,
            FECHA_CREACION, USUARIO_CREACION
        FROM CTR_NOTICIAS
        WHERE VIGENTE = 1
        ORDER BY FECHA_CREACION DESC;
        
EXCEPTION
    WHEN OTHERS THEN
        P_RESULTADO := -1;
        P_MENSAJE := 'Error al consultar noticias: ' || SQLERRM;
END SP_CONSULTAR_NOTICIAS_ACTIVAS;
/

SHOW ERRORS;