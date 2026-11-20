-- Rana Scent: provider refunds, partial refunds and payment reconciliation.
--
--   * A refund is requested (orders.write or finance.write), then approved by
--     finance (finance.write). Approval moves it to 'processing' exactly once
--     (row lock + status check), and only then does the server call the
--     provider. A refund can never be sent twice: a request leaves
--     'processing' only through a verified provider result or a manual
--     finance decision.
--   * Requested + processing + processed refunds can never exceed the
--     captured amount.
--   * orders.refunded_fils tracks partial refunds; a full refund moves the
--     payment and order to 'refunded'.
--   * Cancelling a PAID order automatically opens a refund request.
--   * payments_to_reconcile() lists online payments whose webhook may have
--     been missed, for the server to re-check with the provider.
-- Additive and non-destructive.

alter table public.orders
  add column if not exists refunded_fils integer not null default 0 check (refunded_fils >= 0);

alter table public.refund_requests drop constraint if exists refund_requests_status_check;
alter table public.refund_requests add constraint refund_requests_status_check
  check (status in ('requested', 'processing', 'processed', 'rejected', 'failed'));
alter table public.refund_requests
  add column if not exists provider_status text not null default '' check (char_length(provider_status) <= 40),
  add column if not exists last_error text not null default '' check (char_length(last_error) <= 500),
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists approved_at timestamptz;
create unique index if not exists refund_requests_provider_refund_idx on public.refund_requests (provider_refund_id)
  where provider_refund_id is not null;
create index if not exists refund_requests_approved_by_idx on public.refund_requests (approved_by);

-- Client updates may not touch refund totals either.
create or replace function private.guard_order_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  from_client boolean := current_user in ('anon', 'authenticated');
begin
  if new.status is distinct from old.status then
    if not private.order_transition_allowed(old.status, new.status) then
      raise exception 'Order cannot move from % to %', old.status, new.status using errcode = '23514';
    end if;
    if from_client and new.status in ('paid', 'refunded') then
      raise exception 'Payment status changes come from verified payment events only' using errcode = '42501';
    end if;
  end if;
  if from_client and (
       (new.subtotal_fils, new.discount_fils, new.shipping_fils, new.total_fils, new.user_id, new.email,
        new.phone, new.customer_name, new.shipping_address, new.payment_method, new.access_token,
        new.idempotency_key, new.discount_code_id, new.stock_released, new.expires_at, new.refunded_fils,
        new.locale, new.placed_at, new.number)
       is distinct from
       (old.subtotal_fils, old.discount_fils, old.shipping_fils, old.total_fils, old.user_id, old.email,
        old.phone, old.customer_name, old.shipping_address, old.payment_method, old.access_token,
        old.idempotency_key, old.discount_code_id, old.stock_released, old.expires_at, old.refunded_fils,
        old.locale, old.placed_at, old.number)
     ) then
    raise exception 'Order amounts, customer and payment details cannot be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_order_update() from public;
grant execute on function private.guard_order_update() to anon, authenticated, service_role;

-- Cancelling a paid order: release stock (as before), record COD cash on
-- delivery (as before), and open a refund request for what was captured.
create or replace function private.after_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay record;
  open_total integer;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform private.release_order(new.id);
    select * into pay from public.payments p
    where p.order_id = new.id and p.status = 'captured' and p.provider in ('tap', 'mock')
    order by p.created_at desc limit 1;
    if found then
      select coalesce(sum(r.amount_fils), 0) into open_total from public.refund_requests r
      where r.order_id = new.id and r.status in ('requested', 'processing', 'processed');
      if pay.amount_fils - open_total > 0 then
        insert into public.refund_requests (order_id, payment_id, amount_fils, reason, requested_by)
        values (new.id, pay.id, pay.amount_fils - open_total, 'Paid order cancelled', (select auth.uid()));
      end if;
    end if;
  end if;
  if new.status = 'delivered' and new.payment_method = 'cod' and old.status <> 'delivered' then
    insert into public.payments (order_id, provider, method, status, amount_fils, currency, raw_status)
    values (new.id, 'cod', 'cash', 'captured', new.total_fils, 'KWD', 'COLLECTED');
  end if;
  return null;
end;
$$;
revoke all on function private.after_order_status_change() from public;

