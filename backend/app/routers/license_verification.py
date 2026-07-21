"""Realtor license verification: request + admin fulfill."""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from app.dependencies import get_current_user_id, get_supabase_admin, require_platform_admin
from app.routers.auth import _profile_to_user

router = APIRouter(tags=["license-verification"])
STATE_LICENSE_LOOKUP_URLS: dict[str, str] = {
    "AL": "https://verify.alabama.gov/",
    "AK": "https://www.commerce.alaska.gov/web/cbpl/ProfessionalLicensing/RealEstateCommission.aspx",
    "AZ": "https://azre.gov/licensee-search",
    "AR": "https://www.arec.arkansas.gov/",
    "CA": "https://www2.dre.ca.gov/PublicASP/pplinfo.asp",
    "CO": "https://apps.colorado.gov/dora/licensing/Lookup/LicenseLookup.aspx",
    "CT": "https://www.elicense.ct.gov/Lookup/LicenseLookup.aspx",
    "DE": "https://delpros.delaware.gov/OH_VerifyLicense",
    "FL": "https://www.myfloridalicense.com/wl11.asp",
    "GA": "https://grec.state.ga.us/licensure/license-lookup/",
    "HI": "https://pvl.ehawaii.gov/pvlsearch/",
    "ID": "https://apps.dopl.idaho.gov/IDIBOnline/Lookups/LookupMain.aspx",
    "IL": "https://www.idfpr.com/LicenseLookUp/LicenseLookup.asp",
    "IN": "https://www.in.gov/pla/professionals/",
    "IA": "https://licensedb.iowa.gov/",
    "KS": "https://www.kansas.gov/ssrv-kscredb/",
    "KY": "https://krec.ky.gov/",
    "LA": "https://www.lrec.gov/",
    "ME": "https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/SearchIndividual.aspx",
    "MD": "https://www.dllr.state.md.us/cgi-bin/ElectronicLicensing/OP_Search/OP_search.cgi?calling_app=RE%3A%3ARE_Bus_Search",
    "MA": "https://www.mass.gov/how-to/check-a-professional-license",
    "MI": "https://aca-prod.accela.com/MILARA/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y&TabName=APO",
    "MN": "https://secure.doli.state.mn.us/lookup/licensing.aspx",
    "MS": "https://www.mrec.ms.gov/",
    "MO": "https://pr.mo.gov/licensee-search.asp",
    "MT": "https://boards.bsd.dli.mt.gov/board-of-realty-regulation",
    "NE": "https://www.nebraska.gov/LISSearch/search.cgi",
    "NV": "https://www.red.nv.gov/",
    "NH": "https://forms.nh.gov/licenseverification/",
    "NJ": "https://newjersey.mylicense.com/verification/",
    "NM": "https://www.rld.nm.gov/boards-and-commissions/individual-boards-and-commissions/real-estate-commission/",
    "NY": "https://www.dos.ny.gov/licensing/",
    "NC": "https://www.ncrec.gov/Records/LicenseeSearch",
    "ND": "https://www.ndrealestate.com/",
    "OH": "https://elicense.ohio.gov/oh_verifylicense",
    "OK": "https://www.ok.gov/oreclicensing/",
    "OR": "https://orea.elicenseonline.com/",
    "PA": "https://www.pals.pa.gov/",
    "RI": "https://elicensing.ri.gov/Lookup/LicenseLookup.aspx",
    "SC": "https://verify.llronline.com/LicLookup/LookupMain.aspx",
    "SD": "https://dlr.sd.gov/realestate/",
    "TN": "https://verify.tn.gov/",
    "TX": "https://www.trec.texas.gov/apps/license-holder-search/",
    "UT": "https://secure.utah.gov/llv/search/index.html",
    "VT": "https://sos.vermont.gov/real-estate/",
    "VA": "https://www.dpor.virginia.gov/LicenseLookup",
    "WA": "https://fortress.wa.gov/dol/dolprod/bpdLicenseQuery/",
    "WV": "https://www.wvrec.org/",
    "WI": "https://licensesearch.wi.gov/",
    "WY": "https://sites.google.com/a/wyo.gov/real/",
    "DC": "https://www.asisvcs.com/services/licensing/dclicensing.asp",
}

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _norm_state(raw: str | None) -> str:
    s = (raw or "").strip().upper()
    return s[:2] if s else ""

def _license_fields_from_row(row: dict) -> tuple[str, str, str]:
    number = (row.get("license_number") or row.get("realtor_license") or "").strip()
    state = _norm_state(row.get("license_state") or row.get("state"))
    brokerage = (row.get("brokerage_name") or row.get("brokerage") or "").strip()
    return number, state, brokerage

class RequestLicenseVerificationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    license_number: str | None = Field(default=None, max_length=100)
    license_state: str | None = Field(default=None, max_length=2)
    brokerage_name: str | None = Field(default=None, max_length=200)
    realtor_license: str | None = Field(default=None, max_length=100)
    brokerage: str | None = Field(default=None, max_length=200)
    state: str | None = Field(default=None, max_length=100)

class AdminLicenseDecisionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str = Field(...)
    notes: str | None = Field(default=None, max_length=2000)

@router.post("/auth/me/license/request-verification")
async def request_license_verification(body: RequestLicenseVerificationBody | None = None, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    row = r.data[0] if r.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    payload = (body or RequestLicenseVerificationBody()).model_dump(exclude_unset=True)
    number = ((payload.get("license_number") or payload.get("realtor_license") or "").strip()
              or (row.get("license_number") or row.get("realtor_license") or "").strip())
    state = _norm_state(payload.get("license_state") or payload.get("state") or row.get("license_state") or row.get("state"))
    brokerage = ((payload.get("brokerage_name") or payload.get("brokerage") or "").strip()
                 or (row.get("brokerage_name") or row.get("brokerage") or "").strip())
    if not number:
        raise HTTPException(status_code=400, detail="Enter a license number before requesting verification")
    if not state or len(state) != 2:
        raise HTTPException(status_code=400, detail="Enter a 2-letter license state (e.g. TX)")
    updates = {
        "license_number": number, "realtor_license": number, "license_state": state,
        "license_verification_status": "pending", "license_verified_at": None,
        "license_verification_notes": None, "license_verification_source": None,
    }
    if brokerage:
        updates["brokerage_name"] = brokerage
        updates["brokerage"] = brokerage
    supabase.table("profiles").update(updates).eq("id", user_id).execute()
    r2 = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    out = r2.data[0] if r2.data else {**row, **updates}
    return {**_profile_to_user(out), "lookup_url": STATE_LICENSE_LOOKUP_URLS.get(state),
            "message": "Verification requested. Status is pending until an admin confirms against the state board."}

@router.get("/admin/license-verification/pending")
async def list_pending_license_verifications(_admin_id: str = Depends(require_platform_admin)):
    supabase = get_supabase_admin()
    r = (supabase.table("profiles")
         .select("id, full_name, email, license_number, realtor_license, license_state, brokerage_name, brokerage, license_verification_status, plan, role")
         .eq("license_verification_status", "pending").order("full_name").limit(200).execute())
    items = []
    for row in r.data or []:
        number, state, brokerage = _license_fields_from_row(row)
        items.append({"id": str(row["id"]), "full_name": row.get("full_name"), "email": row.get("email"),
                      "license_number": number, "license_state": state, "brokerage_name": brokerage,
                      "plan": row.get("plan") or "free", "lookup_url": STATE_LICENSE_LOOKUP_URLS.get(state)})
    return {"items": items, "count": len(items)}

@router.patch("/admin/license-verification/{target_user_id}")
async def admin_set_license_verification(target_user_id: str, body: AdminLicenseDecisionBody, admin_id: str = Depends(require_platform_admin)):
    status = (body.status or "").strip().lower()
    if status not in {"verified", "rejected"}:
        raise HTTPException(status_code=400, detail="status must be verified or rejected")
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("*").eq("id", target_user_id).limit(1).execute()
    row = r.data[0] if r.data else None
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    number, state, _b = _license_fields_from_row(row)
    if status == "verified" and (not number or not state):
        raise HTTPException(status_code=400, detail="Cannot verify: missing license_number or license_state")
    updates = {"license_verification_status": status, "license_verification_notes": (body.notes or "").strip() or None,
               "license_verification_source": "manual_admin",
               "license_verified_at": _now_iso() if status == "verified" else None}
    supabase.table("profiles").update(updates).eq("id", target_user_id).execute()
    r2 = supabase.table("profiles").select("*").eq("id", target_user_id).limit(1).execute()
    out = r2.data[0] if r2.data else {**row, **updates}
    return {"ok": True, "decided_by": admin_id, "lookup_url": STATE_LICENSE_LOOKUP_URLS.get(state), "user": _profile_to_user(out)}

@router.get("/license/lookup-url/{state_code}")
async def get_license_lookup_url(state_code: str):
    code = _norm_state(state_code)
    url = STATE_LICENSE_LOOKUP_URLS.get(code)
    if not url:
        raise HTTPException(status_code=404, detail="No lookup URL mapped for that state")
    return {"state": code, "url": url}
