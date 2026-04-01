-- Create profiles table (extends auth.users)
create table if not exists public.profiles (
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

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- Create seller verification table
create table if not exists public.seller_verification (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.profiles(id) on delete cascade,
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

alter table public.seller_verification enable row level security;

create policy "seller_verification_select_own" on public.seller_verification 
  for select using (auth.uid() = seller_id or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
create policy "seller_verification_insert_own" on public.seller_verification 
  for insert with check (auth.uid() = seller_id);
create policy "seller_verification_update_admin" on public.seller_verification 
  for update using (exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- Create car listings table
create table if not exists public.car_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
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

alter table public.car_listings enable row level security;

create policy "car_listings_select_public" on public.car_listings 
  for select using (status = 'active' or auth.uid() = seller_id or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
create policy "car_listings_insert_seller" on public.car_listings 
  for insert with check (auth.uid() = seller_id);
create policy "car_listings_update_seller" on public.car_listings 
  for update using (auth.uid() = seller_id or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
create policy "car_listings_delete_seller" on public.car_listings 
  for delete using (auth.uid() = seller_id or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- Create car images table
create table if not exists public.car_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  image_url text not null,
  display_order integer default 0,
  created_at timestamp default now()
);

alter table public.car_images enable row level security;

create policy "car_images_select_public" on public.car_images for select using (true);
create policy "car_images_insert_seller" on public.car_images 
  for insert with check (exists(select 1 from public.car_listings where id = listing_id and seller_id = auth.uid()));
create policy "car_images_delete_seller" on public.car_images 
  for delete using (exists(select 1 from public.car_listings where id = listing_id and seller_id = auth.uid()));

-- Create reviews and ratings table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.car_listings(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text,
  comment text,
  transaction_type text check (transaction_type in ('buyer', 'seller')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.reviews enable row level security;

create policy "reviews_select_public" on public.reviews for select using (true);
create policy "reviews_insert_own" on public.reviews 
  for insert with check (auth.uid() = reviewer_id);
create policy "reviews_update_own" on public.reviews 
  for update using (auth.uid() = reviewer_id);
create policy "reviews_delete_own" on public.reviews 
  for delete using (auth.uid() = reviewer_id);

-- Create messaging table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.car_listings(id) on delete cascade,
  subject text,
  body text not null,
  is_read boolean default false,
  created_at timestamp default now()
);

alter table public.messages enable row level security;

create policy "messages_select_own" on public.messages 
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "messages_insert_own" on public.messages 
  for insert with check (auth.uid() = sender_id);
create policy "messages_update_read" on public.messages 
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Create saved listings table
create table if not exists public.saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  created_at timestamp default now(),
  unique(user_id, listing_id)
);

alter table public.saved_listings enable row level security;

create policy "saved_listings_select_own" on public.saved_listings 
  for select using (auth.uid() = user_id);
create policy "saved_listings_insert_own" on public.saved_listings 
  for insert with check (auth.uid() = user_id);
create policy "saved_listings_delete_own" on public.saved_listings 
  for delete using (auth.uid() = user_id);

-- Create inquiries/offers table
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  offered_price_ksh decimal(12, 2),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'sold')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.inquiries enable row level security;

create policy "inquiries_select_own" on public.inquiries 
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "inquiries_insert_buyer" on public.inquiries 
  for insert with check (auth.uid() = buyer_id);
create policy "inquiries_update_seller" on public.inquiries 
  for update using (auth.uid() = seller_id or auth.uid() = buyer_id);

-- Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  amount_ksh decimal(12, 2) not null,
  payment_method text not null check (payment_method in ('mpesa', 'bank_transfer', 'cash')),
  transaction_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  mpesa_checkout_id text,
  mpesa_receipt_number text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.payments enable row level security;

create policy "payments_select_own" on public.payments 
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
create policy "payments_insert_buyer" on public.payments 
  for insert with check (auth.uid() = buyer_id);
create policy "payments_update_admin" on public.payments 
  for update using (exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- Create flagged listings table (for fraud prevention)
create table if not exists public.flagged_listings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  reported_by_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.flagged_listings enable row level security;

create policy "flagged_listings_insert_user" on public.flagged_listings 
  for insert with check (auth.uid() = reported_by_id);
create policy "flagged_listings_select_admin" on public.flagged_listings 
  for select using (exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
create policy "flagged_listings_update_admin" on public.flagged_listings 
  for update using (exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- Create user activity log table
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  resource_type text,
  resource_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamp default now()
);

alter table public.activity_log enable row level security;

create policy "activity_log_select_own" on public.activity_log 
  for select using (auth.uid() = user_id or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));
create policy "activity_log_insert" on public.activity_log 
  for insert with check (true);

-- Create analytics table for tracking views and interactions
create table if not exists public.analytics (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('view', 'contact', 'save', 'share')),
  created_at timestamp default now()
);

alter table public.analytics enable row level security;

create policy "analytics_select_listing_owner" on public.analytics 
  for select using (
    exists(select 1 from public.car_listings where id = listing_id and seller_id = auth.uid())
    or exists(select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
  );
create policy "analytics_insert" on public.analytics 
  for insert with check (true);

-- Create indices for performance
create index idx_profiles_user_type on public.profiles(user_type);
create index idx_car_listings_seller_id on public.car_listings(seller_id);
create index idx_car_listings_status on public.car_listings(status);
create index idx_car_listings_created_at on public.car_listings(created_at);
create index idx_car_listings_location on public.car_listings(location);
create index idx_car_listings_make_model on public.car_listings(make, model);
create index idx_messages_sender_recipient on public.messages(sender_id, recipient_id);
create index idx_reviews_reviewed_user on public.reviews(reviewed_user_id);
create index idx_inquiries_buyer_seller on public.inquiries(buyer_id, seller_id);
create index idx_payments_buyer_seller on public.payments(buyer_id, seller_id);
create index idx_saved_listings_user on public.saved_listings(user_id);
