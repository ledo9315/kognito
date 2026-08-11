import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // Pinned on purpose: eslint-plugin-react 7.37 crashes during automatic
    // version detection under ESLint 10. Drop this once the plugin catches up.
    settings: { react: { version: '19.0' } },
  },
]

export default config
