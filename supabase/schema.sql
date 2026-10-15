-- Happy Store: catálogo, inventario y configuración pública.
-- Ejecutar una vez en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  compare_price numeric(12,2) check (compare_price is null or compare_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  description text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  whatsapp text not null,
  instagram text,
  tiktok text,
  email text not null,
  owner_email text not null,
  store_phone text not null,
  owner_name text not null,
  address text not null,
  catalog_note text not null,
  updated_at timestamptz not null default now()
);

insert into public.store_settings (
  id, whatsapp, instagram, tiktok, email, owner_email, store_phone, owner_name, address, catalog_note
) values (
  1,
  '59174806956',
  null,
  'happystorecbba1',
  'Happystorecbba@gmail.com',
  'Viciousfer1996@gmail.com',
  '64000633',
  'Franklin Fernando Condori Gregorio',
  'Calle Punata entre San Martín y Lanza, Shopping Garoni, 2do piso, oficina 10-C',
  'Precios referenciales sujetos a variación. Consulta el precio y stock actual antes de comprar.'
) on conflict (id) do update set
  whatsapp = excluded.whatsapp,
  tiktok = excluded.tiktok,
  email = excluded.email,
  owner_email = excluded.owner_email,
  store_phone = excluded.store_phone,
  owner_name = excluded.owner_name,
  address = excluded.address,
  catalog_note = excluded.catalog_note,
  updated_at = now();

alter table public.products enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products for select using (true);

drop policy if exists "Happy Store admin can insert products" on public.products;
create policy "Happy Store admin can insert products" on public.products for insert to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com');

drop policy if exists "Happy Store admin can update products" on public.products;
create policy "Happy Store admin can update products" on public.products for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com');

drop policy if exists "Happy Store admin can delete products" on public.products;
create policy "Happy Store admin can delete products" on public.products for delete to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com');

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings" on public.store_settings for select using (true);

drop policy if exists "Happy Store admin can update settings" on public.store_settings;
create policy "Happy Store admin can update settings" on public.store_settings for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com');

drop policy if exists "Happy Store admin can insert settings" on public.store_settings;
create policy "Happy Store admin can insert settings" on public.store_settings for insert to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'happystorecbba@gmail.com');
