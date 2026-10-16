# Happy Store Bolivia

Catálogo web con ofertas, inventario de stock exacto, administración protegida y sincronización con Supabase.

## Estructura

- `dist/`: sitio estático listo para Netlify.
- `supabase/schema.sql`: tablas, almacenamiento de fotografías, datos de contacto y políticas de seguridad.
- `dist/config.js`: URL y clave pública `anon` de Supabase.

Los productos, sus descripciones, precios, stock y fotografías se almacenan únicamente en Supabase. GitHub contiene solo el código de la página. Los productos se administran desde la página de Administración y, al eliminarlos, también se retira su fotografía de Supabase Storage.

La clave `service_role` nunca debe incluirse en el sitio ni en GitHub.