-- Recomputes refund totals after a refund completes.
create or replace function private.apply_refund_totals(p_order uuid, p_payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refunded integer;
  v_paid integer;
begin
  select coalesce(sum(r.amount_fils), 0) into v_refunded from public.refund_requests r
  where r.order_id = p_order and r.status = 'processed';
  update public.orders set refunded_fils = v_refunded where id = p_order;
  select p.amount_fils into v_paid from public.payments p where p.id = p_payment;
  if v_paid is not null and v_refunded >= v_paid then
    update public.payments set status = 'refunded' where id = p_payment;
    update public.orders od set status = 'refunded'
    where od.id = p_order and private.order_transition_allowed(od.status, 'refunded');
  end if;
end;
$$;
revoke all on function private.apply_refund_totals(uuid, uuid) from public;

create or replace function public.request_refund(p_order uuid, p_amount integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  pay record;
  already integer;
  rid uuid;
begin
  if not (private.has_permission('orders.write') or private.has_permission('finance.write')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into o from public.orders od where od.id = p_order for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  select * into pay from public.payments pm where pm.order_id = o.id and pm.status = 'captured'
  order by pm.created_at desc limit 1;
  if not found then
    raise exception 'refund_no_payment' using errcode = '22023';
  end if;
  select coalesce(sum(rr.amount_fils), 0) into already from public.refund_requests rr
  where rr.order_id = o.id and rr.status in ('requested', 'processing', 'processed');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'refund_reason_missing' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount + already > pay.amount_fils then
    raise exception 'refund_amount_invalid' using errcode = '22023';
  end if;
  insert into public.refund_requests (order_id, payment_id, amount_fils, reason, requested_by)
  values (o.id, pay.id, p_amount, left(btrim(p_reason), 500), (select auth.uid()))
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.request_refund(uuid, integer, text) from public, anon;
grant execute on function public.request_refund(uuid, integer, text) to authenticated;

-- Finance approves a refund for the provider. Returns what the server needs
-- to call the provider. Moves requested -> processing once; a second call
-- fails, so a double click can't refund twice.
create or replace function public.approve_refund(p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  pay record;
begin
  if not private.has_permission('finance.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into r from public.refund_requests rr where rr.id = p_request for update;
  if not found or r.status <> 'requested' then
    raise exception 'refund_not_open' using errcode = '22023';
  end if;
  select * into pay from public.payments p where p.id = r.payment_id;
  if not found or pay.provider not in ('tap', 'mock') or pay.provider_charge_id is null
     or pay.status not in ('captured', 'refunded') then
    raise exception 'refund_manual_only' using errcode = '22023';
  end if;
  update public.refund_requests
     set status = 'processing', approved_by = (select auth.uid()), approved_at = now(), last_error = ''
   where id = r.id;
  return jsonb_build_object('refund_id', r.id, 'order_id', r.order_id, 'provider', pay.provider,
    'charge_id', pay.provider_charge_id, 'amount_fils', r.amount_fils, 'currency', pay.currency,
    'reason', r.reason, 'order_number', (select o.number from public.orders o where o.id = r.order_id));
end;
$$;
revoke all on function public.approve_refund(uuid) from public, anon;
grant execute on function public.approve_refund(uuid) to authenticated;

-- Records a VERIFIED provider refund result (server re-fetched it). Idempotent.
create or replace function public.record_refund_result(
  p_request uuid, p_provider_refund_id text, p_status text, p_amount_fils integer, p_currency text, p_error text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_status text := upper(coalesce(p_status, ''));
begin
  select * into r from public.refund_requests rr where rr.id = p_request for update;
  if not found then
    return 'unknown_refund';
  end if;
  if r.status in ('processed', 'rejected') then
    return 'already_final';
  end if;
  if r.status not in ('processing', 'failed') then
    return 'not_processing';
  end if;
  if p_provider_refund_id is not null and p_provider_refund_id <> ''
     and r.provider_refund_id is not null and r.provider_refund_id <> p_provider_refund_id then
    return 'refund_id_mismatch';
  end if;

  update public.refund_requests
     set provider_refund_id = coalesce(nullif(p_provider_refund_id, ''), provider_refund_id),
         provider_status = left(v_status, 40)
   where id = r.id;

  if v_status in ('REFUNDED', 'SUCCEEDED', 'CAPTURED') then
    if p_amount_fils is distinct from r.amount_fils or upper(coalesce(p_currency, '')) <> 'KWD' then
      update public.refund_requests set last_error = 'Provider amount or currency differs from the request'
      where id = r.id;
      insert into public.order_notes (order_id, body)
      values (r.order_id, 'Refund amount mismatch reported by the provider: review in the payment dashboard.');
      return 'amount_mismatch';
    end if;
    update public.refund_requests set status = 'processed', processed_at = now(), last_error = '' where id = r.id;
    perform private.apply_refund_totals(r.order_id, r.payment_id);
    return 'processed';
  elsif v_status in ('PENDING', 'IN_PROGRESS', 'INITIATED') then
    return 'pending';
  else
    update public.refund_requests
       set status = 'failed', last_error = left(coalesce(nullif(p_error, ''), 'Provider status ' || v_status), 500)
     where id = r.id;
    return 'failed';
  end if;
end;
$$;
revoke all on function public.record_refund_result(uuid, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_refund_result(uuid, text, text, integer, text, text) to service_role;

-- Manual resolution by finance: cash refunds (COD), refunds done in the
-- provider dashboard, a processing refund whose outcome was confirmed by
-- hand, or a rejection. A failed refund can be returned to 'requested'.
create or replace function public.resolve_refund(p_request uuid, p_approve boolean, p_provider_refund_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not private.has_permission('finance.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into r from public.refund_requests rr where rr.id = p_request
    and rr.status in ('requested', 'processing', 'failed') for update;
  if not found then
    raise exception 'Refund request not found or already resolved' using errcode = 'P0002';
  end if;
  if r.status = 'processing' and not p_approve then
    -- The provider may already be refunding: never reject blindly.
    raise exception 'refund_in_progress' using errcode = '22023';
  end if;
  update public.refund_requests rr
     set status = case when p_approve then 'processed' else 'rejected' end,
         provider_refund_id = coalesce(nullif(btrim(coalesce(p_provider_refund_id, '')), ''), rr.provider_refund_id),
         processed_by = (select auth.uid()), processed_at = now()
   where rr.id = p_request;
  if p_approve then
    perform private.apply_refund_totals(r.order_id, r.payment_id);
  end if;
end;
$$;
revoke all on function public.resolve_refund(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_refund(uuid, boolean, text) to authenticated;

-- Finance: send a failed refund back for another attempt.
create or replace function public.reopen_refund(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('finance.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.refund_requests set status = 'requested', provider_refund_id = null, provider_status = ''
  where id = p_request and status = 'failed';
  if not found then
    raise exception 'refund_not_failed' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.reopen_refund(uuid) from public, anon;
grant execute on function public.reopen_refund(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reconciliation (service role)
-- ---------------------------------------------------------------------------

-- Online payments still open after p_min_age_seconds, and provider refunds
-- still processing: the server re-checks each with the provider.
create or replace function public.payments_to_reconcile(p_min_age_seconds integer default 120, p_limit integer default 50)
returns table (kind text, provider text, provider_id text, refund_id uuid, order_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  (select 'charge', p.provider, p.provider_charge_id, null::uuid, p.order_id
   from public.payments p join public.orders o on o.id = p.order_id
   where p.status in ('initiated', 'authorized') and p.provider in ('tap', 'mock')
     and p.provider_charge_id is not null
     and p.created_at < now() - make_interval(secs => greatest(p_min_age_seconds, 0))
     and o.status in ('awaiting_payment', 'cancelled')
     and p.created_at > now() - interval '7 days'
   order by p.created_at
   limit greatest(1, least(p_limit, 200)))
  union all
  (select 'refund', p.provider, r.provider_refund_id, r.id, r.order_id
   from public.refund_requests r join public.payments p on p.id = r.payment_id
   where r.status = 'processing' and r.provider_refund_id is not null
     and r.approved_at < now() - make_interval(secs => greatest(p_min_age_seconds, 0))
   order by r.approved_at
   limit greatest(1, least(p_limit, 200)))
$$;
revoke all on function public.payments_to_reconcile(integer, integer) from public, anon, authenticated;
grant execute on function public.payments_to_reconcile(integer, integer) to service_role;

-- Customer-facing order view now includes refunds.
create or replace function public.get_order_for_customer(order_number bigint, token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'payment_method', o.payment_method,
    'customer_name', o.customer_name, 'phone', o.phone, 'email', o.email, 'locale', o.locale,
    'subtotal_fils', o.subtotal_fils, 'discount_fils', o.discount_fils, 'shipping_fils', o.shipping_fils,
    'total_fils', o.total_fils, 'refunded_fils', o.refunded_fils, 'shipping_address', o.shipping_address,
    'placed_at', o.placed_at, 'expires_at', o.expires_at, 'tracking_number', o.tracking_number,
    'courier', o.courier, 'estimated_delivery', o.estimated_delivery,
    'delivery_instructions', o.delivery_instructions, 'has_account', o.user_id is not null,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', jsonb_build_object('ar', i.name_ar, 'en', i.name_en),
                'label', jsonb_build_object('ar', i.variant_label_ar, 'en', i.variant_label_en),
                'quantity', i.quantity, 'unit_price_fils', i.unit_price_fils, 'line_total_fils', i.line_total_fils)
                order by i.name_en), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at)
                order by h.created_at), '[]'::jsonb)
              from public.order_status_history h where h.order_id = o.id),
    'payment_status', (select p.status from public.payments p where p.order_id = o.id
                       order by p.created_at desc limit 1)
  )
  from public.orders o
  where o.number = order_number and o.access_token = token
$$;
revoke all on function public.get_order_for_customer(bigint, uuid) from public;
grant execute on function public.get_order_for_customer(bigint, uuid) to anon, authenticated, service_role;

-- The server couldn't create the provider charge (provider down, network
-- error): no payment page was ever shown, so cancel the order now and
-- release its stock instead of holding it until expiry. Only orders whose
-- open payment has no provider charge attached qualify. Service role only.
create or replace function public.abandon_unstarted_payment(p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.payments p where p.order_id = p_order and p.provider_charge_id is not null) then
    return false;
  end if;
  update public.payments set status = 'cancelled', raw_status = 'NOT_STARTED'
  where order_id = p_order and status = 'initiated';
  update public.orders set status = 'cancelled' where id = p_order and status = 'awaiting_payment';
  return found;
end;
$$;
revoke all on function public.abandon_unstarted_payment(uuid) from public, anon, authenticated;
grant execute on function public.abandon_unstarted_payment(uuid) to service_role;
