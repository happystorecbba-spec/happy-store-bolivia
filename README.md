# Happy Store Bolivia

Catálogo web con ofertas, inventario de stock exacto, administración protegida y sincronización con Supabase.

## Estructura

- `dist/`: sitio estático listo para Netlify.
- `supabase/schema.sql`: tablas, datos de contacto y políticas de seguridad.
- `dist/config.js`: URL y clave pública `anon` de Supabase.

La clave `service_role` nunca debe incluirse en el sitio ni en GitHub.
