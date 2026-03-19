"""Google Maps/Places API integration for verified property data."""
import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


def _api_key() -> str | None:
    return get_settings().google_places_api_key or None


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


async def find_nearby(lat: float, lng: float, place_type: str, radius: int = 5000) -> str | None:
    """Find nearest place of a given type and return its name + distance description."""
    key = _api_key()
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(NEARBY_URL, params={
                "location": f"{lat},{lng}",
                "radius": radius,
                "type": place_type,
                "key": key,
            })
            data = resp.json()
        results = data.get("results", [])
        if not results:
            return None
        nearest = results[0]
        name = nearest.get("name", "")
        n_loc = nearest.get("geometry", {}).get("location", {})
        if n_loc and lat and lng:
            dist_km = _haversine(lat, lng, n_loc.get("lat", 0), n_loc.get("lng", 0))
            dist_mi = dist_km * 0.621371
            return f"{name} ({dist_mi:.1f} mi)"
        return name
    except Exception as e:
        logger.error("Nearby search error (%s): %s", place_type, e)
        return None


def _haversine(lat1, lon1, lat2, lon2) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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
