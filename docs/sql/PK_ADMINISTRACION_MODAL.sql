-- =====================================================
-- Tablas: CTR_MODAL, CTR_MODAL_INTERACCION
-- Paquete: PK_ADMINISTRACION
-- Módulo: Administración de Modales / Popups
-- =====================================================

-- =====================================================
-- TABLAS
-- =====================================================

CREATE TABLE CTR_MODAL (
    ID_MODAL            NUMBER          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    TITULO              VARCHAR2(300)   NOT NULL,
    DESCRIPCION         VARCHAR2(1000),
    TIPO_RECURSO        VARCHAR2(10),                       -- 'IMAGEN' | 'VIDEO' | 'TEXTO'
    RUTA_RECURSO        VARCHAR2(500),
    TIPO_ACCION         VARCHAR2(20)    DEFAULT 'INFO',     -- 'INFO' | 'ACEPTAR' | 'CONFIRMAR'
    FECHA_INICIO        DATE            NOT NULL,
    FECHA_FIN           DATE            NOT NULL,
    UNIDAD              VARCHAR2(100),
    ORDEN               NUMBER(3)       DEFAULT 1,
    CONTEO_VISTAS       NUMBER          DEFAULT 0,
    CONTEO_ACEPTADOS    NUMBER          DEFAULT 0,
    CONTEO_CERRADOS     NUMBER          DEFAULT 0,
    VIGENTE             NUMBER(1)       DEFAULT 1,
    FECHA_CREACION      DATE            DEFAULT SYSDATE,
    USUARIO_CREACION    VARCHAR2(100)   NOT NULL,
    MAQUINA_CREACION    VARCHAR2(100),
    FECHA_MODIFICA      DATE,
    USUARIO_MODIFICA    VARCHAR2(100),
    MAQUINA_MODIFICA    VARCHAR2(100)
);

COMMENT ON TABLE  CTR_MODAL                       IS 'Tabla de configuración de modales/popups institucionales';
COMMENT ON COLUMN CTR_MODAL.ID_MODAL              IS 'Identificador único del modal';
COMMENT ON COLUMN CTR_MODAL.TITULO                IS 'Título principal del modal';
COMMENT ON COLUMN CTR_MODAL.DESCRIPCION           IS 'Texto o mensaje del modal';
COMMENT ON COLUMN CTR_MODAL.TIPO_RECURSO          IS 'Tipo de recurso adjunto: IMAGEN, VIDEO, TEXTO';
COMMENT ON COLUMN CTR_MODAL.RUTA_RECURSO          IS 'Ruta del archivo imagen o video adjunto';
COMMENT ON COLUMN CTR_MODAL.TIPO_ACCION           IS 'INFO=solo cerrar, ACEPTAR=botón aceptar, CONFIRMAR=aceptar y cancelar';
COMMENT ON COLUMN CTR_MODAL.FECHA_INICIO          IS 'Fecha desde la cual el modal es visible';
COMMENT ON COLUMN CTR_MODAL.FECHA_FIN             IS 'Fecha hasta la cual el modal es visible';
COMMENT ON COLUMN CTR_MODAL.UNIDAD                IS 'Unidad a la que aplica; NULL indica que aplica a todos';
COMMENT ON COLUMN CTR_MODAL.ORDEN                 IS 'Orden de aparición cuando hay varios modales activos';
COMMENT ON COLUMN CTR_MODAL.CONTEO_VISTAS         IS 'Total acumulado de veces que el modal fue mostrado';
COMMENT ON COLUMN CTR_MODAL.CONTEO_ACEPTADOS      IS 'Total acumulado de clicks en Aceptar';
COMMENT ON COLUMN CTR_MODAL.CONTEO_CERRADOS       IS 'Total acumulado de clicks en Cerrar o X';
COMMENT ON COLUMN CTR_MODAL.VIGENTE               IS '1=Activo, 0=Inactivo';
COMMENT ON COLUMN CTR_MODAL.FECHA_CREACION        IS 'Fecha de creación del registro';
COMMENT ON COLUMN CTR_MODAL.USUARIO_CREACION      IS 'Usuario que creó el registro';
COMMENT ON COLUMN CTR_MODAL.MAQUINA_CREACION      IS 'Máquina desde donde se creó el registro';
COMMENT ON COLUMN CTR_MODAL.FECHA_MODIFICA        IS 'Fecha de la última modificación';
COMMENT ON COLUMN CTR_MODAL.USUARIO_MODIFICA      IS 'Usuario que realizó la última modificación';
COMMENT ON COLUMN CTR_MODAL.MAQUINA_MODIFICA      IS 'Máquina desde donde se realizó la última modificación';

