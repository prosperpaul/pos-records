import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Maskable and Apple icons are padded; fill the padding with the icon's green, not white.
const green = { background: '#0f3d2e' }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: green },
    apple: { ...minimal2023Preset.apple, resizeOptions: green },
  },
  images: ['public/icon.svg'],
})
