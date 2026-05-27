-- =========================================
-- Procedimientos Almacenados - CTR_VIDEOS
-- Paquete: PK_ADMINISTRACION
-- =========================================

-- =========================================
-- CREATE VIDEO
-- =========================================
CREATE OR REPLACE PROCEDURE PK_ADMINISTRACION.P_CREATE_VIDEO(
    P_DESCRIPCION       IN VARCHAR2,
    P_OBSERVACIONES    IN VARCHAR2,
    P_RUTA_VIDEO       IN VARCHAR2,
    P_USUARIO_CREACION IN VARCHAR2,
    P_MAQUINA_CREACION IN VARCHAR2,
    P_SUCCESS          OUT NUMBER,
    P_MESSAGE          OUT VARCHAR2
)
IS
BEGIN
    INSERT INTO CTR_VIDEOS (
        DESCRIPCION,
        OBSERVACIONES,
        RUTA_VIDEO,
        FECHA_CREACION,
        USUARIO_CREACION,
        VIGENTE
    ) VALUES (
        P_DESCRIPCION,
        P_OBSERVACIONES,
        P_RUTA_VIDEO,
        SYSDATE,
        P_USUARIO_CREACION,
        1
    );
    
    P_SUCCESS := 1;
    P_MESSAGE := 'Video creado exitosamente';
    
EXCEPTION
    WHEN OTHERS THEN
        P_SUCCESS := 0;
        P_MESSAGE := 'Error al crear video: ' || SQLERRM;
END P_CREATE_VIDEO;
/

-- =========================================
-- UPDATE VIDEO
-- =========================================
CREATE OR REPLACE PROCEDURE PK_ADMINISTRACION.P_UPDATE_VIDEO(
    P_ID_VIDEO         IN NUMBER,
    P_DESCRIPCION      IN VARCHAR2,
    P_OBSERVACIONES    IN VARCHAR2,
    P_RUTA_VIDEO       IN VARCHAR2,
    P_VIGENTE          IN NUMBER,
    P_USUARIO_MODIFICA IN VARCHAR2,
    P_MAQUINA_MODIFICA IN VARCHAR2,
    P_SUCCESS          OUT NUMBER,
    P_MESSAGE          OUT VARCHAR2
)
IS
BEGIN
    UPDATE CTR_VIDEOS
       SET DESCRIPCION = P_DESCRIPCION,
           OBSERVACIONES = P_OBSERVACIONES,
           RUTA_VIDEO = P_RUTA_VIDEO,
           VIGENTE = P_VIGENTE,
           FECHA_MODIFICA = SYSDATE,
           USUARIO_MODIFICA = P_USUARIO_MODIFICA,
           MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
     WHERE ID_VIDEO = P_ID_VIDEO;
    
    IF SQL%ROWCOUNT > 0 THEN
        P_SUCCESS := 1;
        P_MESSAGE := 'Video actualizado exitosamente';
    ELSE
        P_SUCCESS := 0;
        P_MESSAGE := 'No se encontró el video';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        P_SUCCESS := 0;
        P_MESSAGE := 'Error al actualizar video: ' || SQLERRM;
END P_UPDATE_VIDEO;
/

-- =========================================
-- DELETE LOGICAL VIDEO (Inactivar)
-- =========================================
CREATE OR REPLACE PROCEDURE PK_ADMINISTRACION.P_DELETE_LOGICAL_VIDEO(
    P_ID_VIDEO         IN NUMBER,
    P_USUARIO_MODIFICA IN VARCHAR2,
    P_MAQUINA_MODIFICA IN VARCHAR2,
    P_SUCCESS          OUT NUMBER,
    P_MESSAGE          OUT VARCHAR2
)
IS
BEGIN
    UPDATE CTR_VIDEOS
       SET VIGENTE = 0,
           FECHA_MODIFICA = SYSDATE,
           USUARIO_MODIFICA = P_USUARIO_MODIFICA,
           MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
     WHERE ID_VIDEO = P_ID_VIDEO;
    
    IF SQL%ROWCOUNT > 0 THEN
        P_SUCCESS := 1;
        P_MESSAGE := 'Video inactivado exitosamente';
    ELSE
        P_SUCCESS := 0;
        P_MESSAGE := 'No se encontró el video';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        P_SUCCESS := 0;
        P_MESSAGE := 'Error al inactivar video: ' || SQLERRM;
END P_DELETE_LOGICAL_VIDEO;
/

-- =========================================
-- GET ALL VIDEOS (Activos y todos)
-- =========================================
CREATE OR REPLACE PROCEDURE PK_ADMINISTRACION.P_GET_ALL_VIDEO(
    P_CURSOR OUT SYS_REFCURSOR
)
IS
BEGIN
    OPEN P_CURSOR FOR
        SELECT ID_VIDEO,
               DESCRIPCION,
               OBSERVACIONES,
               RUTA_VIDEO,
               FECHA_CREACION,
               USUARIO_CREACION,
               VIGENTE,
               FECHA_MODIFICA,
               USUARIO_MODIFICA,
               MAQUINA_MODIFICA
          FROM CTR_VIDEOS
      ORDER BY FECHA_CREACION DESC;
END P_GET_ALL_VIDEO;
/

-- =========================================
-- GET VIDEO BY ID
-- =========================================
CREATE OR REPLACE PROCEDURE PK_ADMINISTRACION.P_GET_BY_ID_VIDEO(
    P_ID_VIDEO  IN NUMBER,
    P_CURSOR OUT SYS_REFCURSOR
)
IS
BEGIN
    OPEN P_CURSOR FOR
        SELECT ID_VIDEO,
               DESCRIPCION,
               OBSERVACIONES,
               RUTA_VIDEO,
               FECHA_CREACION,
               USUARIO_CREACION,
               VIGENTE,
               FECHA_MODIFICA,
               USUARIO_MODIFICA,
               MAQUINA_MODIFICA
          FROM CTR_VIDEOS
         WHERE ID_VIDEO = P_ID_VIDEO;
END P_GET_BY_ID_VIDEO;
/

-- =========================================
-- Grant de permisos
-- =========================================
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_CREATE_VIDEO TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_UPDATE_VIDEO TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_DELETE_LOGICAL_VIDEO TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_GET_ALL_VIDEO TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_GET_BY_ID_VIDEO TO USR_DEV_TEST;