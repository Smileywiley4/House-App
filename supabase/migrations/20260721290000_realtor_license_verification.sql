-- Realtor license verification (honest status machine).
alter table public.profiles
  add column if not exists license_number text,
  add column if not exists license_state text,
  add column if not exists brokerage_name text,
  add column if not exists license_verification_status text not null default 'self_reported',
  add column if not exists license_verified_at timestamptz,
  add column if not exists license_verification_notes text,
  add column if not exists license_verification_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_license_verification_status_check') then
    alter table public.profiles
      add constraint profiles_license_verification_status_check
      check (license_verification_status in ('self_reported','pending','verified','rejected'));
  end if;
end $$;

update public.profiles set
  license_number = coalesce(nullif(trim(license_number), ''), nullif(trim(realtor_license), '')),
  brokerage_name = coalesce(nullif(trim(brokerage_name), ''), nullif(trim(brokerage), '')),
  license_state = coalesce(nullif(trim(license_state), ''),
    case when length(trim(coalesce(state, ''))) = 2 then upper(trim(state)) else null end)
where true;

grant update (
  full_name, default_weights, realtor_license, brokerage, state, linked_realtor_id,
  phone, marketing_opt_in, avatar_url, license_number, license_state, brokerage_name
) on table public.profiles to authenticated;

create or replace function public.request_license_verification()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); row public.profiles;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into row from public.profiles where id = uid;
  if not found then raise exception 'Profile not found'; end if;
  if coalesce(nullif(trim(row.license_number), ''), nullif(trim(row.realtor_license), '')) is null then
    raise exception 'Enter a license number before requesting verification';
  end if;
  if coalesce(nullif(trim(row.license_state), ''), nullif(trim(row.state), '')) is null then
    raise exception 'Enter the license state before requesting verification';
  end if;
  update public.profiles set
    license_number = coalesce(nullif(trim(license_number), ''), nullif(trim(realtor_license), '')),
    realtor_license = coalesce(nullif(trim(license_number), ''), nullif(trim(realtor_license), '')),
    license_state = upper(left(coalesce(nullif(trim(license_state), ''), nullif(trim(state), '')), 2)),
    brokerage_name = coalesce(nullif(trim(brokerage_name), ''), nullif(trim(brokerage), '')),
    brokerage = coalesce(nullif(trim(brokerage_name), ''), nullif(trim(brokerage), '')),
    license_verification_status = 'pending',
    license_verified_at = null,
    license_verification_notes = null,
    license_verification_source = null,
    updated_at = now()
  where id = uid returning * into row;
  return row;
end; $$;

revoke all on function public.request_license_verification() from public;
grant execute on function public.request_license_verification() to authenticated;

create or replace function public.profiles_reset_license_verification_on_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> new.id then return new; end if;
  if (coalesce(new.license_number,'') is distinct from coalesce(old.license_number,'')
      or coalesce(new.license_state,'') is distinct from coalesce(old.license_state,'')
      or coalesce(new.realtor_license,'') is distinct from coalesce(old.realtor_license,'')) then
    if new.license_verification_status in ('verified','pending','rejected') then
      new.license_verification_status := 'self_reported';
      new.license_verified_at := null;
      new.license_verification_notes := null;
      new.license_verification_source := null;
    end if;
  end if;
  if new.license_number is distinct from old.license_number and new.license_number is not null then
    new.realtor_license := new.license_number;
  elsif new.realtor_license is distinct from old.realtor_license and new.realtor_license is not null then
    new.license_number := new.realtor_license;
  end if;
  if new.brokerage_name is distinct from old.brokerage_name and new.brokerage_name is not null then
    new.brokerage := new.brokerage_name;
  elsif new.brokerage is distinct from old.brokerage and new.brokerage is not null then
    new.brokerage_name := new.brokerage;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_reset_license_verification_on_edit on public.profiles;
create trigger profiles_reset_license_verification_on_edit
  before update on public.profiles for each row
  execute function public.profiles_reset_license_verification_on_edit();
