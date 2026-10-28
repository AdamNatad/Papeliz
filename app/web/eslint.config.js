import papelizJavaScriptRules from '@eslint/js'
import papelizReactHooksPlugin from 'eslint-plugin-react-hooks'
import papelizGlobals from 'globals'
import papelizTypeScriptRules from 'typescript-eslint'

// Lint for the webapp: the recommended JavaScript and TypeScript rules, and the rules of React hooks.
export default papelizTypeScriptRules.config(
  { ignores: ['dist', 'node_modules'] },
  papelizJavaScriptRules.configs.recommended,
  ...papelizTypeScriptRules.configs.recommended,
  papelizReactHooksPlugin.configs.flat['recommended-latest'],
  {
    languageOptions: { globals: { ...papelizGlobals.browser } },
    rules: {
      // Unused names starting with an underscore are intentional (a destructured prop left out).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
