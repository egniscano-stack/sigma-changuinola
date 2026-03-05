# 🔒 Guía de Seguridad — SIGMA Changuinola
## Sistema Integral de Gestión Municipal
### Gobierno de Panamá · Municipio de Changuinola · Bocas del Toro

---

## ⚠️ CLASIFICACIÓN: USO INTERNO EXCLUSIVO — DATOS FINANCIEROS GUBERNAMENTALES

---

## 📋 Resumen Ejecutivo de Seguridad

Este documento describe todas las medidas de seguridad implementadas en el sistema SIGMA Changuinola para proteger información financiera sensible de contribuyentes y transacciones del Municipio de Changuinola.

---

## 🛡️ Capas de Seguridad Implementadas

### CAPA 1: Seguridad del Código Fuente

| Medida | Estado | Descripción |
|--------|--------|-------------|
| Credenciales en variables de entorno | ✅ Implementado | Las keys de Supabase y Gemini están en `.env.local` (no en código) |
| `.gitignore` actualizado | ✅ Implementado | `.env` y `.env.local` excluidos del control de versiones |
| Sin passwords hardcodeados | ✅ Implementado | Eliminada la práctica de hardcodear credenciales |
| Auto-completado de formularios desactivado | ✅ Implementado | `autocomplete="off"` en formularios de login |

### CAPA 2: Autenticación y Control de Acceso

| Medida | Estado | Descripción |
|--------|--------|-------------|
| Protección Anti-Fuerza-Bruta | ✅ Implementado | Máximo 5 intentos fallidos → bloqueo de 15 minutos |
| Delay anti-timing-attack | ✅ Implementado | 300-500ms de delay aleatorio en cada intento de login |
| Sesiones seguras con SessionStorage | ✅ Implementado | Sesión se destruye al cerrar el tab/navegador |
| Session ID criptográfico | ✅ Implementado | IDs de 32 bytes generados con `crypto.getRandomValues()` |
| Auto-logout por inactividad | ✅ Implementado | 30 minutos de inactividad → cierre automático de sesión |
| Advertencia de sesión próxima a expirar | ✅ Implementado | Alerta visual 5 minutos antes del timeout |
| Mostrar/ocultar contraseña | ✅ Implementado | Botón toggle para verificar contraseña ingresada |
| Sin contraseñas en memoria tras login | ✅ Implementado | La propiedad `password` se elimina del objeto User en memoria |

### CAPA 3: Seguridad del Navegador (Client-Side Headers)

| Medida | Estado | Descripción |
|--------|--------|-------------|
| Content Security Policy (CSP) | ✅ Implementado | Lista blanca de dominios permitidos (scripts, estilos, imágenes) |
| X-Frame-Options: DENY | ✅ Implementado | Previene ataques de clickjacking |
| X-Content-Type-Options: nosniff | ✅ Implementado | Previene MIME type sniffing |
| Cache-Control: no-store | ✅ Implementado | Datos financieros no se guardan en caché del navegador |
| Referrer-Policy: no-referrer | ✅ Implementado | No se filtra la URL del sistema en encabezados de referencia |
| robots: noindex | ✅ Implementado | El sistema no aparece en resultados de búsqueda de Google |
| Reportador de violaciones CSP | ✅ Implementado | Intento de carga de scripts no autorizados se registra en auditoría |

### CAPA 4: Seguridad del Servidor Web (Apache .htaccess)

| Medida | Estado | Descripción |
|--------|--------|-------------|
| Security Headers via Apache | ✅ Implementado | HSTS, CSP, X-Frame-Options, etc. aplicados en servidor |
| Sin listado de directorios | ✅ Implementado | `Options -Indexes` activo |
| Archivos sensibles bloqueados | ✅ Implementado | `.env`, `package.json`, `.git` no accesibles vía HTTP |
| Bloqueo de SQL Injection en URL | ✅ Implementado | Patrones UNION/SELECT bloqueados en query strings |
| Bloqueo de XSS en URL | ✅ Implementado | `<script>` en query strings devuelve 403 |
| HSTS (HTTPS obligatorio) | ✅ Configurado | Activar descomentando la línea en `.htaccess` al usar HTTPS |

### CAPA 5: Seguridad de Base de Datos (Supabase/PostgreSQL)

| Medida | Estado | Descripción |
|--------|--------|-------------|
| Row Level Security (RLS) | ✅ Implementado | Habilitado en todas las tablas |
| Políticas RLS granulares | ✅ Implementado | Reemplaza la política `USING (true)` por roles específicos |
| Tabla de Auditoría Inmutable | ✅ Implementado | `audit_log` - sin políticas UPDATE/DELETE (registro permanente) |
| Triggers de Auditoría DB | ✅ Implementado | Cada INSERT/UPDATE/DELETE en tablas críticas se registra |
| Índices de seguridad | ✅ Implementado | Índices en `doc_id`, `taxpayer_number`, fechas |
| Columnas de auditoría | ✅ Implementado | `updated_at`, `created_by`, `updated_by`, `force_password_change` |
| Contraseñas débiles marcadas | ✅ Implementado | Sistema identifica y fuerza cambio de contraseñas débiles |

### CAPA 6: Registro de Auditoría (Audit Trail)