CREATE INDEX IDX_MODAL_VIGENTE      ON CTR_MODAL(VIGENTE);
CREATE INDEX IDX_MODAL_FECHAS       ON CTR_MODAL(FECHA_INICIO, FECHA_FIN);
CREATE INDEX IDX_MODAL_UNIDAD       ON CTR_MODAL(UNIDAD);
CREATE INDEX IDX_MODAL_ORDEN        ON CTR_MODAL(ORDEN);

-- -------------------------------------------------------

CREATE TABLE CTR_MODAL_INTERACCION (
    ID_INTERACCION      NUMBER          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ID_MODAL            NUMBER          NOT NULL,
    TIPO_ACCION         VARCHAR2(20)    NOT NULL,           -- 'VISTA' | 'ACEPTAR' | 'CERRAR'
    USUARIO             VARCHAR2(100),
    MAQUINA             VARCHAR2(100),
    FECHA_INTERACCION   DATE            DEFAULT SYSDATE,
    CONSTRAINT FK_MODAL_INTERACCION FOREIGN KEY (ID_MODAL) REFERENCES CTR_MODAL(ID_MODAL)
);

COMMENT ON TABLE  CTR_MODAL_INTERACCION                    IS 'Log detallado de interacciones de usuarios con cada modal';
COMMENT ON COLUMN CTR_MODAL_INTERACCION.ID_INTERACCION     IS 'Identificador único de la interacción';
COMMENT ON COLUMN CTR_MODAL_INTERACCION.ID_MODAL           IS 'Referencia al modal que generó la interacción';
COMMENT ON COLUMN CTR_MODAL_INTERACCION.TIPO_ACCION        IS 'VISTA=modal mostrado, ACEPTAR=clic en aceptar, CERRAR=clic en cerrar/X';
COMMENT ON COLUMN CTR_MODAL_INTERACCION.USUARIO            IS 'Usuario autenticado que interactuó; NULL si es acceso público';
COMMENT ON COLUMN CTR_MODAL_INTERACCION.MAQUINA            IS 'IP o nombre de máquina del cliente';
COMMENT ON COLUMN CTR_MODAL_INTERACCION.FECHA_INTERACCION  IS 'Fecha y hora exacta de la interacción';

CREATE INDEX IDX_MODAL_INT_ID_MODAL ON CTR_MODAL_INTERACCION(ID_MODAL);
CREATE INDEX IDX_MODAL_INT_USUARIO  ON CTR_MODAL_INTERACCION(USUARIO);
CREATE INDEX IDX_MODAL_INT_FECHA    ON CTR_MODAL_INTERACCION(FECHA_INTERACCION DESC);
CREATE INDEX IDX_MODAL_INT_ACCION   ON CTR_MODAL_INTERACCION(TIPO_ACCION);


-- =====================================================
-- PACKAGE SPEC
-- =====================================================

