create schema if not exists autocore;
create schema if not exists autocore_private;

grant usage on schema autocore to anon, authenticated, service_role;
grant all on all tables in schema autocore to anon, authenticated, service_role;
grant all on all routines in schema autocore to anon, authenticated, service_role;
grant all on all sequences in schema autocore to anon, authenticated, service_role;

alter default privileges for role postgres in schema autocore
grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema autocore
grant all on routines to anon, authenticated, service_role;

alter default privileges for role postgres in schema autocore
grant all on sequences to anon, authenticated, service_role;

create extension if not exists pgcrypto;

create table if not exists autocore.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('buyer', 'seller', 'dealer', 'admin')),
  first_name text,
  last_name text,
  phone_number text,
  profile_image_url text,
  bio text,
  location text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists autocore.seller_verification (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references autocore.profiles(id) on delete cascade,
  national_id_number text not null,
  national_id_image_url text,
  business_name text,
  business_registration_number text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'approved', 'rejected')),
  verified_at timestamp,
  rejection_reason text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists autocore.car_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references autocore.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  make text not null,
  model text not null,
  year integer not null,
  price_ksh decimal(12, 2) not null,
  mileage integer,
  transmission text check (transmission in ('manual', 'automatic')),
  fuel_type text check (fuel_type in ('petrol', 'diesel', 'hybrid', 'electric')),
  color text,
  body_type text,
  location text,
  condition_type text not null default 'used' check (condition_type in ('new', 'used')),
  source_type text not null default 'local' check (source_type in ('local', 'import')),
  clearing_agent_name text,
  status text not null default 'active' check (status in ('active', 'sold', 'delisted')),
  featured boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  views_count integer default 0
);

create table if not exists autocore.car_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references autocore.car_listings(id) on delete cascade,
  image_url text not null,
  display_order integer default 0,
  created_at timestamp default now()
);

create table if not exists autocore.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references autocore.profiles(id) on delete cascade,
  reviewed_user_id uuid not null references autocore.profiles(id) on delete cascade,
  listing_id uuid references autocore.car_listings(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  comment text,
  transaction_type text check (transaction_type in ('buyer', 'seller')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists autocore.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references autocore.profiles(id) on delete cascade,
  recipient_id uuid not null references autocore.profiles(id) on delete cascade,
  listing_id uuid references autocore.car_listings(id) on delete cascade,
  subject text,
  body text not null,
  is_read boolean default false,
  created_at timestamp default now()
);

create table if not exists autocore.saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references autocore.profiles(id) on delete cascade,
  listing_id uuid not null references autocore.car_listings(id) on delete cascade,
  created_at timestamp default now(),
  unique(user_id, listing_id)
);

create table if not exists autocore.inquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references autocore.profiles(id) on delete cascade,
  listing_id uuid not null references autocore.car_listings(id) on delete cascade,
  seller_id uuid not null references autocore.profiles(id) on delete cascade,
  offered_price_ksh decimal(12, 2),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'sold')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists autocore.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references autocore.profiles(id) on delete cascade,
  seller_id uuid not null references autocore.profiles(id) on delete cascade,
  listing_id uuid not null references autocore.car_listings(id) on delete cascade,
  amount_ksh decimal(12, 2) not null,
  payment_method text not null check (payment_method in ('mpesa', 'bank_transfer', 'cash')),
  transaction_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  mpesa_checkout_id text,
  mpesa_receipt_number text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists autocore.flagged_listings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references autocore.car_listings(id) on delete cascade,
  reported_by_id uuid not null references autocore.profiles(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists autocore.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references autocore.profiles(id) on delete cascade,
  action text not null,
  resource_type text,
  resource_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamp default now()
);

create table if not exists autocore.analytics (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references autocore.car_listings(id) on delete cascade,
  user_id uuid references autocore.profiles(id) on delete set null,
  event_type text not null check (event_type in ('view', 'contact', 'save', 'share')),
  created_at timestamp default now()
);

