"""
Google Maps / Places integration for verified property data and **Google Auto-Score**.

Auto-score (`get_autoscore_data` → `/api/property/autoscore`) requires **one browser/server API key**:

- **Geocoding API** — `maps.googleapis.com/maps/api/geocode/json`
- **Places API (New)** — `places.googleapis.com/v1/places:searchNearby`

Enable both on the same Google Cloud project as `GOOGLE_PLACES_API_KEY`. Restrict the key to these APIs.
"""
import math
import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
# Places API (New) — https://developers.google.com/maps/documentation/places/web-service/nearby-search
PLACES_V1_SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_V1_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
DEFAULT_SEARCH_NEARBY_FIELD_MASK = (
    "places.displayName,places.formattedAddress,places.location,places.types,places.id"
)


def _api_key() -> str | None:
    return get_settings().google_places_api_key or None


def _prediction_kind(types: list | None, *, default: str = "property") -> str:
    """Classify Places autocomplete types as property vs place (city/zip/neighborhood)."""
    tset = {str(t).lower() for t in (types or [])}
    place_types = {
        "locality",
        "postal_code",
        "postal_town",
        "neighborhood",
        "sublocality",
        "sublocality_level_1",
        "administrative_area_level_1",
        "administrative_area_level_2",
        "administrative_area_level_3",
        "colloquial_area",
    }
    property_types = {"street_address", "premise", "subpremise", "route"}
    if tset & place_types and not (tset & property_types):
        return "place"
    if tset & property_types:
        return "property"
    return default


async def autocomplete_addresses(query: str) -> list[dict]:
    """Return US street-address and place predictions from Places API (New)."""
    key = _api_key()
    text = (query or "").strip()
    if not key or len(text) < 3:
        return []
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
    }

    async def _request(body: dict, *, kind_default: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(PLACES_V1_AUTOCOMPLETE_URL, json=body, headers=headers)
        if response.status_code >= 400:
            logger.warning("Places autocomplete failed: %s", response.text[:1000])
            return []
        suggestions = response.json().get("suggestions") or []
        predictions = []
        for suggestion in suggestions[:8]:
            prediction = suggestion.get("placePrediction") or {}
            structured = prediction.get("structuredFormat") or {}
            main_text = (structured.get("mainText") or {}).get("text")
            secondary_text = (structured.get("secondaryText") or {}).get("text")
            full_text = (prediction.get("text") or {}).get("text")
            if not full_text:
                continue
            types = prediction.get("types") or []
            predictions.append({
                "place_id": prediction.get("placeId"),
                "address": full_text,
                "main_text": main_text or full_text,
                "secondary_text": secondary_text or "",
                "kind": _prediction_kind(types, default=kind_default),
                "types": types,
            })
        return predictions

    # Street/building first; also fetch cities/ZIPs/neighborhoods for area browse.
    primary = {
        "input": text,
        "includedPrimaryTypes": ["street_address", "premise", "subpremise"],
        "regionCode": "US",
        "languageCode": "en",
    }
    places = {
        "input": text,
        "includedPrimaryTypes": [
            "locality",
            "postal_code",
            "neighborhood",
            "sublocality",
            "administrative_area_level_3",
        ],
        "regionCode": "US",
        "languageCode": "en",
    }
    try:
        street = await _request(primary, kind_default="property")
        place_hits = await _request(places, kind_default="place")
        if not street:
            street = await _request({
                "input": text,
                "includedPrimaryTypes": ["geocode"],
                "regionCode": "US",
                "languageCode": "en",
            }, kind_default="property")

        merged: list[dict] = []
        seen: set[str] = set()
        for item in [*street, *place_hits]:
            key_id = item.get("place_id") or item.get("address")
            if not key_id or key_id in seen:
                continue
            seen.add(key_id)
            merged.append(item)
            if len(merged) >= 8:
                break
        return merged
    except Exception as exc:
        logger.error("Places autocomplete error: %s", exc)
        return []


def _parse_address_components(components: list[dict]) -> dict:
    out = {}
    mapping = {
        "street_number": "street_number",
        "route": "route",
        "locality": "city",
        "administrative_area_level_1": "state",
        "postal_code": "zip",
    }
    for comp in components:
        for t in comp.get("types", []):
            if t in mapping:
                out[mapping[t]] = comp.get("short_name") if t == "administrative_area_level_1" else comp.get("long_name")
    street = " ".join(filter(None, [out.get("street_number"), out.get("route")]))
    if street:
        out["address"] = street
    return out


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def places_v1_search_nearby(
    body: dict,
    *,
    field_mask: str | None = None,
) -> tuple[dict | list | None, int, str | None]:
    """
    POST places.googleapis.com/v1/places:searchNearby (Places API New).

    Returns (parsed_json, http_status, error_message).
    error_message is set when status >= 400.
    """
    key = _api_key()
    if not key:
        return None, 503, "GOOGLE_PLACES_API_KEY is not configured"
    mask = (field_mask or "").strip() or DEFAULT_SEARCH_NEARBY_FIELD_MASK
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": mask,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(PLACES_V1_SEARCH_NEARBY_URL, json=body, headers=headers)
        if resp.content:
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text[:4000]}
        else:
            data = {}
        if resp.status_code >= 400:
            msg = None
            if isinstance(data, dict):
                msg = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else data.get("message")
            msg = msg or resp.text[:2000] or f"HTTP {resp.status_code}"
            logger.warning("Places searchNearby failed: %s", msg)
            return data, resp.status_code, msg
        return data, resp.status_code, None
    except Exception as e:
        logger.error("Places searchNearby error: %s", e)
        return None, 502, str(e)