CREATE OR REPLACE PACKAGE PK_ADMINISTRACION AS

    -- CTR_MODAL -------------------------------------
    PROCEDURE P_CREATE_MODAL(
        P_TITULO             IN VARCHAR2,
        P_DESCRIPCION        IN VARCHAR2,
        P_TIPO_RECURSO       IN VARCHAR2,
        P_RUTA_RECURSO       IN VARCHAR2,
        P_TIPO_ACCION        IN VARCHAR2,
        P_FECHA_INICIO       IN DATE,
        P_FECHA_FIN          IN DATE,
        P_UNIDAD             IN VARCHAR2,
        P_ORDEN              IN NUMBER,
        P_USUARIO_CREACION   IN VARCHAR2,
        P_MAQUINA_CREACION   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    );

    PROCEDURE P_UPDATE_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_TITULO             IN VARCHAR2,
        P_DESCRIPCION        IN VARCHAR2,
        P_TIPO_RECURSO       IN VARCHAR2,
        P_RUTA_RECURSO       IN VARCHAR2,
        P_TIPO_ACCION        IN VARCHAR2,
        P_FECHA_INICIO       IN DATE,
        P_FECHA_FIN          IN DATE,
        P_UNIDAD             IN VARCHAR2,
        P_ORDEN              IN NUMBER,
        P_VIGENTE            IN NUMBER,
        P_USUARIO_MODIFICA   IN VARCHAR2,
        P_MAQUINA_MODIFICA   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    );

    PROCEDURE P_DELETE_LOGICAL_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_USUARIO_MODIFICA   IN VARCHAR2,
        P_MAQUINA_MODIFICA   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    );

    PROCEDURE P_TOGGLE_VIGENTE_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_VIGENTE            IN NUMBER,
        P_USUARIO_MODIFICA   IN VARCHAR2,
        P_MAQUINA_MODIFICA   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    );

    PROCEDURE P_GET_ALL_MODAL(
        P_CURSOR             OUT SYS_REFCURSOR
    );

    PROCEDURE P_GET_BY_ID_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_CURSOR             OUT SYS_REFCURSOR
    );

    PROCEDURE P_GET_MODALES_ACTIVOS(
        P_CURSOR             OUT SYS_REFCURSOR
    );

    -- CTR_MODAL_INTERACCION -------------------------
    PROCEDURE P_REGISTRAR_INTERACCION(
        P_ID_MODAL           IN NUMBER,
        P_TIPO_ACCION        IN VARCHAR2,
        P_USUARIO            IN VARCHAR2,
        P_MAQUINA            IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    );

    PROCEDURE P_GET_INTERACCIONES_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_CURSOR             OUT SYS_REFCURSOR
    );

END PK_ADMINISTRACION;
/


-- =====================================================
-- PACKAGE BODY
-- =====================================================

