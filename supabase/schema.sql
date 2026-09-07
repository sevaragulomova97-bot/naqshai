-- ============================================================================
-- NaqshAI — Supabase sxemasi (profiles + rollar + status + audit log + naqshlar)
-- ----------------------------------------------------------------------------
-- ISHGA TUSHIRISH: Supabase loyihangizda  SQL Editor  ni oching va shu
-- faylni to'liq nusxalab "Run" bosing. Fayl idempotent — qayta ishga
-- tushirsa ham xato bermaydi.
--
-- MUHIM: parol xeshlari BU YERDA saqlanmaydi. Ularni Supabase o'zining
-- auth.users jadvalida bcrypt bilan boshqaradi (parolni biz hech qachon
-- ko'rmaymiz). Shuning uchun profiles jadvalida password_hash ustuni YO'Q.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ENUM turlar
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('user','researcher','teacher','admin','super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active','blocked','pending','deactivated');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) PROFILES — har bir auth.users yozuviga bitta profil
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  first_name     text,
  last_name      text,
  avatar         text,
  provider       text not null default 'email',      -- 'email' | 'google'
  role           public.user_role   not null default 'user',
  status         public.user_status not null default 'active',
  email_verified boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_login     timestamptz
);

create unique index if not exists profiles_email_key on public.profiles (lower(email));
create index if not exists profiles_role_idx   on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- 3) AUTH EVENTS — audit log
-- ---------------------------------------------------------------------------
create table if not exists public.auth_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  event      text not null,   -- registration | login | logout | failed_login |
                              -- google_login | password_reset | email_verification |
                              -- account_blocked | account_unblocked | role_changed
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists auth_events_user_idx    on public.auth_events (user_id, created_at desc);
create index if not exists auth_events_created_idx on public.auth_events (created_at desc);

-- ---------------------------------------------------------------------------
-- 4) PATTERNS — foydalanuvchi saqlagan naqshlar (ixtiyoriy, bulut sinxroni)
-- ---------------------------------------------------------------------------
create table if not exists public.patterns (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text,
  params     jsonb not null,
  thumb      text,
  created_at timestamptz not null default now()
);
create index if not exists patterns_user_idx on public.patterns (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) YORDAMCHI FUNKSIYALAR
--    SECURITY DEFINER + qat'iy search_path — RLS ichida rekursiyani oldini oladi
-- ---------------------------------------------------------------------------
create or replace function public.current_role_of()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_of() in ('admin','super_admin'), false) $$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role_of() = 'super_admin', false) $$;

create or replace function public.is_active()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select status from public.profiles where id = auth.uid()) = 'active', false) $$;

