# Política de Seguridad y Control de Accesos — CV-3D

## 1. Autenticación y Autorización
- **Panel Administrativo (`/admin.html`)**: Requiere un token de administración (`ADMIN_SECRET_TOKEN`) transmitido en la cabecera `Authorization: Bearer <token>`.
- Las acciones de mutación sobre la base de datos KV (`PUT /api/stickers/:id/approve` y `DELETE /api/stickers/:id`) están estrictamente bloqueadas a nivel de servidor Worker para peticiones no autenticadas.

## 2. Validación de Entrada
- Todas las peticiones `POST` a `/api/stickers` se someten a detección proactiva de inyecciones (XSS, SQLi) y sanitización estricta de cadenas HTML (`&lt;`, `&gt;`).

## 3. Cabeceras HTTP de Seguridad
- Respuestas configuradas con: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
