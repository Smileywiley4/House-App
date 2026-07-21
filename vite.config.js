import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

function normalizeAdsensePublisherId(value) {
  const raw = (value || '').trim()
  if (/^ca-pub-\d+$/.test(raw)) return raw
  if (/^\d+$/.test(raw)) return `ca-pub-${raw}`
  return ''
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const adsensePublisherId = normalizeAdsensePublisherId(
    env.VITE_GOOGLE_ADS_CLIENT_ID || env.VITE_ADSENSE_CLIENT || env.VITE_ADSENSE_CLIENT_ID
  )

  return {
    plugins: [
      react(),
      {
        name: 'adsense-site-verification',
        transformIndexHtml() {
          if (!adsensePublisherId) return []
          return [{
            tag: 'meta',
            attrs: {
              name: 'google-adsense-account',
              content: adsensePublisherId,
            },
            injectTo: 'head',
          }]
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
