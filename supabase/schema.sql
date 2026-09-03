-- =====================================================
-- Yanky's HVAC CRM — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- =====================================================

-- 1. Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'technician' check (role in ('admin', 'office_manager', 'technician')),
  technician_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'technician')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  customer_type text default 'residential' check (customer_type in ('residential', 'commercial')),
  tags text[],
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Equipment
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  equipment_type text default 'ac',
  make text,
  model text,
  serial_number text,
  install_date date,
  warranty_end date,
  notes text,
  created_at timestamptz default now()
);

-- 4. Technicians
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  name text not null,
  team text default 'repair' check (team in ('install', 'repair')),
  email text,
  phone text,
  hourly_rate numeric(10,2),
  skills text,
  certifications text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  job_type text default 'repair' check (job_type in ('install', 'repair', 'maintenance', 'emergency', 'inspection')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text default 'scheduled' check (status in ('scheduled', 'en_route', 'in_progress', 'completed', 'invoiced', 'cancelled')),
  scheduled_date date,
  scheduled_time time,
  estimated_duration integer default 60,
  actual_duration integer,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_number bigint,
  status text default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(10,2) default 0,
  tax numeric(10,2) default 0,
  total numeric(10,2) default 0,
  due_date date,
  paid_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Invoice Items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  description text,
  quantity integer default 1,
  rate numeric(10,2) default 0,
  amount numeric(10,2) generated always as (quantity * rate) stored,
  created_at timestamptz default now()
);

-- 8. Service Agreements
create table if not exists public.service_agreements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  plan_type text default 'seasonal_tuneup',
  start_date date,
  end_date date,
  visits_total integer default 2,
  visits_used integer default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.equipment enable row level security;
alter table public.technicians enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.service_agreements enable row level security;

-- Helper: get current user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Profiles: users can read all profiles, update own
drop policy if exists "profiles_select" on public.profiles;`ncreate policy "profiles_select" on public.profiles for select using (true);
drop policy if exists "profiles_update" on public.profiles;`ncreate policy "profiles_update" on public.profiles for update using (id = auth.uid());

