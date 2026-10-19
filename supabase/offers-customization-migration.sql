-- Añade descuentos administrables y la imagen de oferta principal.
-- Ejecutar una vez en Supabase SQL Editor antes de usar estas opciones.

alter table public.products
  add column if not exists on_sale boolean not null default false;

alter table public.products
  add column if not exists discount_percent integer not null default 0
  check (discount_percent between 0 and 99);

-- Conserva como ofertas los productos que ya tenían precio actual y anterior.
update public.products
set
  on_sale = true,
  discount_percent = greatest(
    1,
    least(99, round((1 - price / compare_price) * 100)::integer)
  )
where price is not null
  and compare_price is not null
  and compare_price > price
  and discount_percent = 0;

alter table public.store_settings
  add column if not exists hero_discount_percent integer not null default 20
  check (hero_discount_percent between 1 and 99);

alter table public.store_settings
  add column if not exists hero_image_url text;
