const PLACEHOLDER_PROJECT_ID = 'REPLACE_WITH_EAS_PROJECT_ID';

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const buildPlatform = process.env.EAS_BUILD_PLATFORM;

  if (buildProfile === 'production') {
    const missing = [];
    if (!projectId || projectId === PLACEHOLDER_PROJECT_ID) missing.push('EAS_PROJECT_ID');
    if (!appUrl) missing.push('EXPO_PUBLIC_APP_URL');
    if (!apiBaseUrl) missing.push('EXPO_PUBLIC_API_BASE_URL');
    if (buildPlatform === 'ios' && !process.env.EXPO_PUBLIC_RC_APPLE_API_KEY) {
      missing.push('EXPO_PUBLIC_RC_APPLE_API_KEY');
    }
    if (buildPlatform === 'android') {
      if (!process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY) missing.push('EXPO_PUBLIC_RC_GOOGLE_API_KEY');
      if (!androidMapsKey) missing.push('GOOGLE_MAPS_ANDROID_API_KEY');
    }
    if (missing.length > 0) {
      throw new Error(`Production mobile build is missing: ${missing.join(', ')}`);
    }
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId,
      },
    },
    android: {
      ...config.android,
      ...(androidMapsKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: { apiKey: androidMapsKey },
            },
          }
        : {}),
    },
  };
};
