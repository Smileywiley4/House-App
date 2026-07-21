/**
 * Upload a profile photo to Supabase Storage (`avatars` bucket) and return the public URL.
 * Path: `{user_id}/avatar.{ext}` — RLS requires the first folder to match auth.uid().
 */
import { getSharedSupabase } from '@/lib/supabase';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * @param {File} file
 * @returns {string|null} User-facing error message, or null if valid.
 */
export function validateAvatarFile(file) {
  if (!file) return 'Please choose a photo.';
  const type = (file.type || '').toLowerCase();
  if (!AVATAR_ALLOWED_TYPES.has(type)) {
    return 'Please use a JPEG, PNG, or WebP image.';
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'That photo is too large. Please choose an image under 5 MB.';
  }
  return null;
}

/**
 * @param {string} userId
 * @param {File} file
 * @returns {Promise<string>} Public avatar URL
 */
export async function uploadAvatarFile(userId, file) {
  const validationError = validateAvatarFile(file);
  if (validationError) {
    const err = new Error(validationError);
    err.code = 'validation';
    throw err;
  }

  const supabase = getSharedSupabase();
  if (!supabase) {
    const err = new Error('Photo upload is not configured. Sign in again and try later.');
    err.code = 'config';
    throw err;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    const err = new Error('You need to be signed in to set a profile photo.');
    err.code = 'auth';
    throw err;
  }

  const uid = session.user.id;
  if (userId && userId !== uid) {
    const err = new Error('You can only upload a photo for your own account.');
    err.code = 'auth';
    throw err;
  }

  const mime = (file.type || 'image/jpeg').toLowerCase();
  const ext = EXT_BY_MIME[mime] || 'jpg';
  const path = `${uid}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: mime,
    cacheControl: '3600',
  });

  if (uploadError) {
    const msg = String(uploadError.message || uploadError.error || '').toLowerCase();
    if (msg.includes('permission') || msg.includes('policy') || msg.includes('denied') || uploadError.statusCode === '403') {
      const err = new Error(
        'Photo access was denied. Allow photos when your browser or device prompts you, then try again.'
      );
      err.code = 'permission';
      throw err;
    }
    if (msg.includes('size') || msg.includes('too large') || msg.includes('payload')) {
      const err = new Error('That photo is too large. Please choose an image under 5 MB.');
      err.code = 'size';
      throw err;
    }
    if (msg.includes('mime') || msg.includes('type')) {
      const err = new Error('Please use a JPEG, PNG, or WebP image.');
      err.code = 'type';
      throw err;
    }
    const err = new Error(uploadError.message || 'Could not upload photo. Try again.');
    err.code = 'upload';
    throw err;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    const err = new Error('Upload succeeded but the photo URL could not be created.');
    err.code = 'url';
    throw err;
  }

  // Bust CDN/browser cache after replace.
  const sep = publicUrl.includes('?') ? '&' : '?';
  return `${publicUrl}${sep}v=${Date.now()}`;
}
