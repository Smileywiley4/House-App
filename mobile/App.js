import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';

/**
 * Property Pulse mobile shell — camera for in-person visit photos.
 * Wire EXPO_PUBLIC_API_BASE_URL to your FastAPI backend + Supabase auth to upload
 * to POST /api/library/saved-properties/{id}/photos (same as web).
 */
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const camRef = useRef(null);

  const takePicture = async () => {
    try {
      const photo = await camRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch (e) {
      Alert.alert('Camera', e?.message || 'Could not capture photo');
    }
  };

  const sharePhoto = async () => {
    if (!photoUri) return;
    const can = await Sharing.isAvailableAsync();
    if (!can) {
      Alert.alert('Sharing', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(photoUri, {
      mimeType: 'image/jpeg',
      dialogTitle: 'Share visit photo',
    });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Checking camera permission…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Property Pulse — Visits</Text>
        <Text style={styles.hint}>Camera access is needed for in-person property photos.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Visit camera</Text>
      <Text style={styles.sub}>
        Capture photos on site. Upload them from the web app under Visits, or extend this screen to call your API with a
        Supabase session.
      </Text>

      {!photoUri ? (
        <View style={styles.camWrap}>
          <CameraView ref={camRef} style={styles.camera} facing="back" />
          <TouchableOpacity style={styles.capture} onPress={takePicture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.preview}>
          <Image source={{ uri: photoUri }} style={styles.previewImg} resizeMode="cover" />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setPhotoUri(null)}>
              <Text style={styles.btnSecondaryText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={sharePhoto}>
              <Text style={styles.btnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a2234',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sub: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  hint: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  camWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
    minHeight: 360,
  },
  capture: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#10b981',
  },
  preview: {
    flex: 1,
  },
  previewImg: {
    flex: 1,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  btn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  btnSecondaryText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});
