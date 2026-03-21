import { Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { AppleMaps, GoogleMaps, useLocationPermissions } from 'expo-maps';

/** Default region — wire to your property search / geocode API later. */
const DEFAULT_CAMERA = {
  coordinates: { latitude: 39.8283, longitude: -98.5795 },
  zoom: 4,
};

const MARKERS_APPLE = [
  {
    id: 'property-pulse',
    coordinates: DEFAULT_CAMERA.coordinates,
    title: 'Property Pulse',
  },
];

const MARKERS_GOOGLE = [
  {
    id: 'property-pulse',
    coordinates: DEFAULT_CAMERA.coordinates,
    title: 'Property Pulse',
    snippet: 'Explore homes in this area',
  },
];

/**
 * Native maps (expo-maps): Apple Maps on iOS, Google Maps on Android.
 * Not available in Expo Go — use a dev build. iOS 18+ for Apple Maps features.
 */
export default function PropertyMap() {
  const [locationPermission, requestLocationPermission] = useLocationPermissions();
  const showUserLocation = locationPermission?.granted === true;

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
      {!showUserLocation && (
        <TouchableOpacity style={styles.locBtn} onPress={requestLocationPermission}>
          <Text style={styles.locBtnText}>Enable location to show where you are on the map</Text>
        </TouchableOpacity>
      )}
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.map}
          cameraPosition={DEFAULT_CAMERA}
          markers={MARKERS_APPLE}
          properties={{
            isMyLocationEnabled: showUserLocation,
            mapType: AppleMaps.MapType.STANDARD,
          }}
          uiSettings={{
            myLocationButtonEnabled: showUserLocation,
            scaleBarEnabled: true,
          }}
        />
      ) : (
        <GoogleMaps.View
          style={styles.map}
          cameraPosition={DEFAULT_CAMERA}
          markers={MARKERS_GOOGLE}
          properties={{
            isMyLocationEnabled: showUserLocation,
            mapType: GoogleMaps.MapType.NORMAL,
          }}
          uiSettings={{
            myLocationButtonEnabled: showUserLocation,
            compassEnabled: true,
          }}
        />
      )}
      <Text style={styles.hint}>
        Add your Google Maps SDK API key under android.config.googleMaps in app.json for release Android builds.
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
  },
  locBtnText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
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
