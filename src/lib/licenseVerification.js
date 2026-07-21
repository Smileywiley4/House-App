/** Honest realtor license verification helpers. */
export const STATE_LICENSE_LOOKUP_URLS = {
  AL: "https://verify.alabama.gov/",
  AK: "https://www.commerce.alaska.gov/web/cbpl/ProfessionalLicensing/RealEstateCommission.aspx",
  AZ: "https://azre.gov/licensee-search",
  AR: "https://www.arec.arkansas.gov/",
  CA: "https://www2.dre.ca.gov/PublicASP/pplinfo.asp",
  CO: "https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx",
  CT: "https://www.elicense.ct.gov/Lookup/LicenseLookup.aspx",
  DE: "https://delpros.delaware.gov/OH_VerifyLicense",
  FL: "https://www.myfloridalicense.com/wl11.asp",
  GA: "https://grec.state.ga.us/licensure/license-lookup/",
  HI: "https://pvl.ehawaii.gov/pvlsearch/",
  ID: "https://apps.dopl.idaho.gov/IDIBOnline/Lookups/LookupMain.aspx",
  IL: "https://www.idfpr.com/LicenseLookUp/LicenseLookup.asp",
  IN: "https://www.in.gov/pla/professionals/",
  IA: "https://licensedb.iowa.gov/",
  KS: "https://www.kansas.gov/ssrv-kscredb/",
  KY: "https://krec.ky.gov/",
  LA: "https://www.lrec.gov/",
  ME: "https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/SearchIndividual.aspx",
  MD: "https://www.dllr.state.md.us/cgi-bin/ElectronicLicensing/OP_Search/OP_search.cgi?calling_app=RE%3A%3ARE_Bus_Search",
  MA: "https://www.mass.gov/how-to/check-a-professional-license",
  MI: "https://aca-prod.accela.com/MILARA/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y&TabName=APO",
  MN: "https://secure.doli.state.mn.us/lookup/licensing.aspx",
  MS: "https://www.mrec.ms.gov/",
  MO: "https://pr.mo.gov/licensee-search.asp",
  MT: "https://boards.bsd.dli.mt.gov/board-of-realty-regulation",
  NE: "https://www.nebraska.gov/LISSearch/search.cgi",
  NV: "https://www.red.nv.gov/",
  NH: "https://forms.nh.gov/licenseverification/",
  NJ: "https://newjersey.mylicense.com/verification/",
  NM: "https://www.rld.nm.gov/boards-and-commissions/individual-boards-and-commissions/real-estate-commission/",
  NY: "https://www.dos.ny.gov/licensing/",
  NC: "https://www.ncrec.gov/Records/LicenseeSearch",
  ND: "https://www.ndrealestate.com/",
  OH: "https://elicense.ohio.gov/oh_verifylicense",
  OK: "https://www.ok.gov/oreclicensing/",
  OR: "https://orea.elicenseonline.com/",
  PA: "https://www.pals.pa.gov/",
  RI: "https://elicensing.ri.gov/Lookup/LicenseLookup.aspx",
  SC: "https://verify.llronline.com/LicLookup/LookupMain.aspx",
  SD: "https://dlr.sd.gov/realestate/",
  TN: "https://verify.tn.gov/",
  TX: "https://www.trec.texas.gov/apps/license-holder-search/",
  UT: "https://secure.utah.gov/llv/search/index.html",
  VT: "https://sos.vermont.gov/real-estate/",
  VA: "https://www.dpor.virginia.gov/LicenseLookup",
  WA: "https://fortress.wa.gov/dol/dolprod/bpdLicenseQuery/",
  WV: "https://www.wvrec.org/",
  WI: "https://licensesearch.wi.gov/",
  WY: "https://sites.google.com/a/wyo.gov/real/",
  DC: "https://www.asisvcs.com/services/licensing/dclicensing.asp",
};

export function normalizeLicenseState(state) {
  const s = String(state || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : (s.slice(0, 2) || '');
}
export function licenseLookupUrl(state) {
  return STATE_LICENSE_LOOKUP_URLS[normalizeLicenseState(state)] || null;
}
export function licenseVerificationStatus(profile) {
  const raw = (profile?.license_verification_status || 'self_reported').toLowerCase();
  return ['pending','verified','rejected'].includes(raw) ? raw : 'self_reported';
}
export function isLicenseVerified(profile) {
  return licenseVerificationStatus(profile) === 'verified';
}
export function licenseStatusLabel(status) {
  switch (status) {
    case 'verified': return 'License verified';
    case 'pending': return 'Verification pending';
    case 'rejected': return 'Could not verify';
    default: return 'Self-reported — not yet verified';
  }
}
export function licenseStatusTooltip(status) {
  switch (status) {
    case 'verified': return 'License verified';
    case 'pending': return 'Verification pending — awaiting review against the state license board';
    case 'rejected': return 'Could not verify this license against the state board';
    default: return 'License self-reported';
  }
}
export const US_STATE_OPTIONS = Object.keys(STATE_LICENSE_LOOKUP_URLS).sort();