alter table autocore.profiles enable row level security;
alter table autocore.seller_verification enable row level security;
alter table autocore.car_listings enable row level security;
alter table autocore.car_images enable row level security;
alter table autocore.reviews enable row level security;
alter table autocore.messages enable row level security;
alter table autocore.saved_listings enable row level security;
alter table autocore.inquiries enable row level security;
alter table autocore.payments enable row level security;
alter table autocore.flagged_listings enable row level security;
alter table autocore.activity_log enable row level security;
alter table autocore.analytics enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'profiles' and policyname = 'profiles_select') then
    create policy "profiles_select" on autocore.profiles for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'profiles' and policyname = 'profiles_insert_own') then
    create policy "profiles_insert_own" on autocore.profiles for insert with check (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'profiles' and policyname = 'profiles_update_own') then
    create policy "profiles_update_own" on autocore.profiles for update using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'profiles' and policyname = 'profiles_delete_own') then
    create policy "profiles_delete_own" on autocore.profiles for delete using (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'seller_verification' and policyname = 'seller_verification_select_own') then
    create policy "seller_verification_select_own" on autocore.seller_verification
      for select using (auth.uid() = seller_id or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'seller_verification' and policyname = 'seller_verification_insert_own') then
    create policy "seller_verification_insert_own" on autocore.seller_verification
      for insert with check (auth.uid() = seller_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'seller_verification' and policyname = 'seller_verification_update_admin') then
    create policy "seller_verification_update_admin" on autocore.seller_verification
      for update using (exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_listings' and policyname = 'car_listings_select_public') then
    create policy "car_listings_select_public" on autocore.car_listings
      for select using (status = 'active' or auth.uid() = seller_id or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_listings' and policyname = 'car_listings_insert_seller') then
    create policy "car_listings_insert_seller" on autocore.car_listings
      for insert with check (auth.uid() = seller_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_listings' and policyname = 'car_listings_update_seller') then
    create policy "car_listings_update_seller" on autocore.car_listings
      for update using (auth.uid() = seller_id or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_listings' and policyname = 'car_listings_delete_seller') then
    create policy "car_listings_delete_seller" on autocore.car_listings
      for delete using (auth.uid() = seller_id or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_images' and policyname = 'car_images_select_public') then
    create policy "car_images_select_public" on autocore.car_images for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_images' and policyname = 'car_images_insert_seller') then
    create policy "car_images_insert_seller" on autocore.car_images
      for insert with check (exists(select 1 from autocore.car_listings where id = listing_id and seller_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'car_images' and policyname = 'car_images_delete_seller') then
    create policy "car_images_delete_seller" on autocore.car_images
      for delete using (exists(select 1 from autocore.car_listings where id = listing_id and seller_id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'reviews' and policyname = 'reviews_select_public') then
    create policy "reviews_select_public" on autocore.reviews for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'reviews' and policyname = 'reviews_insert_own') then
    create policy "reviews_insert_own" on autocore.reviews for insert with check (auth.uid() = reviewer_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'reviews' and policyname = 'reviews_update_own') then
    create policy "reviews_update_own" on autocore.reviews for update using (auth.uid() = reviewer_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'reviews' and policyname = 'reviews_delete_own') then
    create policy "reviews_delete_own" on autocore.reviews for delete using (auth.uid() = reviewer_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'messages' and policyname = 'messages_select_own') then
    create policy "messages_select_own" on autocore.messages
      for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'messages' and policyname = 'messages_insert_own') then
    create policy "messages_insert_own" on autocore.messages
      for insert with check (auth.uid() = sender_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'messages' and policyname = 'messages_update_read') then
    create policy "messages_update_read" on autocore.messages
      for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'saved_listings' and policyname = 'saved_listings_select_own') then
    create policy "saved_listings_select_own" on autocore.saved_listings for select using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'saved_listings' and policyname = 'saved_listings_insert_own') then
    create policy "saved_listings_insert_own" on autocore.saved_listings for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'saved_listings' and policyname = 'saved_listings_delete_own') then
    create policy "saved_listings_delete_own" on autocore.saved_listings for delete using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'inquiries' and policyname = 'inquiries_select_own') then
    create policy "inquiries_select_own" on autocore.inquiries
      for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'inquiries' and policyname = 'inquiries_insert_buyer') then
    create policy "inquiries_insert_buyer" on autocore.inquiries
      for insert with check (auth.uid() = buyer_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'inquiries' and policyname = 'inquiries_update_seller') then
    create policy "inquiries_update_seller" on autocore.inquiries
      for update using (auth.uid() = seller_id or auth.uid() = buyer_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'payments' and policyname = 'payments_select_own') then
    create policy "payments_select_own" on autocore.payments
      for select using (auth.uid() = buyer_id or auth.uid() = seller_id or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'payments' and policyname = 'payments_insert_buyer') then
    create policy "payments_insert_buyer" on autocore.payments
      for insert with check (auth.uid() = buyer_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'payments' and policyname = 'payments_update_admin') then
    create policy "payments_update_admin" on autocore.payments
      for update using (exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'flagged_listings' and policyname = 'flagged_listings_insert_user') then
    create policy "flagged_listings_insert_user" on autocore.flagged_listings
      for insert with check (auth.uid() = reported_by_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'flagged_listings' and policyname = 'flagged_listings_select_admin') then
    create policy "flagged_listings_select_admin" on autocore.flagged_listings
      for select using (exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'flagged_listings' and policyname = 'flagged_listings_update_admin') then
    create policy "flagged_listings_update_admin" on autocore.flagged_listings
      for update using (exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'activity_log' and policyname = 'activity_log_select_own') then
    create policy "activity_log_select_own" on autocore.activity_log
      for select using (auth.uid() = user_id or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'activity_log' and policyname = 'activity_log_insert') then
    create policy "activity_log_insert" on autocore.activity_log for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'analytics' and policyname = 'analytics_select_listing_owner') then
    create policy "analytics_select_listing_owner" on autocore.analytics
      for select using (
        exists(select 1 from autocore.car_listings where id = listing_id and seller_id = auth.uid())
        or exists(select 1 from autocore.profiles where id = auth.uid() and user_type = 'admin')
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'autocore' and tablename = 'analytics' and policyname = 'analytics_insert') then
    create policy "analytics_insert" on autocore.analytics for insert with check (true);
  end if;
