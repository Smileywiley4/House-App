import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useIncomingShare } from 'expo-sharing';

/**
 * Shows shared images from other apps (Share → Property Pulse) and lets the user load them into the visit flow.
 * Only mount on native — `useIncomingShare` is not supported on web.
 */
export default function IncomingShareBanner({ onUseSharedImage }) {
  const { resolvedSharedPayloads, clearSharedPayloads, isResolving, error } = useIncomingShare();

  const firstImageUri = useMemo(() => {
    const img = resolvedSharedPayloads.find(
      (p) => p.contentType === 'image' && p.contentUri
    );
    return img?.contentUri ?? null;
  }, [resolvedSharedPayloads]);

  if (!firstImageUri && !isResolving && !error) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Shared with Property Pulse</Text>
      {error ? <Text style={styles.err}>{error?.message ?? String(error)}</Text> : null}
      {isResolving ? <ActivityIndicator color="#10b981" style={styles.spinner} /> : null}
      {firstImageUri ? (
        <>
          <Image source={{ uri: firstImageUri }} style={styles.thumb} contentFit="cover" />
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                onUseSharedImage(firstImageUri);
                clearSharedPayloads();
              }}
            >
              <Text style={styles.primaryText}>Use as visit photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => clearSharedPayloads()}>
              <Text style={styles.secondaryText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Renders nothing on web (incoming share is native-only). */
export function IncomingShareBannerGate(props) {
  if (Platform.OS === 'web') return null;
  return <IncomingShareBanner {...props} />;
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 8,
  },
  err: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 8,
  },
  spinner: { marginVertical: 8 },
  thumb: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primary: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  secondaryText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
});