-- ---------------------------------------------------------------------------
-- 6) TRIGGER: yangi auth.users → profiles yozuvi avtomatik yaratiladi
--    (Google orqali kirganda ham shu ishlaydi — provider metadata'dan olinadi)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_provider text;
  v_first    text;
  v_last     text;
  v_full     text;
begin
  v_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_first    := new.raw_user_meta_data->>'first_name';
  v_last     := new.raw_user_meta_data->>'last_name';
  v_full     := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');

  -- Google faqat to'liq ism beradi — uni ism/familiyaga ajratamiz
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last  := nullif(trim(substr(v_full, length(split_part(v_full,' ',1)) + 1)), '');
  end if;

  insert into public.profiles (id, email, first_name, last_name, avatar, provider, email_verified)
  values (
    new.id,
    new.email,
    v_first,
    v_last,
    new.raw_user_meta_data->>'avatar_url',
    v_provider,
    new.email_confirmed_at is not null
  )
  -- ACCOUNT LINKING: email allaqachon mavjud bo'lsa yangi profil yaratmaymiz,
  -- mavjudini yangilaymiz (Supabase o'zi bir email = bitta auth.users kafolatlaydi)
  on conflict (id) do nothing;

  insert into public.auth_events (user_id, email, event, meta)
  values (new.id, new.email, 'registration', jsonb_build_object('provider', v_provider));

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- email tasdiqlanganda profiles.email_verified yangilanadi
create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and (old.email_confirmed_at is null) then
    update public.profiles set email_verified = true, updated_at = now() where id = new.id;
    insert into public.auth_events (user_id, email, event)
    values (new.id, new.email, 'email_verification');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- 7) TRIGGER: oddiy foydalanuvchi O'ZINING role/status ini o'zgartira olmaydi
--    (bu server tomonidagi himoya — frontendga ishonmaymiz)
-- ---------------------------------------------------------------------------
create or replace function public.protect_privileged_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role) or (new.status is distinct from old.status) then
    if not public.is_admin() then
      raise exception 'Ruxsat yo''q: role/status faqat administrator tomonidan o''zgartiriladi';
    end if;
    -- super_admin rolini faqat super_admin bera oladi
    if (new.role = 'super_admin' or old.role = 'super_admin') and not public.is_super_admin() then
      raise exception 'Ruxsat yo''q: super_admin rolini faqat super_admin boshqaradi';
    end if;
    if new.role is distinct from old.role then
      insert into public.auth_events (user_id, email, event, meta)
      values (new.id, new.email, 'role_changed',
              jsonb_build_object('from', old.role, 'to', new.role, 'by', auth.uid()));
    end if;
    if new.status is distinct from old.status then
      insert into public.auth_events (user_id, email, event, meta)
      values (new.id, new.email,
              case when new.status = 'blocked' then 'account_blocked' else 'account_unblocked' end,
              jsonb_build_object('from', old.status, 'to', new.status, 'by', auth.uid()));
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_columns();

-- ---------------------------------------------------------------------------
-- 8) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.auth_events enable row level security;
alter table public.patterns    enable row level security;

-- PROFILES ---------------------------------------------------------------
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

-- foydalanuvchi o'z profilini tahrirlaydi; role/status ni yuqoridagi trigger bloklaydi
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- AUTH EVENTS ------------------------------------------------------------
drop policy if exists events_select_own   on public.auth_events;
drop policy if exists events_select_admin on public.auth_events;
drop policy if exists events_insert_self  on public.auth_events;

create policy events_select_own on public.auth_events
  for select using (user_id = auth.uid());

create policy events_select_admin on public.auth_events
  for select using (public.is_admin());

create policy events_insert_self on public.auth_events
  for insert with check (user_id = auth.uid() or user_id is null);

-- PATTERNS ---------------------------------------------------------------
drop policy if exists patterns_all_own    on public.patterns;
drop policy if exists patterns_select_adm on public.patterns;

-- bloklangan foydalanuvchi o'z ma'lumotini ham o'zgartira olmaydi
create policy patterns_all_own on public.patterns
  for all using (user_id = auth.uid() and public.is_active())
  with check (user_id = auth.uid() and public.is_active());

create policy patterns_select_adm on public.patterns
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 9) ADMIN STATISTIKASI — bitta chaqiruvda barcha ko'rsatkichlar
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns json
language sql stable security definer set search_path = public
as $$
  select case when not public.is_admin() then null else json_build_object(
    'total',      (select count(*) from public.profiles),
    'active',     (select count(*) from public.profiles where status = 'active'),
    'blocked',    (select count(*) from public.profiles where status = 'blocked'),
    'today',      (select count(*) from public.profiles where created_at >= date_trunc('day', now())),
    'via_google', (select count(*) from public.profiles where provider = 'google'),
    'via_email',  (select count(*) from public.profiles where provider = 'email')
  ) end
$$;

-- oxirgi kirish vaqtini yangilash (login'dan keyin klient chaqiradi)
create or replace function public.touch_last_login()
returns void
language sql volatile security definer set search_path = public
as $$
  update public.profiles set last_login = now(), updated_at = now() where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 10) BIRINCHI SUPER ADMIN NI TAYINLASH
--     Ro'yxatdan o'tganingizdan keyin emailingizni yozib, shu qatorni bajaring:
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'super_admin' where lower(email) = lower('siz@pochta.uz');
