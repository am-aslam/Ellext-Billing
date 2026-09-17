create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'STAFF' check (role in ('ADMIN','STAFF')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED')),
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(), name text not null, legal_name text not null default '', gstin text, pan text,
  address text not null default '', city text not null default '', district text not null default '', state text not null default '',
  state_code text not null default '', pin text not null default '', phone text not null default '', email text not null default '',
  website text not null default '', logo_url text, seal_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('ADMIN','STAFF')),
  created_at timestamptz not null default now(), unique(business_id,user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  company_name text not null, contact_person text not null default '', email text not null default '', phone text not null default '', address text not null default '',
  city text not null default '', district text not null default '', state text not null default '', state_code text not null default '', pin text not null default '', gstin text, pan text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, description text not null default '', hsn_sac text not null default '', default_rate numeric(14,2) not null default 0 check (default_rate >= 0), gst_rate numeric(5,2) not null default 0 check (gst_rate >= 0 and gst_rate <= 100),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.invoice_sequences (
  business_id uuid primary key references public.businesses(id) on delete cascade, financial_year text not null, next_number bigint not null default 1
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_number text not null, customer_id uuid references public.customers(id) on delete restrict, invoice_date date not null, due_date date not null,
  place_of_supply text not null default '', subtotal numeric(14,2) not null default 0, discount_type text not null default 'FIXED', discount_value numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0, taxable_amount numeric(14,2) not null default 0, cgst numeric(14,2) not null default 0, sgst numeric(14,2) not null default 0, igst numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0, paid_amount numeric(14,2) not null default 0, balance_amount numeric(14,2) not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT','ISSUED','PENDING','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  notes text not null default '', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), issued_at timestamptz, cancelled_at timestamptz,
  unique(business_id,invoice_number), check (subtotal >= 0 and discount_amount >= 0 and taxable_amount >= 0 and total >= 0 and paid_amount >= 0 and balance_amount >= 0)
);
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade, service_id uuid references public.services(id) on delete set null,
  service_name text not null, description text not null default '', hsn_sac text not null default '', quantity numeric(14,3) not null check(quantity > 0), rate numeric(14,2) not null check(rate >= 0), amount numeric(14,2) not null check(amount >= 0), gst_rate numeric(5,2) not null default 0 check(gst_rate >= 0 and gst_rate <= 100), tax_type text not null default 'IGST', tax_amount numeric(14,2) not null default 0, is_manual_amount boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check(amount > 0), payment_date date not null, payment_method text not null check(payment_method in ('BANK_TRANSFER','UPI','CASH','CARD','OTHER')), transaction_reference text not null default '', notes text not null default '', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id) on delete cascade, data jsonb not null default '{}'::jsonb, updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, email text not null, status text not null check(status in ('PENDING','VERIFIED','EXPIRED','LOCKED')),
  code_hash text, expires_at timestamptz not null, attempt_count integer not null default 0 check(attempt_count between 0 and 5), max_attempts integer not null default 5, used_at timestamptz,
  created_at timestamptz not null default now(), last_sent_at timestamptz not null default now(), ip_address inet, user_agent text
);
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, session_token_hash text not null unique,
  expires_at timestamptz not null, created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), revoked_at timestamptz, ip_address inet, user_agent text
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, business_id uuid references public.businesses(id) on delete set null,
  action text not null, entity text, entity_id text, metadata jsonb not null default '{}'::jsonb, ip_address inet, created_at timestamptz not null default now()
);
create table if not exists public.backup_records (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, created_by uuid references auth.users(id) on delete set null, storage_path text not null, created_at timestamptz not null default now()
);

create index if not exists customers_business_status_idx on public.customers(business_id,status);
create index if not exists services_business_status_idx on public.services(business_id,status);
create index if not exists invoices_business_status_idx on public.invoices(business_id,status);
create index if not exists invoices_due_idx on public.invoices(business_id,due_date);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
