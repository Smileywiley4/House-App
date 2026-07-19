import { useState, useEffect, useCallback } from 'react';
import { Platform, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';

/** Default region — US center until we have permission + a fix. */
const DEFAULT_CAMERA = {
  coordinates: { latitude: 39.8283, longitude: -98.5795 },
  zoom: 4,
};

function buildMarkers(coords, title) {
  const c = coords || DEFAULT_CAMERA.coordinates;
  return {
    apple: [{ id: 'property-pulse', coordinates: c, title }],
    google: [
      {
        id: 'property-pulse',
        coordinates: c,
        title,
        snippet: 'Your area',
      },
    ],
  };
}

/**
 * Native maps (expo-maps) + expo-location for permission and coordinates.
 * Apple Maps on iOS, Google Maps on Android. Not in Expo Go — use a dev build.
 */
export default function PropertyMap() {
  const [cameraPosition, setCameraPosition] = useState(DEFAULT_CAMERA);
  const [locationGranted, setLocationGranted] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const applyPosition = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setCameraPosition({
        coordinates: { latitude, longitude },
        zoom: 14,
      });
    } catch (e) {
      console.warn('[expo-location]', e);
      Alert.alert('Location', e?.message || 'Could not read your current position.');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      const granted = status === 'granted';
      setLocationGranted(granted);
      if (granted) {
        setLoadingLocation(true);
        try {
          await applyPosition();
        } finally {
          if (!cancelled) setLoadingLocation(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyPosition]);

  const requestLocationAccess = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationGranted(granted);
      if (!granted) {
        Alert.alert(
          'Location',
          'Permission was not granted. You can enable location for Property Pocket in system Settings.'
        );
        return;
      }
      await applyPosition();
    } finally {
      setLoadingLocation(false);
    }
  };

  const markers = buildMarkers(
    cameraPosition.coordinates,
    locationGranted ? 'Near you' : 'Property Pocket'
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Maps</Text>
        <Text style={styles.fallbackText}>
          expo-maps runs on iOS and Android native builds, not in the browser. Use a development build to preview maps.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Map</Text>
      {!locationGranted && (
        <TouchableOpacity
          style={styles.locBtn}
          onPress={requestLocationAccess}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator color="#10b981" />
          ) : (
            <Text style={styles.locBtnText}>Allow location to center the map on you</Text>
          )}
        </TouchableOpacity>
      )}
      {locationGranted && loadingLocation && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#10b981" size="small" />
          <Text style={styles.loadingText}>Getting your location…</Text>
        </View>
      )}
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.map}
          cameraPosition={cameraPosition}
          markers={markers.apple}
          properties={{
            isMyLocationEnabled: locationGranted,
            mapType: AppleMaps.MapType.STANDARD,
          }}
          uiSettings={{
            myLocationButtonEnabled: locationGranted,
            scaleBarEnabled: true,
          }}
        />
      ) : (
        <GoogleMaps.View
          style={styles.map}
          cameraPosition={cameraPosition}
          markers={markers.google}
          properties={{
            isMyLocationEnabled: locationGranted,
            mapType: GoogleMaps.MapType.NORMAL,
          }}
          uiSettings={{
            myLocationButtonEnabled: locationGranted,
            compassEnabled: true,
          }}
        />
      )}
      <Text style={styles.hint}>
        Location uses expo-location (foreground only). Add your Google Maps SDK API key under android.config.googleMaps
        in app.json for release Android builds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  map: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locBtn: {
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  locBtnText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  hint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  fallback: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginTop: 16,
  },
  fallbackTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 6,
  },
  fallbackText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
});
