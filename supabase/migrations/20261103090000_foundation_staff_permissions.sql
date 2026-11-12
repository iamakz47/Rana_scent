-- Rana Scent: Phase 2 foundation.
-- Staff, roles and permissions; shared helpers; audit log.
--
-- Security model
--   * Every table has row-level security enabled.
--   * Authorization helpers live in the `private` schema, which the Data API
--     does not expose. They are SECURITY DEFINER with an empty search_path so
--     they can read staff tables without granting clients direct access.
--   * Staff identity is always auth.uid(): never an email address, never a
--     claim the client can edit (user_metadata).
--   * Role → permission mapping is data owned by migrations. No client policy
--     allows writing it, so nobody can grant themselves a new permission.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------

create table public.roles (
  key text primary key check (key in ('owner', 'admin', 'manager', 'editor', 'support', 'finance')),
  rank smallint not null unique check (rank between 1 and 100),
  name_ar text not null,
  name_en text not null,
  description_ar text not null default '',
  description_en text not null default ''
);
comment on table public.roles is 'Staff roles. Lower rank = more authority. Managed by migrations only.';

create table public.permissions (
  key text primary key check (key ~ '^[a-z]+\.[a-z]+$'),
  description text not null
);
comment on table public.permissions is 'Permission catalogue. Managed by migrations only.';

create table public.role_permissions (
  role text not null references public.roles (key) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);
create index role_permissions_permission_idx on public.role_permissions (permission);

insert into public.roles (key, rank, name_ar, name_en, description_ar, description_en) values
  ('owner',   1, 'المالك',  'Owner',   'صلاحيات كاملة بما فيها إدارة المالكين والمسؤولين.', 'Full access, including managing owners and admins.'),
  ('admin',   2, 'مسؤول',   'Admin',   'إدارة المتجر والموظفين باستثناء المالكين والمسؤولين.', 'Runs the store and staff, except owners and admins.'),
  ('manager', 3, 'مدير',    'Manager', 'المنتجات والمخزون والطلبات والمحتوى.', 'Products, inventory, orders and content.'),
  ('editor',  4, 'محرر',    'Editor',  'المنتجات والمحتوى والوسائط دون النشر.', 'Products, content and media, without publishing.'),
  ('support', 5, 'الدعم',   'Support', 'الطلبات والعملاء.', 'Orders and customers.'),
  ('finance', 6, 'المالية', 'Finance', 'المدفوعات والمصروفات والتقارير.', 'Payments, expenses and reports.');

insert into public.permissions (key, description) values
  ('dashboard.view',   'Open the admin dashboard'),
  ('catalog.read',     'View products and categories, including drafts'),
  ('catalog.write',    'Create and edit products, variants and categories'),
  ('catalog.publish',  'Publish, unpublish, archive and delete catalog items'),
  ('inventory.read',   'View stock levels and movement history'),
  ('inventory.adjust', 'Adjust stock and thresholds'),
  ('content.write',    'Edit homepage slides, sections and store presentation'),
  ('media.write',      'Upload, edit and delete media'),
  ('orders.read',      'View orders'),
  ('orders.write',     'Update order status'),
  ('customers.read',   'View customer profiles and addresses'),
  ('marketing.write',  'Manage discount codes and promotions'),
  ('finance.read',     'View payments, revenue and expenses'),
  ('finance.write',    'Record and edit expenses'),
  ('settings.write',   'Edit store settings, shipping zones and rates'),
  ('staff.read',       'View staff members'),
  ('staff.write',      'Assign and revoke staff roles'),
  ('audit.read',       'Read the audit log');

