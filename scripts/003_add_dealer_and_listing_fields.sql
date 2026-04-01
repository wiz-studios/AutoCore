alter table public.profiles
  drop constraint if exists profiles_user_type_check;

alter table public.profiles
  add constraint profiles_user_type_check
  check (user_type in ('buyer', 'seller', 'dealer', 'admin'));

alter table public.car_listings
  add column if not exists location text,
  add column if not exists condition_type text not null default 'used',
  add column if not exists source_type text not null default 'local',
  add column if not exists clearing_agent_name text;

alter table public.car_listings
  drop constraint if exists car_listings_condition_type_check;

alter table public.car_listings
  add constraint car_listings_condition_type_check
  check (condition_type in ('new', 'used'));

alter table public.car_listings
  drop constraint if exists car_listings_source_type_check;

alter table public.car_listings
  add constraint car_listings_source_type_check
  check (source_type in ('local', 'import'));

alter table public.reviews
  alter column title drop not null;

drop policy if exists "analytics_select_admin" on public.analytics;
drop policy if exists "analytics_select_listing_owner" on public.analytics;

create policy "analytics_select_listing_owner" on public.analytics
  for select using (
    exists(select 1 from public.car_listings where id = listing_id and seller_id = auth.uid())
    or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
  );

create index if not exists idx_car_listings_location on public.car_listings(location);
create index if not exists idx_car_listings_make_model on public.car_listings(make, model);