end $$;

create index if not exists idx_profiles_user_type on autocore.profiles(user_type);
create index if not exists idx_car_listings_seller_id on autocore.car_listings(seller_id);
create index if not exists idx_car_listings_status on autocore.car_listings(status);
create index if not exists idx_car_listings_created_at on autocore.car_listings(created_at);
create index if not exists idx_car_listings_location on autocore.car_listings(location);
create index if not exists idx_car_listings_make_model on autocore.car_listings(make, model);
create index if not exists idx_messages_sender_recipient on autocore.messages(sender_id, recipient_id);
create index if not exists idx_reviews_reviewed_user on autocore.reviews(reviewed_user_id);
create index if not exists idx_inquiries_buyer_seller on autocore.inquiries(buyer_id, seller_id);
create index if not exists idx_payments_buyer_seller on autocore.payments(buyer_id, seller_id);
create index if not exists idx_saved_listings_user on autocore.saved_listings(user_id);

create or replace function autocore_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = autocore, public
as $$
begin
  insert into autocore.profiles (
    id,
    user_type,
    first_name,
    last_name,
    phone_number
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'user_type', 'buyer'),
    coalesce(new.raw_user_meta_data ->> 'first_name', null),
    coalesce(new.raw_user_meta_data ->> 'last_name', null),
    coalesce(new.raw_user_meta_data ->> 'phone_number', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function autocore_private.handle_new_user();
