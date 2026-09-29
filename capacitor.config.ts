import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'sk.skai.skola',
  appName: 'AI škola',
  webDir: 'dist',
  android: {
    // Apka nič neposiela na sieť – localhost je v Android WebView povolený,
    // ale nechávame ho prázdny, aby sa nič neprebúdzalo do siete.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config

