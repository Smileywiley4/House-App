-- Marketing opt-in fields on profiles + trigger reads signup metadata

alter table public.profiles
  add column if not exists phone text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists marketing_sheet_synced_at timestamptz;

comment on column public.profiles.phone is 'Optional phone from signup or profile update';
comment on column public.profiles.marketing_opt_in is 'User opted in to product updates and promotions';
comment on column public.profiles.marketing_opt_in_at is 'When marketing opt-in was recorded';
comment on column public.profiles.marketing_sheet_synced_at is 'When profile was appended to Google Sheets CRM';

create or replace function public.handle_new_user()
returns trigger as $$
declare
  opt_in boolean;
begin
  opt_in := coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false);

  insert into public.profiles (id, email, full_name, phone, marketing_opt_in, marketing_opt_in_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    opt_in,
    case when opt_in then now() else null end
  );
  return new;
end;
$$ language plpgsql security definer;
