-- US-style signup: new accounts default to marketing emails on until the user opts out
-- (Profile → Settings) or deletes their account. Existing rows are not backfilled.

alter table public.profiles
  alter column marketing_opt_in set default true;

comment on column public.profiles.marketing_opt_in is
  'Marketing / product-update emails. Default true for new signups; user may opt out in Profile → Settings.';

create or replace function public.handle_new_user()
returns trigger as $$
declare
  opt_in boolean;
  display_name text;
begin
  -- Prefer explicit metadata; otherwise default ON (signup Terms consent).
  opt_in := coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, true);
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(
      concat(
        coalesce(new.raw_user_meta_data->>'given_name', ''),
        ' ',
        coalesce(new.raw_user_meta_data->>'family_name', '')
      )
    ), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, phone, marketing_opt_in, marketing_opt_in_at)
  values (
    new.id,
    new.email,
    display_name,
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    opt_in,
    case when opt_in then now() else null end
  );
  return new;
end;
$$ language plpgsql security definer;
