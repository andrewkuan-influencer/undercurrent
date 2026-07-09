import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The Nitro Vercel preset is what makes this deploy to Vercel (PRD 5.2).
    nitroV2Plugin({ preset: 'vercel', compatibilityDate: '2026-07-09' }),
    tanstackStart(),
    viteReact(),
  ],
})
