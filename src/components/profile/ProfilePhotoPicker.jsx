import { useRef, useState } from 'react';
import { Camera, User } from 'lucide-react';
import { api } from '@/api';
import { uploadAvatarFile, validateAvatarFile } from '@/lib/avatarUpload';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * Profile photo picker — uses a native file input (browser picker / OS photo permission on mobile).
 */
export default function ProfilePhotoPicker({
  userId,
  avatarUrl,
  fullName,
  onUpdated,
  size = 'lg',
  className = '',
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const displayUrl = previewUrl || avatarUrl || '';
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';
  const iconSize = size === 'sm' ? 22 : 26;

  const openPicker = () => {
    setError('');
    inputRef.current?.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    setError('');

    try {
      const url = await uploadAvatarFile(userId, file);
      const updated = await api.auth.updateMe({ avatar_url: url });
      onUpdated?.(updated?.avatar_url || url, updated);
    } catch (err) {
      console.error(err);
      setPreviewUrl(null);
      setError(err?.message || 'Could not update profile photo.');
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className={`relative ${dim} rounded-2xl overflow-hidden bg-[#106B49]/20 flex items-center justify-center shrink-0 ring-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#106B49] disabled:opacity-60`}
          aria-label={avatarUrl ? 'Change profile photo' : 'Add profile photo'}
        >
          <Avatar className={`${dim} rounded-2xl`}>
            {displayUrl ? <AvatarImage src={displayUrl} alt="" className="object-cover" /> : null}
            <AvatarFallback className="rounded-2xl bg-transparent">
              <User size={iconSize} className="text-[#106B49]" />
            </AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 hover:opacity-100 transition-opacity">
            <Camera size={18} className="text-white" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="text-sm font-semibold text-[#106B49] hover:underline disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : avatarUrl || previewUrl ? 'Change photo' : 'Add profile photo'}
          </button>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Propurty needs access to your photos only to set a profile picture you choose. We do not browse
            your library in the background — you&apos;ll be prompted when you tap Add/Change photo.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="sr-only"
        onChange={onFileChange}
        disabled={uploading}
      />

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {fullName ? <span className="sr-only">{fullName}</span> : null}
    </div>
  );
}