| Medida | Estado | Descripción |
|--------|--------|-------------|
| Log de accesos exitosos | ✅ Implementado | `LOGIN_SUCCESS` con timestamp, usuario, rol |
| Log de intentos fallidos | ✅ Implementado | `LOGIN_FAILED` con contador de intentos |
| Log de bloqueos de cuenta | ✅ Implementado | `ACCOUNT_LOCKED` - nivel CRÍTICO |
| Log de cierres de sesión | ✅ Implementado | `LOGOUT` y `AUTO_LOGOUT` por inactividad |
| Log de violaciones CSP | ✅ Implementado | `CSP_VIOLATION` - nivel CRÍTICO |
| Log de operaciones financieras | ✅ Implementado | `FINANCIAL_OP` con monto y contribuyente |
| Log de expiraciones de sesión | ✅ Implementado | `SESSION_EXPIRED` con motivo |
| Rotación de logs (500 entradas) | ✅ Implementado | Evita consumo excesivo de almacenamiento |

---

## 🔑 Política de Contraseñas

### Requisitos Mínimos (para sistema gubernamental):
- **Longitud mínima**: 8 caracteres (recomendado: 12+)
- **Debe contener**: Letras mayúsculas + números + caracteres especiales
- **No permitidas**: Contraseñas conocidas como `admin123`, `123456`, `password`, `mnc`, etc.
- **Caducidad**: Cambiar contraseña cada 90 días (implementar a futuro)

### Contraseñas por Defecto (**CAMBIAR INMEDIATAMENTE**):
> ⚠️ Las siguientes contraseñas predeterminadas deben cambiarse antes del despliegue en producción:

| Usuario | Contraseña Default | Acción Requerida |
|---------|-------------------|-----------------|
| admin | admin123 | 🚨 CAMBIAR AHORA |
| registro | 123 | 🚨 CAMBIAR AHORA |
| alcalde | mnc | 🚨 CAMBIAR AHORA |

---

## 🚨 Respuesta a Incidentes

### Si sospecha de acceso no autorizado:
1. **Acceder** al Editor SQL de Supabase
2. **Ejecutar**: `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;`
3. **Revisar** los intentos de login (`action = 'LOGIN_FAILED'` o `'ACCOUNT_LOCKED'`)
4. **Bloquear** el usuario sospechoso: `UPDATE app_users SET locked_until = NOW() + INTERVAL '24 hours' WHERE username = 'usuario_sospechoso';`
5. **Reportar** al responsable de TI del Municipio

### Para revisar el log de auditoría:
```sql
-- Ver últimos 50 eventos de seguridad críticos
SELECT timestamp, username, role, action, details 
FROM audit_log 
WHERE severity = 'CRITICAL' 
ORDER BY timestamp DESC 
LIMIT 50;

-- Ver todas las operaciones financieras del día de hoy
SELECT timestamp, username, action, details
FROM audit_log
WHERE action = 'FINANCIAL_OP'
AND DATE(timestamp) = CURRENT_DATE
ORDER BY timestamp DESC;
```

---

## 🔧 Configuración de Producción (Checklist)

### ANTES de deployment en servidores gubernamentales:

- [ ] **Activar HTTPS**: Obtener certificado SSL/TLS (Let's Encrypt o CA gubernamental)
- [ ] **Descomentar HSTS** en `.htaccess`: Líneas de fuerza a HTTPS
- [ ] **Cambiar TODAS las contraseñas** predeterminadas
- [ ] **Ejecutar** `supabase_security_hardening.sql` en la base de datos de producción
- [ ] **Verificar** que `.env.local` NO esté en repositorios de código
- [ ] **Configurar** backups automáticos de Supabase (diario/semanal)
- [ ] **Habilitar** 2FA en la cuenta de Supabase del administrador
- [ ] **Restringir acceso** al Panel de Supabase solo a IPs del Municipio
- [ ] **Revisar** los logs de auditoría semanalmente
- [ ] **Capacitar** al personal sobre no compartir credenciales

### Variables de Entorno Requeridas (.env.local):
```env
VITE_SUPABASE_URL=https://[tu-proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=[tu-clave-anonima]
VITE_GEMINI_API_KEY=[tu-clave-gemini]
```

---

## 📊 Roles y Permisos

| Rol | Dashboard | Contribuyentes | Caja | Cobros | Reportes | Configuración | Alcaldía |
|-----|-----------|---------------|------|--------|----------|---------------|---------|
| ADMIN | ✅ | ✅(CRUD) | ✅ | ✅ | ✅ | ✅ | ❌ |
| CAJERO | ❌ | 📖(Solo lectura) | ✅ | ❌ | ❌ | ❌ | ❌ |
| REGISTRO | ❌ | ✅(añadir) | ❌ | ✅ | ❌ | ❌ | ❌ |
| AUDITOR | ✅(solo ver) | 📖 | ❌ | 📖 | ✅ | ❌ | ❌ |
| ALCALDE | ❌ | ❌ | ❌ | ❌ | ✅(resumen) | ❌ | ✅ |
| SECRETARIA | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(agenda) |
| CONTRIBUYENTE | ❌ | ❌ | 🔱(propio) | ❌ | ❌ | ❌ | ❌ |

---

## 📱 Recomendaciones Adicionales

1. **Usar red privada (VPN)** para acceder al sistema desde fuera de las oficinas municipales
2. **No acceder** desde computadoras públicas o redes WiFi abiertas
3. **Cerrar sesión** siempre al terminar (o dejar que el sistema lo haga automáticamente a los 30 min)
4. **No compartir** credenciales entre empleados — cada funcionario debe tener su propio usuario
5. **Reportar** cualquier comportamiento sospechoso al administrador del sistema

---

*Documento preparado para el Gobierno de Panamá · Municipio de Changuinola*  
*Sistema SIGMA v2.0 — Implementado con estándares de seguridad gubernamental*  
*Fecha: Marzo 2026*