insert into public.role_permissions (role, permission)
select 'owner', key from public.permissions
union all
select 'admin', key from public.permissions
union all
select 'manager', p from unnest(array[
  'dashboard.view', 'catalog.read', 'catalog.write', 'catalog.publish', 'inventory.read',
  'inventory.adjust', 'content.write', 'media.write', 'orders.read', 'orders.write',
  'customers.read', 'marketing.write', 'staff.read'
]) as p
union all
select 'editor', p from unnest(array[
  'dashboard.view', 'catalog.read', 'catalog.write', 'inventory.read', 'content.write', 'media.write'
]) as p
union all
select 'support', p from unnest(array[
  'dashboard.view', 'catalog.read', 'inventory.read', 'orders.read', 'orders.write', 'customers.read'
]) as p
union all
select 'finance', p from unnest(array[
  'dashboard.view', 'catalog.read', 'orders.read', 'finance.read', 'finance.write'
]) as p;

-- ---------------------------------------------------------------------------
-- Staff members
-- ---------------------------------------------------------------------------

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null references public.roles (key),
  display_name text not null default '' check (char_length(display_name) <= 80),
  is_active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_members_role_idx on public.staff_members (role) where is_active;
create index staff_members_invited_by_idx on public.staff_members (invited_by);

create trigger staff_members_updated_at
  before update on public.staff_members
  for each row execute function private.set_updated_at();

-- Role of the signed-in user, or null when they are not active staff.
create or replace function private.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
  from public.staff_members s
  where s.user_id = (select auth.uid()) and s.is_active
$$;

create or replace function private.has_permission(required text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    join public.role_permissions rp on rp.role = s.role
    where s.user_id = (select auth.uid())
      and s.is_active
      and rp.permission = required
  )
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_role() is not null
$$;

revoke all on function private.staff_role() from public;
revoke all on function private.has_permission(text) from public;
revoke all on function private.is_staff() from public;
grant execute on function private.staff_role() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;

-- Privilege-escalation guard for staff_members. Runs for every client write
-- (the service role and SQL-editor sessions have no auth.uid() and skip the
-- per-actor checks, but the last-owner rule always applies).
create or replace function private.guard_staff_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text := private.staff_role();
  privileged constant text[] := array['owner', 'admin'];
begin
  if actor is not null then
    if actor_role is null then
      raise exception 'Only staff can manage staff' using errcode = '42501';
    end if;

    -- Nobody changes their own role, activation or membership.
    if (tg_op in ('UPDATE', 'DELETE') and old.user_id = actor)
       or (tg_op = 'INSERT' and new.user_id = actor) then
      raise exception 'You cannot change your own staff access' using errcode = '42501';
    end if;

    -- Only owners grant, change or revoke owner and admin access.
    if actor_role <> 'owner' and (
         (tg_op in ('INSERT', 'UPDATE') and new.role = any (privileged))
      or (tg_op in ('UPDATE', 'DELETE') and old.role = any (privileged))
    ) then
      raise exception 'Only an owner can manage owner and admin access' using errcode = '42501';
    end if;
  end if;

  -- The store must always keep at least one active owner.
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active) then
    if not exists (
      select 1 from public.staff_members
      where role = 'owner' and is_active and user_id <> old.user_id
    ) then
      raise exception 'The store must keep at least one active owner' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- user_id and invited_by are immutable once set.
    new.user_id := old.user_id;
    new.invited_by := old.invited_by;
    new.created_at := old.created_at;
  elsif tg_op = 'INSERT' then
    new.invited_by := coalesce(actor, new.invited_by);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger staff_members_guard
  before insert or update or delete on public.staff_members
  for each row execute function private.guard_staff_members();

-- One-time owner bootstrap. Run from the Supabase SQL editor (as postgres) for
-- an existing, verified Auth user. Refuses once any owner exists. Not
-- callable through the Data API.
create or replace function private.bootstrap_owner(target_user uuid, name text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.staff_members where role = 'owner') then
    raise exception 'An owner already exists; invite further staff from the admin dashboard';
  end if;
  if not exists (select 1 from auth.users where id = target_user and email_confirmed_at is not null) then
    raise exception 'User % not found or email not confirmed', target_user;
  end if;
  insert into public.staff_members (user_id, role, display_name)
  values (target_user, 'owner', coalesce(name, ''));
