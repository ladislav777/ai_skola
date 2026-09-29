import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// AI škola beží úplne lokálne – žiadny API kľúč, žiadna sieť, žiadny proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
})
