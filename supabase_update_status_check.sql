ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS taxpayers_status_check;
ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_status_check CHECK (status IN ('ACTIVO', 'SUSPENDIDO', 'BLOQUEADO', 'MOROSO', 'PAZ_Y_SALVO'));
