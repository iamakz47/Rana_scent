-- Rana Scent: protect the Phase 3 checkout settings.
-- Content editors may change only the slider fields of store_settings; every
-- other field, including the new checkout settings (cash on delivery, online
-- payments, unpaid-order hold, delivery notes), needs settings.write.
create or replace function private.guard_store_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  new.updated_by := (select auth.uid());
  if not private.has_permission('settings.write') and (
       (to_jsonb(new) - array['slider_autoplay', 'slider_interval_seconds', 'updated_at', 'updated_by'])
       is distinct from
       (to_jsonb(old) - array['slider_autoplay', 'slider_interval_seconds', 'updated_at', 'updated_by'])
  ) then
    raise exception 'Changing store settings requires settings.write' using errcode = '42501';
  end if;
  if not private.has_permission('content.write') and (
       new.slider_autoplay is distinct from old.slider_autoplay
    or new.slider_interval_seconds is distinct from old.slider_interval_seconds
  ) then
    raise exception 'Changing slider settings requires content.write' using errcode = '42501';
  end if;
  return new;
end;
$$;
