import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The Nitro Vercel preset is what makes this deploy to Vercel (PRD 5.2).
    // maxDuration lifts the serverless function ceiling so a gather run kicked
    // off with waitUntil (see src/server/runBackground.ts) has room to finish;
    // 800s is the Fluid Compute Pro cap, sized for the widest recency tier
    // (loopBudgetFor). Active-CPU billing pauses while the loop waits on I/O
    // (PRD 5.5); a run that ever outgrows one function moves to a Workflow.
    nitroV2Plugin({
      preset: 'vercel',
      compatibilityDate: '2026-07-09',
      vercel: { functions: { maxDuration: 800 } },
    }),
    tanstackStart(),
    viteReact(),
  ],
})
