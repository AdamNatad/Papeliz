import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const papelizSiteEslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default papelizSiteEslintConfig
