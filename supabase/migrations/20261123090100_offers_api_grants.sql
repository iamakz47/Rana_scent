-- Phase 7 (offers): explicit API grants for the new order tables.
--
-- Production grants nothing to the API roles by default, so every table the
-- app reads needs explicit grants. The offers migration already grants these;
-- this file restates them (idempotent) so CI can re-apply them after it
-- reproduces production's privileges, like the earlier phases' grant files.

revoke all on public.order_item_components from anon;
revoke insert, update, delete, truncate on public.order_item_components from authenticated;
grant select on public.order_item_components to authenticated;
grant all on public.order_item_components to service_role;

revoke all on public.order_item_component_fragrances from anon;
revoke insert, update, delete, truncate on public.order_item_component_fragrances from authenticated;
grant select on public.order_item_component_fragrances to authenticated;
grant all on public.order_item_component_fragrances to service_role;
