/**
 * Browser geolocation helpers for “Use current location” search.
 */

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60_000,
};

/**
 * @returns {Promise<{ lat: number, lng: number, accuracy?: number }>}
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Location is only available in the browser."));
      return;
    }
    if (!window.isSecureContext) {
      reject(
        new Error(
          "Location requires HTTPS (or localhost). Open the site on a secure connection and try again."
        )
      );
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location services."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos?.coords?.latitude);
        const lng = Number(pos?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          reject(new Error("Could not read your location. Try again."));
          return;
        }
        resolve({
          lat,
          lng,
          accuracy: Number(pos?.coords?.accuracy),
        });
      },
      (err) => {
        const code = err?.code;
        if (code === 1) {
          reject(
            new Error(
              "Location permission denied. Allow location access in your browser settings to search nearby."
            )
          );
          return;
        }
        if (code === 2) {
          reject(new Error("Location unavailable. Check GPS or network and try again."));
          return;
        }
        if (code === 3) {
          reject(new Error("Location request timed out. Try again."));
          return;
        }
        reject(new Error(err?.message || "Could not get your location."));
      },
      { ...DEFAULT_OPTIONS, ...options }
    );
  });
}
