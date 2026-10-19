# Happy Store Bolivia

Catálogo web con ofertas, inventario de stock exacto, gestión privada de pedidos, reportes PDF y sincronización con Supabase.

## Estructura

- `dist/`: sitio estático listo para Netlify.
- `supabase/schema.sql`: tablas de catálogo y pedidos, almacenamiento de fotografías, datos de contacto y políticas de seguridad.
- `supabase/orders-migration.sql`: actualización para instalaciones existentes que todavía no tienen la tabla de pedidos.
- `dist/config.js`: URL y clave pública `anon` de Supabase.

Los productos, sus descripciones, precios, stock, fotografías y pedidos se almacenan únicamente en Supabase. GitHub contiene solo el código de la página. Desde Administración se pueden registrar pedidos, actualizar sus estados y descargar reportes PDF por mes o por gestión completa.

El acceso a `#admin` usa correo y contraseña de Supabase. Cualquier usuario creado y confirmado en **Authentication > Users** puede ingresar y administrar el catálogo. Para una instalación que ya usaba permisos ligados a un único correo, ejecuta una vez `supabase/authenticated-users-migration.sql` en el SQL Editor.

La oferta principal de Inicio y los descuentos individuales se administran desde el panel. Antes de usar estas opciones en un proyecto existente, ejecuta una vez `supabase/offers-customization-migration.sql` en el SQL Editor. Las fotografías se guardan en el bucket `product-images` de Supabase.

La clave `service_role` nunca debe incluirse en el sitio ni en GitHub.
