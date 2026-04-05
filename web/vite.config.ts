import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/pge": {
        target: "https://www.paragliding.earth",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pge/, "/api"),
        secure: true,
      },
      "/api/meteo": {
        target: "https://api.open-meteo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/meteo/, ""),
        secure: true,
      },
      "/api/geocode": {
        target: "https://geocoding-api.open-meteo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/geocode/, ""),
        secure: true,
      },
      "/api/spotair": {
        target: "https://data.spotair.mobi",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spotair/, ""),
        secure: true,
      },
    },
  },
})
