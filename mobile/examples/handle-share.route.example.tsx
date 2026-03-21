/**
 * Example Expo Router screen for `/handle-share` when using `utils/redirectSystemPath.js`.
 * Copy to `app/handle-share.tsx` after adding expo-router.
 *
 * import { getSharedPayloads } from 'expo-sharing'; // optional; useIncomingShare is usually easier
 */
import { View, Text, ScrollView } from 'react-native';
import { useIncomingShare } from 'expo-sharing';

export default function HandleShareScreen() {
  const { sharedPayloads, resolvedSharedPayloads, isResolving, error, clearSharedPayloads } =
    useIncomingShare();

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Shared content</Text>
      {isResolving ? <Text>Resolving…</Text> : null}
      {error ? <Text>{error.message}</Text> : null}
      <Text selectable>{JSON.stringify({ sharedPayloads, resolvedSharedPayloads }, null, 2)}</Text>
      <Text onPress={clearSharedPayloads} style={{ marginTop: 16, color: 'blue' }}>
        Clear
      </Text>
    </ScrollView>
  );
}