-- Customers: all authenticated can read, managers+ can write
drop policy if exists "customers_select" on public.customers;`ncreate policy "customers_select" on public.customers for select using (auth.uid() is not null);
drop policy if exists "customers_insert" on public.customers;`ncreate policy "customers_insert" on public.customers for insert with check (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "customers_update" on public.customers;`ncreate policy "customers_update" on public.customers for update using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "customers_delete" on public.customers;`ncreate policy "customers_delete" on public.customers for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- Equipment: all authenticated can read, managers+ can write
drop policy if exists "equipment_select" on public.equipment;`ncreate policy "equipment_select" on public.equipment for select using (auth.uid() is not null);
drop policy if exists "equipment_insert" on public.equipment;`ncreate policy "equipment_insert" on public.equipment for insert with check (auth.uid() is not null);
drop policy if exists "equipment_update" on public.equipment;`ncreate policy "equipment_update" on public.equipment for update using (auth.uid() is not null);
drop policy if exists "equipment_delete" on public.equipment;`ncreate policy "equipment_delete" on public.equipment for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- Technicians: all authenticated can read, managers+ can write
drop policy if exists "technicians_select" on public.technicians;`ncreate policy "technicians_select" on public.technicians for select using (auth.uid() is not null);
drop policy if exists "technicians_insert" on public.technicians;`ncreate policy "technicians_insert" on public.technicians for insert with check (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "technicians_update" on public.technicians;`ncreate policy "technicians_update" on public.technicians for update using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "technicians_delete" on public.technicians;`ncreate policy "technicians_delete" on public.technicians for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- Jobs: techs see own, managers see all
drop policy if exists "jobs_select" on public.jobs;`ncreate policy "jobs_select" on public.jobs for select using (
  public.get_user_role() in ('admin', 'office_manager')
  or technician_id in (select id from public.technicians where user_id = auth.uid())
);
drop policy if exists "jobs_insert" on public.jobs;`ncreate policy "jobs_insert" on public.jobs for insert with check (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "jobs_update" on public.jobs;`ncreate policy "jobs_update" on public.jobs for update using (
  public.get_user_role() in ('admin', 'office_manager')
  or technician_id in (select id from public.technicians where user_id = auth.uid())
);
drop policy if exists "jobs_delete" on public.jobs;`ncreate policy "jobs_delete" on public.jobs for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- Invoices: managers+ only
drop policy if exists "invoices_select" on public.invoices;`ncreate policy "invoices_select" on public.invoices for select using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "invoices_insert" on public.invoices;`ncreate policy "invoices_insert" on public.invoices for insert with check (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "invoices_update" on public.invoices;`ncreate policy "invoices_update" on public.invoices for update using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "invoices_delete" on public.invoices;`ncreate policy "invoices_delete" on public.invoices for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- Invoice Items: managers+ only
drop policy if exists "invoice_items_select" on public.invoice_items;`ncreate policy "invoice_items_select" on public.invoice_items for select using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "invoice_items_insert" on public.invoice_items;`ncreate policy "invoice_items_insert" on public.invoice_items for insert with check (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "invoice_items_update" on public.invoice_items;`ncreate policy "invoice_items_update" on public.invoice_items for update using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "invoice_items_delete" on public.invoice_items;`ncreate policy "invoice_items_delete" on public.invoice_items for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- Service Agreements: all authenticated can read, managers+ can write
drop policy if exists "agreements_select" on public.service_agreements;`ncreate policy "agreements_select" on public.service_agreements for select using (auth.uid() is not null);
drop policy if exists "agreements_insert" on public.service_agreements;`ncreate policy "agreements_insert" on public.service_agreements for insert with check (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "agreements_update" on public.service_agreements;`ncreate policy "agreements_update" on public.service_agreements for update using (public.get_user_role() in ('admin', 'office_manager'));
drop policy if exists "agreements_delete" on public.service_agreements;`ncreate policy "agreements_delete" on public.service_agreements for delete using (public.get_user_role() in ('admin', 'office_manager'));

-- =====================================================
-- Indexes for performance
-- =====================================================
create index if not exists idx_jobs_customer on public.jobs(customer_id);
create index if not exists idx_jobs_technician on public.jobs(technician_id);
create index if not exists idx_jobs_date on public.jobs(scheduled_date);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_invoices_customer on public.invoices(customer_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_equipment_customer on public.equipment(customer_id);
create index if not exists idx_agreements_customer on public.service_agreements(customer_id);

-- Pricebook for reusable services and parts
CREATE TABLE IF NOT EXISTS public.pricebook (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL,
    item_name text NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Proposals (Estimates)
CREATE TABLE IF NOT EXISTS public.proposals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    proposal_number bigserial,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    subtotal numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposal_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity integer DEFAULT 1,
    rate numeric(10,2) DEFAULT 0
);

-- Add to RLS policies
ALTER TABLE public.pricebook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all on pricebook" ON public.pricebook;
CREATE POLICY "Enable read access for all on pricebook"
ON public.pricebook FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for office_manager and admin" ON public.pricebook;
CREATE POLICY "Enable insert for office_manager and admin"
ON public.pricebook FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('office_manager', 'admin'))
);

DROP POLICY IF EXISTS "Enable update for office_manager and admin" ON public.pricebook;
CREATE POLICY "Enable update for office_manager and admin"
ON public.pricebook FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('office_manager', 'admin'))
);

DROP POLICY IF EXISTS "Enable delete for admin" ON public.pricebook;
CREATE POLICY "Enable delete for admin"
ON public.pricebook FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.proposals;
CREATE POLICY "Enable all access for all authenticated users"
ON public.proposals FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.proposal_items;
CREATE POLICY "Enable all access for all authenticated users"
ON public.proposal_items FOR ALL USING (auth.role() = 'authenticated');
