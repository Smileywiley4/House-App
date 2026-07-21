import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isLicenseVerified, licenseStatusLabel, licenseStatusTooltip, licenseVerificationStatus } from '@/lib/licenseVerification';

export default function LicenseVerifiedEmblem({ profile, status: statusProp, size = 16, className = '', showSelfReported = false, inlineLabel = false }) {
  const status = statusProp || licenseVerificationStatus(profile);
  const verified = status === 'verified' || (profile && isLicenseVerified(profile));
  if (verified) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-0.5 shrink-0 text-[#106B49] ${className}`} aria-label="License verified">
              <BadgeCheck size={size} className="text-[#106B49] fill-[#106B49]/15" strokeWidth={2} aria-hidden />
              {inlineLabel && <span className="text-[10px] font-semibold text-[#0C4F37] uppercase tracking-wide">Verified</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-[#14192E] text-white border-0">{licenseStatusTooltip('verified')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (!showSelfReported) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 ${className}`}>
            {status === 'pending' ? 'Pending' : status === 'rejected' ? 'Unverified' : 'Self-reported'}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-[#14192E] text-white border-0 max-w-xs">{licenseStatusTooltip(status)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LicenseStatusBanner({ profile, className = '' }) {
  const status = licenseVerificationStatus(profile);
  const styles = {
    verified: 'bg-[#106B49]/10 border-[#106B49]/25 text-[#0C4F37]',
    pending: 'bg-amber-50 border-amber-200 text-amber-800',
    rejected: 'bg-slate-50 border-slate-200 text-slate-600',
    self_reported: 'bg-slate-50 border-slate-200 text-slate-600',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${styles[status] || styles.self_reported} ${className}`} role="status">
      <span className="font-semibold">{licenseStatusLabel(status)}</span>
      {status === 'verified' && profile?.license_verified_at && (
        <span className="opacity-80"> · {new Date(profile.license_verified_at).toLocaleDateString()}</span>
      )}
      {status !== 'verified' && (
        <span className="block mt-0.5 opacity-90">
          A green verified check appears only after Propurty confirms your license against the state board
          (manual review for MVP). Typing a license number alone is never shown as verified.
        </span>
      )}
    </div>
  );
}
