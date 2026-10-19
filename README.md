# Happy Store Bolivia

Catálogo web con ofertas, inventario de stock exacto, gestión privada de pedidos, reportes PDF y sincronización con Supabase.

## Estructura

- `dist/`: sitio estático listo para Netlify.
- `supabase/schema.sql`: tablas de catálogo y pedidos, almacenamiento de fotografías, datos de contacto y políticas de seguridad.
- `supabase/orders-migration.sql`: actualización para instalaciones existentes que todavía no tienen la tabla de pedidos.
- `dist/config.js`: URL y clave pública `anon` de Supabase.

Los productos, sus descripciones, precios, stock, fotografías y pedidos se almacenan únicamente en Supabase. GitHub contiene solo el código de la página. Desde Administración se pueden registrar pedidos, actualizar sus estados y descargar reportes PDF por mes o por gestión completa.

La clave `service_role` nunca debe incluirse en el sitio ni en GitHub.