CREATE OR REPLACE PACKAGE BODY PK_ADMINISTRACION AS

    -- =========================================
    -- CREATE MODAL
    -- =========================================
    PROCEDURE P_CREATE_MODAL(
        P_TITULO             IN VARCHAR2,
        P_DESCRIPCION        IN VARCHAR2,
        P_TIPO_RECURSO       IN VARCHAR2,
        P_RUTA_RECURSO       IN VARCHAR2,
        P_TIPO_ACCION        IN VARCHAR2,
        P_FECHA_INICIO       IN DATE,
        P_FECHA_FIN          IN DATE,
        P_UNIDAD             IN VARCHAR2,
        P_ORDEN              IN NUMBER,
        P_USUARIO_CREACION   IN VARCHAR2,
        P_MAQUINA_CREACION   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    ) IS
    BEGIN
        IF P_FECHA_FIN < P_FECHA_INICIO THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'La fecha fin no puede ser menor a la fecha inicio';
            RETURN;
        END IF;

        -- Solo puede existir una modal activa a la vez
        UPDATE CTR_MODAL SET VIGENTE = 0 WHERE VIGENTE = 1;

        INSERT INTO CTR_MODAL (
            TITULO, DESCRIPCION, TIPO_RECURSO, RUTA_RECURSO,
            TIPO_ACCION, FECHA_INICIO, FECHA_FIN,
            UNIDAD, ORDEN,
            CONTEO_VISTAS, CONTEO_ACEPTADOS, CONTEO_CERRADOS,
            VIGENTE, FECHA_CREACION, USUARIO_CREACION, MAQUINA_CREACION
        ) VALUES (
            P_TITULO, P_DESCRIPCION, P_TIPO_RECURSO, P_RUTA_RECURSO,
            P_TIPO_ACCION, P_FECHA_INICIO, P_FECHA_FIN,
            P_UNIDAD, NVL(P_ORDEN, 1),
            0, 0, 0,
            1, SYSDATE, P_USUARIO_CREACION, P_MAQUINA_CREACION
        );

        P_SUCCESS := 1;
        P_MESSAGE := 'Modal creado exitosamente';

    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'Error al crear modal: ' || SQLERRM;
            ROLLBACK;
    END P_CREATE_MODAL;


    -- =========================================
    -- UPDATE MODAL
    -- =========================================
    PROCEDURE P_UPDATE_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_TITULO             IN VARCHAR2,
        P_DESCRIPCION        IN VARCHAR2,
        P_TIPO_RECURSO       IN VARCHAR2,
        P_RUTA_RECURSO       IN VARCHAR2,
        P_TIPO_ACCION        IN VARCHAR2,
        P_FECHA_INICIO       IN DATE,
        P_FECHA_FIN          IN DATE,
        P_UNIDAD             IN VARCHAR2,
        P_ORDEN              IN NUMBER,
        P_VIGENTE            IN NUMBER,
        P_USUARIO_MODIFICA   IN VARCHAR2,
        P_MAQUINA_MODIFICA   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    ) IS
    BEGIN
        IF P_FECHA_FIN < P_FECHA_INICIO THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'La fecha fin no puede ser menor a la fecha inicio';
            RETURN;
        END IF;

        UPDATE CTR_MODAL SET
            TITULO           = P_TITULO,
            DESCRIPCION      = P_DESCRIPCION,
            TIPO_RECURSO     = P_TIPO_RECURSO,
            RUTA_RECURSO     = P_RUTA_RECURSO,
            TIPO_ACCION      = P_TIPO_ACCION,
            FECHA_INICIO     = P_FECHA_INICIO,
            FECHA_FIN        = P_FECHA_FIN,
            UNIDAD           = P_UNIDAD,
            ORDEN            = NVL(P_ORDEN, 1),
            VIGENTE          = P_VIGENTE,
            FECHA_MODIFICA   = SYSDATE,
            USUARIO_MODIFICA = P_USUARIO_MODIFICA,
            MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
        WHERE ID_MODAL = P_ID_MODAL;

        IF SQL%ROWCOUNT > 0 THEN
            P_SUCCESS := 1;
            P_MESSAGE := 'Modal actualizado exitosamente';
        ELSE
            P_SUCCESS := 0;
            P_MESSAGE := 'No se encontró el modal';
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'Error al actualizar modal: ' || SQLERRM;
            ROLLBACK;
    END P_UPDATE_MODAL;


    -- =========================================
    -- DELETE LOGICAL MODAL (Inactivar)
    -- =========================================
    PROCEDURE P_DELETE_LOGICAL_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_USUARIO_MODIFICA   IN VARCHAR2,
        P_MAQUINA_MODIFICA   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    ) IS
    BEGIN
        UPDATE CTR_MODAL SET
            VIGENTE          = 0,
            FECHA_MODIFICA   = SYSDATE,
            USUARIO_MODIFICA = P_USUARIO_MODIFICA,
            MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
        WHERE ID_MODAL = P_ID_MODAL;

        IF SQL%ROWCOUNT > 0 THEN
            P_SUCCESS := 1;
            P_MESSAGE := 'Modal inactivado exitosamente';
        ELSE
            P_SUCCESS := 0;
            P_MESSAGE := 'No se encontró el modal';
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'Error al inactivar modal: ' || SQLERRM;
            ROLLBACK;
    END P_DELETE_LOGICAL_MODAL;


    -- =========================================
    -- TOGGLE VIGENTE MODAL
    -- =========================================
    PROCEDURE P_TOGGLE_VIGENTE_MODAL(
        P_ID_MODAL           IN NUMBER,
        P_VIGENTE            IN NUMBER,
        P_USUARIO_MODIFICA   IN VARCHAR2,
        P_MAQUINA_MODIFICA   IN VARCHAR2,
        P_SUCCESS            OUT NUMBER,
        P_MESSAGE            OUT VARCHAR2
    ) IS
        V_ESTADO_LABEL VARCHAR2(10);
    BEGIN
        V_ESTADO_LABEL := CASE P_VIGENTE WHEN 1 THEN 'activado' ELSE 'inactivado' END;

        -- Solo puede haber un modal activo; inactivar los demás al activar uno
        IF P_VIGENTE = 1 THEN
            UPDATE CTR_MODAL SET VIGENTE = 0 WHERE VIGENTE = 1 AND ID_MODAL != P_ID_MODAL;
        END IF;

        UPDATE CTR_MODAL SET
            VIGENTE          = P_VIGENTE,
            FECHA_MODIFICA   = SYSDATE,
            USUARIO_MODIFICA = P_USUARIO_MODIFICA,
            MAQUINA_MODIFICA = P_MAQUINA_MODIFICA
        WHERE ID_MODAL = P_ID_MODAL;

        IF SQL%ROWCOUNT > 0 THEN
            P_SUCCESS := 1;
            P_MESSAGE := 'Modal ' || V_ESTADO_LABEL || ' exitosamente';
        ELSE
            P_SUCCESS := 0;
            P_MESSAGE := 'No se encontró el modal';
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'Error al cambiar estado del modal: ' || SQLERRM;
            ROLLBACK;
    END P_TOGGLE_VIGENTE_MODAL;


    -- =========================================
    -- GET ALL MODALES (admin)
    -- =========================================
    PROCEDURE P_GET_ALL_MODAL(
        P_CURSOR OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT
                ID_MODAL,
                TITULO,
                DESCRIPCION,
                TIPO_RECURSO,
                RUTA_RECURSO,
                TIPO_ACCION,
                FECHA_INICIO,
                FECHA_FIN,
                UNIDAD,
                ORDEN,
                CONTEO_VISTAS,
                CONTEO_ACEPTADOS,
                CONTEO_CERRADOS,
                VIGENTE,
                FECHA_CREACION,
                USUARIO_CREACION,
                MAQUINA_CREACION,
                FECHA_MODIFICA,
                USUARIO_MODIFICA,
                MAQUINA_MODIFICA
            FROM CTR_MODAL
            ORDER BY ORDEN ASC, FECHA_CREACION DESC;
    END P_GET_ALL_MODAL;


    -- =========================================
    -- GET MODAL BY ID
    -- =========================================
    PROCEDURE P_GET_BY_ID_MODAL(
        P_ID_MODAL IN NUMBER,
        P_CURSOR   OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT
                ID_MODAL,
                TITULO,
                DESCRIPCION,
                TIPO_RECURSO,
                RUTA_RECURSO,
                TIPO_ACCION,
                FECHA_INICIO,
                FECHA_FIN,
                UNIDAD,
                ORDEN,
                CONTEO_VISTAS,
                CONTEO_ACEPTADOS,
                CONTEO_CERRADOS,
                VIGENTE,
                FECHA_CREACION,
                USUARIO_CREACION,
                MAQUINA_CREACION,
                FECHA_MODIFICA,
                USUARIO_MODIFICA,
                MAQUINA_MODIFICA
            FROM CTR_MODAL
            WHERE ID_MODAL = P_ID_MODAL;
    END P_GET_BY_ID_MODAL;


    -- =========================================
    -- GET MODALES ACTIVOS (para mostrar al usuario)
    -- Filtra por: vigente=1, fechas vigentes
    -- =========================================
    PROCEDURE P_GET_MODALES_ACTIVOS(
        P_CURSOR OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT
                ID_MODAL,
                TITULO,
                DESCRIPCION,
                TIPO_RECURSO,
                RUTA_RECURSO,
                TIPO_ACCION,
                FECHA_INICIO,
                FECHA_FIN,
                UNIDAD,
                ORDEN
            FROM CTR_MODAL
            WHERE VIGENTE = 1
              AND SYSDATE BETWEEN FECHA_INICIO AND FECHA_FIN
            ORDER BY ORDEN ASC;
    END P_GET_MODALES_ACTIVOS;


    -- =========================================
    -- REGISTRAR INTERACCION
    -- Inserta en el log y actualiza contadores
    -- =========================================
    PROCEDURE P_REGISTRAR_INTERACCION(
        P_ID_MODAL    IN NUMBER,
        P_TIPO_ACCION IN VARCHAR2,
        P_USUARIO     IN VARCHAR2,
        P_MAQUINA     IN VARCHAR2,
        P_SUCCESS     OUT NUMBER,
        P_MESSAGE     OUT VARCHAR2
    ) IS
        V_EXISTS NUMBER;
    BEGIN
        SELECT COUNT(1) INTO V_EXISTS FROM CTR_MODAL WHERE ID_MODAL = P_ID_MODAL;
        IF V_EXISTS = 0 THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'El modal no existe';
            RETURN;
        END IF;

        INSERT INTO CTR_MODAL_INTERACCION (
            ID_MODAL, TIPO_ACCION, USUARIO, MAQUINA, FECHA_INTERACCION
        ) VALUES (
            P_ID_MODAL, P_TIPO_ACCION, P_USUARIO, P_MAQUINA, SYSDATE
        );

        -- Actualizar contador correspondiente en CTR_MODAL
        UPDATE CTR_MODAL SET
            CONTEO_VISTAS    = CASE P_TIPO_ACCION WHEN 'VISTA'   THEN NVL(CONTEO_VISTAS,    0) + 1 ELSE CONTEO_VISTAS    END,
            CONTEO_ACEPTADOS = CASE P_TIPO_ACCION WHEN 'ACEPTAR' THEN NVL(CONTEO_ACEPTADOS, 0) + 1 ELSE CONTEO_ACEPTADOS END,
            CONTEO_CERRADOS  = CASE P_TIPO_ACCION WHEN 'CERRAR'  THEN NVL(CONTEO_CERRADOS,  0) + 1 ELSE CONTEO_CERRADOS  END
        WHERE ID_MODAL = P_ID_MODAL;

        COMMIT;

        P_SUCCESS := 1;
        P_MESSAGE := 'Interacción registrada exitosamente';

    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 0;
            P_MESSAGE := 'Error al registrar interacción: ' || SQLERRM;
            ROLLBACK;
    END P_REGISTRAR_INTERACCION;


    -- =========================================
    -- GET INTERACCIONES POR MODAL (auditoría)
    -- =========================================
    PROCEDURE P_GET_INTERACCIONES_MODAL(
        P_ID_MODAL IN NUMBER,
        P_CURSOR   OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT
                I.ID_INTERACCION,
                I.ID_MODAL,
                I.TIPO_ACCION,
                I.USUARIO,
                I.MAQUINA,
                I.FECHA_INTERACCION
            FROM CTR_MODAL_INTERACCION I
            WHERE I.ID_MODAL = P_ID_MODAL
            ORDER BY I.FECHA_INTERACCION DESC;
    END P_GET_INTERACCIONES_MODAL;

END PK_ADMINISTRACION;
/


-- =====================================================
-- GRANTS
-- =====================================================
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_CREATE_MODAL              TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_UPDATE_MODAL              TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_DELETE_LOGICAL_MODAL      TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_TOGGLE_VIGENTE_MODAL      TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_GET_ALL_MODAL             TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_GET_BY_ID_MODAL           TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_GET_MODALES_ACTIVOS       TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_REGISTRAR_INTERACCION     TO USR_DEV_TEST;
-- GRANT EXECUTE ON PK_ADMINISTRACION.P_GET_INTERACCIONES_MODAL   TO USR_DEV_TEST;

SHOW ERRORS;