end;
$$;
revoke all on function private.bootstrap_owner(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit log (append-only; written only by triggers)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  pk text := coalesce(tg_argv[0], 'id');
begin
  if tg_op = 'UPDATE' and (old_row - 'updated_at') = (new_row - 'updated_at') then
    return null;
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce(new_row ->> pk, old_row ->> pk),
    old_row,
    new_row
  );
  return null;
end;
$$;
revoke all on function private.audit_row() from public;

create trigger staff_members_audit
  after insert or update or delete on public.staff_members
  for each row execute function private.audit_row('user_id');

-- ---------------------------------------------------------------------------
-- Customer profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_members enable row level security;
alter table public.audit_logs enable row level security;
alter table public.profiles enable row level security;

-- Staff can read the role catalogue (the admin shows it); nobody writes it.
create policy "Staff read roles" on public.roles
  for select to authenticated using ((select private.is_staff()));
create policy "Staff read permissions" on public.permissions
  for select to authenticated using ((select private.is_staff()));
create policy "Staff read role permissions" on public.role_permissions
  for select to authenticated using ((select private.is_staff()));

create policy "Staff read own membership" on public.staff_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('staff.read')));
create policy "Staff managers insert members" on public.staff_members
  for insert to authenticated
  with check ((select private.has_permission('staff.write')));
create policy "Staff managers update members" on public.staff_members
  for update to authenticated
  using ((select private.has_permission('staff.write')))
  with check ((select private.has_permission('staff.write')));
create policy "Staff managers delete members" on public.staff_members
  for delete to authenticated
  using ((select private.has_permission('staff.write')));

create policy "Auditors read audit log" on public.audit_logs
  for select to authenticated using ((select private.has_permission('audit.read')));

create policy "Users read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.has_permission('customers.read')));
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Defense in depth: anonymous visitors get no table privileges here at all.
revoke all on public.roles, public.permissions, public.role_permissions,
  public.staff_members, public.audit_logs, public.profiles from anon;
-- Clients never write the audit log or role catalogue directly.
revoke insert, update, delete, truncate on public.audit_logs, public.roles,
  public.permissions, public.role_permissions from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;

-- Staff assignment by email for users who already exist in Auth (for example
-- invited from the Supabase dashboard). Uses the caller's permissions: the
-- guard trigger and RLS above still apply because this runs as the caller.
create or replace function public.assign_staff_role(target_email text, target_role text, name text default '')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target uuid;
begin
  if not private.has_permission('staff.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  target := private.find_confirmed_user(target_email);
  if target is null then
    raise exception 'No confirmed account uses that email' using errcode = 'P0002';
  end if;
  insert into public.staff_members (user_id, role, display_name, is_active)
  values (target, target_role, coalesce(name, ''), true)
  on conflict (user_id) do update
    set role = excluded.role, is_active = true,
        display_name = coalesce(nullif(excluded.display_name, ''), public.staff_members.display_name);
  return target;
end;
$$;

-- Email → user lookup, available only to staff managers.
create or replace function private.find_confirmed_user(target_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('staff.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (
    select id from auth.users
    where lower(email) = lower(trim(target_email)) and email_confirmed_at is not null
    limit 1
  );
end;
$$;
revoke all on function private.find_confirmed_user(text) from public;
grant execute on function private.find_confirmed_user(text) to authenticated;
revoke all on function public.assign_staff_role(text, text, text) from public, anon;
grant execute on function public.assign_staff_role(text, text, text) to authenticated;

-- Staff directory for the admin (emails come from auth.users).
create or replace function public.list_staff()
returns table (
  user_id uuid,
  email text,
  role text,
  display_name text,
  is_active boolean,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('staff.read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select s.user_id, u.email::text, s.role, s.display_name, s.is_active, u.last_sign_in_at, s.created_at
    from public.staff_members s
    join auth.users u on u.id = s.user_id
    join public.roles r on r.key = s.role
    order by r.rank, s.created_at;
end;
$$;
revoke all on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;
