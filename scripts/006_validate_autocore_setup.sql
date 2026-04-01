select
  table_name
from information_schema.tables
where table_schema = 'autocore'
order by table_name;

select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'autocore'
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
where schemaname = 'autocore'
order by tablename, policyname;

select
  n.nspname as function_schema,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'autocore_private'
  and p.proname = 'handle_new_user';

select
  trigger_name,
  event_object_schema,
  event_object_table,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name = 'on_auth_user_created';
