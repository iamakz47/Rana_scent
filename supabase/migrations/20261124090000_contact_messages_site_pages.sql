-- Contact messages and editable content pages (About, Contact, FAQ).
-- Additive only: two new tables and their functions. Nothing existing changes.

-- ---------------------------------------------------------------------------
-- Contact messages
-- ---------------------------------------------------------------------------
-- Visitors send messages only through public.submit_contact_message (they
-- can't read or touch the table). Staff who can see customers (owner, admin,
-- manager, support) read them and mark them read or archived.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null default '' check (email = '' or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9 ]{7,20}$'),
  message text not null check (char_length(message) between 10 and 2000),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  -- Hash of the sender's network address (never the address itself), used
  -- only to slow down repeated sending.
  client_hash text not null default '' check (char_length(client_hash) <= 64),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);
create index if not exists contact_messages_status_created_idx on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_client_idx on public.contact_messages (client_hash, created_at desc);
create index if not exists contact_messages_handled_by_idx on public.contact_messages (handled_by);

alter table public.contact_messages enable row level security;
create policy "Customer staff read messages" on public.contact_messages
  for select to authenticated using ((select private.has_permission('customers.read')));

create trigger contact_messages_audit after update or delete on public.contact_messages
  for each row execute function private.audit_row('id');

-- Sends a message. Validates everything and limits how often messages can
-- arrive (per sender and overall), so the form can't be used to flood the inbox.
create or replace function public.submit_contact_message(
  p_name text, p_email text, p_phone text, p_message text, p_locale text, p_client_hash text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := regexp_replace(btrim(coalesce(p_phone, '')), '[^0-9+ ]', '', 'g');
  v_message text := btrim(coalesce(p_message, ''));
  v_hash text := left(coalesce(p_client_hash, ''), 64);
  v_id uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'contact_name' using errcode = '22023';
  end if;
  if v_email = '' and v_phone = '' then
    raise exception 'contact_reply_to' using errcode = '22023';
  end if;
  if v_email <> '' and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'contact_email' using errcode = '22023';
  end if;
  if v_phone <> '' and v_phone !~ '^\+?[0-9 ]{7,20}$' then
    raise exception 'contact_phone' using errcode = '22023';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 2000 then
    raise exception 'contact_message' using errcode = '22023';
  end if;
  -- More than three links is almost always spam.
  if (select count(*) from regexp_matches(v_message, 'https?://|www\.', 'gi')) > 3 then
    raise exception 'contact_spam' using errcode = '22023';
  end if;
  -- At most 5 messages per sender per hour, and 100 overall per hour.
  if v_hash <> '' and (select count(*) from public.contact_messages
                       where client_hash = v_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'contact_rate_limited' using errcode = '22023';
  end if;
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'contact_rate_limited' using errcode = '22023';
  end if;

  insert into public.contact_messages (name, email, phone, message, locale, client_hash)
  values (v_name, v_email, v_phone, v_message, case when p_locale = 'en' then 'en' else 'ar' end, v_hash)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_contact_message(text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to anon, authenticated, service_role;

-- Marks a message new, read or archived (customer staff only).
create or replace function public.set_contact_message_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('customers.read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status not in ('new', 'read', 'archived') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  update public.contact_messages
     set status = p_status,
         handled_at = case when p_status = 'new' then null else now() end,
         handled_by = case when p_status = 'new' then null else (select auth.uid()) end
   where id = p_id;
  if not found then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_contact_message_status(uuid, text) from public, anon;
grant execute on function public.set_contact_message_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Editable content pages
-- ---------------------------------------------------------------------------
-- One row per page with a draft and a published copy. Content is JSON:
--   { "title": {ar,en}, "lead": {ar,en}, "body": {ar,en},
--     "items": [ { "q": {ar,en}, "a": {ar,en} }, … ] }   (items: FAQ only)
-- The app validates the shape; the database limits size and who may write.
-- Until a page is published, the store shows its built-in text.

create table if not exists public.site_pages (
  key text primary key check (key in ('about', 'contact', 'faq')),
  draft_content jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_content) = 'object' and pg_column_size(draft_content) <= 65536),
  published_content jsonb check (published_content is null or (jsonb_typeof(published_content) = 'object' and pg_column_size(published_content) <= 65536)),
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null
);
create index if not exists site_pages_draft_updated_by_idx on public.site_pages (draft_updated_by);
create index if not exists site_pages_published_by_idx on public.site_pages (published_by);

insert into public.site_pages (key) values ('about'), ('contact'), ('faq') on conflict do nothing;

alter table public.site_pages enable row level security;
-- Drafts are visible to content editors (owner, admin, manager, editor).
create policy "Content editors read pages" on public.site_pages
  for select to authenticated using ((select private.has_permission('content.write')));

create trigger site_pages_audit after insert or update on public.site_pages
  for each row execute function private.audit_row('key');

-- Published content for visitors; NULL until the owner publishes.
create or replace function public.get_site_page(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select p.published_content || jsonb_build_object('published_at', p.published_at)
  from public.site_pages p
  where p.key = p_key and p.published_at is not null and p.published_content is not null
$$;
revoke all on function public.get_site_page(text) from public;
grant execute on function public.get_site_page(text) to anon, authenticated, service_role;

create or replace function public.save_site_page_draft(p_key text, p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('content.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Invalid content' using errcode = '22023';
  end if;
  update public.site_pages
     set draft_content = p_content, draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where key = p_key;
  if not found then
    raise exception 'Page not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.save_site_page_draft(text, jsonb) from public, anon;
grant execute on function public.save_site_page_draft(text, jsonb) to authenticated;

-- Publishing copies the draft. A title is needed in both languages.
create or replace function public.publish_site_page(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft jsonb;
begin
  if not private.has_permission('content.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select draft_content into v_draft from public.site_pages where key = p_key for update;
  if not found then
    raise exception 'Page not found' using errcode = 'P0002';
  end if;
  if btrim(coalesce(v_draft #>> '{title,ar}', '')) = '' or btrim(coalesce(v_draft #>> '{title,en}', '')) = '' then
    raise exception 'page_incomplete' using errcode = '22023';
  end if;
  update public.site_pages
     set published_content = v_draft, published_at = now(), published_by = (select auth.uid())
   where key = p_key;
end;
$$;
revoke all on function public.publish_site_page(text) from public, anon;
grant execute on function public.publish_site_page(text) to authenticated;

-- Takes a page back to its built-in text.
create or replace function public.unpublish_site_page(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('content.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.site_pages set published_at = null, published_by = (select auth.uid()) where key = p_key;
end;
$$;
revoke all on function public.unpublish_site_page(text) from public, anon;
grant execute on function public.unpublish_site_page(text) to authenticated;
