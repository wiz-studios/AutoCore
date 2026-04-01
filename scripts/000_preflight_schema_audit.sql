select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'seller_verification',
    'car_listings',
    'car_images',
    'reviews',
    'messages',
    'saved_listings',
    'inquiries',
    'payments',
    'flagged_listings',
    'activity_log',
    'analytics'
  )
order by table_name;

select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'car_listings', 'reviews')
order by table_name, ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'seller_verification',
    'car_listings',
    'car_images',
    'reviews',
    'messages',
    'saved_listings',
    'inquiries',
    'payments',
    'flagged_listings',
    'activity_log',
    'analytics'
  )
order by tablename, policyname;

select
  trigger_name,
  event_object_table
from information_schema.triggers
where trigger_schema = 'auth'
   or event_object_schema = 'auth'
order by event_object_table, trigger_name;
