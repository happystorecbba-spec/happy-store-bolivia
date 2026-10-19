-- Permite administrar Happy Store a cualquier usuario autenticado de Supabase.
-- Ejecutar una vez en Supabase SQL Editor para proyectos ya existentes.

drop policy if exists "Happy Store admin can insert products" on public.products;
create policy "Happy Store admin can insert products" on public.products
for insert to authenticated with check ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can update products" on public.products;
create policy "Happy Store admin can update products" on public.products
for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can delete products" on public.products;
create policy "Happy Store admin can delete products" on public.products
for delete to authenticated using ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can update settings" on public.store_settings;
create policy "Happy Store admin can update settings" on public.store_settings
for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can insert settings" on public.store_settings;
create policy "Happy Store admin can insert settings" on public.store_settings
for insert to authenticated with check ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can read orders" on public.orders;
create policy "Happy Store admin can read orders" on public.orders
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can insert orders" on public.orders;
create policy "Happy Store admin can insert orders" on public.orders
for insert to authenticated with check ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can update orders" on public.orders;
create policy "Happy Store admin can update orders" on public.orders
for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can delete orders" on public.orders;
create policy "Happy Store admin can delete orders" on public.orders
for delete to authenticated using ((select auth.uid()) is not null);

drop policy if exists "Happy Store admin can upload product images" on storage.objects;
create policy "Happy Store admin can upload product images" on storage.objects
for insert to authenticated
with check (bucket_id = 'product-images' and (select auth.uid()) is not null);

drop policy if exists "Happy Store admin can update product images" on storage.objects;
create policy "Happy Store admin can update product images" on storage.objects
for update to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) is not null)
with check (bucket_id = 'product-images' and (select auth.uid()) is not null);

drop policy if exists "Happy Store admin can delete product images" on storage.objects;
create policy "Happy Store admin can delete product images" on storage.objects
for delete to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) is not null);
