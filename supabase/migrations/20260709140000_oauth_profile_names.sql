-- Google OAuth stores display name as "name" or "full_name" in user_metadata
create or replace function public.handle_new_user()
returns trigger as $$
declare
  opt_in boolean;
  display_name text;
begin
  opt_in := coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false);
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