async def geocode_address(address: str) -> dict | None:
    key = _api_key()
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(GEOCODE_URL, params={"address": address, "key": key})
            data = resp.json()
        if data.get("status") != "OK" or not data.get("results"):
            logger.warning("Geocode failed for '%s': %s", address, data.get("status"))
            return None
        result = data["results"][0]
        loc = result.get("geometry", {}).get("location", {})
        parsed = _parse_address_components(result.get("address_components", []))
        return {
            "formatted_address": result.get("formatted_address"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "place_id": result.get("place_id"),
            **parsed,
        }
    except Exception as e:
        logger.error("Geocode error: %s", e)
        return None


_NEW_PLACE_TYPES = {
    "grocery_or_supermarket": "supermarket",
}


async def _search_nearby_new(lat: float, lng: float, place_type: str, radius: int) -> list[dict]:
    mapped_type = _NEW_PLACE_TYPES.get(place_type, place_type)
    data, status, _ = await places_v1_search_nearby(
        {
            "includedTypes": [mapped_type],
            "maxResultCount": 20,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": float(radius),
                }
            },
        },
        field_mask="places.displayName,places.location",
    )
    if status >= 400 or not isinstance(data, dict):
        return []
    return data.get("places") or []


def _place_distance_km(lat: float, lng: float, place: dict) -> float:
    location = place.get("location") or {}
    return _haversine(
        lat,
        lng,
        float(location.get("latitude", 0)),
        float(location.get("longitude", 0)),
    )


async def find_nearby(lat: float, lng: float, place_type: str, radius: int = 5000) -> str | None:
    """Find nearest place of a given type and return its name + distance description."""
    try:
        results = await _search_nearby_new(lat, lng, place_type, radius)
        if not results:
            return None
        nearest = min(results, key=lambda place: _place_distance_km(lat, lng, place))
        display_name = nearest.get("displayName") or {}
        name = display_name.get("text") or "Nearby place"
        dist_mi = _place_distance_km(lat, lng, nearest) * 0.621371
        return f"{name} ({dist_mi:.1f} mi)"
    except Exception as e:
        logger.error("Nearby search error (%s): %s", place_type, e)
        return None


async def find_nearest_distance_mi(lat: float, lng: float, place_type: str, radius: int = 16000) -> float | None:
    """Return distance in miles to the nearest place of a given type, or None."""
    try:
        results = await _search_nearby_new(lat, lng, place_type, radius)
        if not results:
            return None
        nearest = min(results, key=lambda place: _place_distance_km(lat, lng, place))
        dist_km = _place_distance_km(lat, lng, nearest)
        return round(dist_km * 0.621371, 2)
    except Exception as e:
        logger.error("Nearest distance error (%s): %s", place_type, e)
        return None


async def count_nearby(lat: float, lng: float, place_type: str, radius: int = 3000) -> int:
    """Count the number of places of a given type within radius."""
    try:
        return len(await _search_nearby_new(lat, lng, place_type, radius))
    except Exception as e:
        logger.error("Count nearby error (%s): %s", place_type, e)
        return 0


async def get_property_via_google(address: str) -> dict | None:
    """
    Fetch verified property location data from Google APIs.
    Returns structured data with real coordinates, parsed address, and nearby amenities.
    """
    geo = await geocode_address(address)
    if not geo:
        return None

    lat, lng = geo.get("lat"), geo.get("lng")
    nearby_hospitals = None
    nearby_schools = None
    nearby_highways = None

    if lat and lng:
        nearby_hospitals = await find_nearby(lat, lng, "hospital", radius=10000)
        nearby_schools = await find_nearby(lat, lng, "school", radius=5000)

    return {
        "address": geo.get("address") or geo.get("formatted_address", ""),
        "city": geo.get("city", ""),
        "state": geo.get("state", ""),
        "zip": geo.get("zip", ""),
        "lat": lat,
        "lng": lng,
        "place_id": geo.get("place_id"),
        "formatted_address": geo.get("formatted_address"),
        "nearby_hospitals": nearby_hospitals,
        "nearby_schools": nearby_schools,
        "nearby_highways": nearby_highways,
    }


async def get_autoscore_data(address: str) -> dict | None:
    """
    Gather all distance/count data needed for deterministic auto-scoring.
    Returns raw distances (miles) and counts so scores can be computed without any AI.
    """
    geo = await geocode_address(address)
    if not geo:
        return None
    lat, lng = geo.get("lat"), geo.get("lng")
    if not lat or not lng:
        return None

    hospital_mi = await find_nearest_distance_mi(lat, lng, "hospital", radius=16000)
    school_mi = await find_nearest_distance_mi(lat, lng, "school", radius=8000)
    transit_mi = await find_nearest_distance_mi(lat, lng, "transit_station", radius=8000)
    grocery_mi = await find_nearest_distance_mi(lat, lng, "grocery_or_supermarket", radius=8000)
    park_mi = await find_nearest_distance_mi(lat, lng, "park", radius=5000)
    police_mi = await find_nearest_distance_mi(lat, lng, "police", radius=16000)
    fire_mi = await find_nearest_distance_mi(lat, lng, "fire_station", radius=16000)

    restaurants_count = await count_nearby(lat, lng, "restaurant", radius=1600)
    stores_count = await count_nearby(lat, lng, "store", radius=1600)

    return {
        "formatted_address": geo.get("formatted_address"),
        "lat": lat,
        "lng": lng,
        "hospital_mi": hospital_mi,
        "school_mi": school_mi,
        "transit_mi": transit_mi,
        "grocery_mi": grocery_mi,
        "park_mi": park_mi,
        "police_mi": police_mi,
        "fire_mi": fire_mi,
        "restaurants_count": restaurants_count,
        "stores_count": stores_count,
    }
