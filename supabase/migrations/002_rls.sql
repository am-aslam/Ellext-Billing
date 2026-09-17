create or replace function public.is_business_member(target_business uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.business_members where business_id = target_business and user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.business_settings enable row level security;
alter table public.auth_challenges enable row level security;
alter table public.sessions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.backup_records enable row level security;

create policy profiles_self on public.profiles for select using (id = auth.uid());
create policy businesses_member on public.businesses for select using (exists(select 1 from public.business_members m where m.business_id=id and m.user_id=auth.uid()));
create policy members_self_business on public.business_members for select using (user_id=auth.uid());
create policy customers_member on public.customers for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy services_member on public.services for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy invoices_member on public.invoices for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy invoice_items_member on public.invoice_items for all using (exists(select 1 from public.invoices i where i.id=invoice_id and public.is_business_member(i.business_id))) with check (exists(select 1 from public.invoices i where i.id=invoice_id and public.is_business_member(i.business_id)));
create policy payments_member on public.payments for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy settings_member on public.business_settings for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy audit_member on public.audit_logs for select using (business_id is null and user_id=auth.uid() or public.is_business_member(business_id));
create policy backups_admin on public.backup_records for select using (public.is_business_member(business_id) and exists(select 1 from public.business_members m join public.profiles p on p.id=m.user_id where m.business_id=business_id and m.user_id=auth.uid() and p.role='ADMIN'));

revoke all on public.auth_challenges, public.sessions from anon, authenticated;
revoke all on public.audit_logs, public.backup_records from anon;
