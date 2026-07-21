-- Profile avatars: public read bucket; users write only under their own folder.

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL of the user profile photo in the avatars storage bucket';

-- Allow authenticated clients to update their own avatar_url (billing fields stay locked).
grant update (
  full_name,
  default_weights,
  realtor_license,
  brokerage,
  state,
  linked_realtor_id,
  phone,
  marketing_opt_in,
  avatar_url
) on table public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- Public bucket: anyone can read avatar objects (profile photos are not private).
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users may upload only under `{user_id}/...`
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
