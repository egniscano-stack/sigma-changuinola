-- COPIA Y PEGA ESTO EN EL EDITOR SQL DE SUPABASE Y DALE A "RUN"

-- 1. Crear la tabla de mensajes si no existe
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_username TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    recipient_username TEXT, -- NULL para mensajes públicos
    content TEXT,
    attachment_url TEXT,
    attachment_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Crear una política permisiva (para que todos puedan leer/escribir)
-- Usamos un bloque DO para evitar errores si la política ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'chat_messages'
        AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON chat_messages
        FOR ALL
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;

-- 4. Habilitar Realtime para que los mensajes lleguen al instante
-- Esto es CRÍTICO para el chat
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;
END
$$;
