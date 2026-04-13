import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const DEFAULT_COUNSELING_API_BASE =
  'https://gdxi2b3eqa.execute-api.ap-southeast-2.amazonaws.com/dev'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_')
  let counselingProxyTarget = 'https://gdxi2b3eqa.execute-api.ap-southeast-2.amazonaws.com'
  let counselingPathPrefix = '/dev'
  try {
    const base = (env.VITE_COUNSELING_API_BASE || DEFAULT_COUNSELING_API_BASE).replace(/\/$/, '')
    const parsed = new URL(base)
    counselingProxyTarget = `${parsed.protocol}//${parsed.host}`
    const stagePath = parsed.pathname.replace(/\/$/, '') || ''
    counselingPathPrefix = stagePath && stagePath !== '/' ? stagePath : '/dev'
  } catch {
    /* keep defaults */
  }

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // Same-origin in dev → avoids browser CORS until API Gateway sends CORS headers.
        '/__counseling': {
          target: counselingProxyTarget,
          changeOrigin: true,
          rewrite: (proxyPath) => proxyPath.replace(/^\/__counseling/, counselingPathPrefix),
        },
        '/__social-score': {
          target: counselingProxyTarget,
          changeOrigin: true,
          rewrite: (proxyPath) => proxyPath.replace(/^\/__social-score/, counselingPathPrefix),
        },
      },
    },
  }
})
