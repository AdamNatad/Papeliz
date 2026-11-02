import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildPapelizSitePageScriptPolicy,
  findPapelizSitePageScriptPolicyProblems,
  hashPapelizSitePageInlineScript,
  readPapelizSitePageInlineScriptTexts,
  writePapelizSitePageScriptPolicy,
} from './papeliz-site-page-script-policy.mjs'

const papelizSiteTestThemeScript = '(function () { document.documentElement.dataset.papelizTheme = "light" })()'
const papelizSiteTestPageHtml = [
  '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width"/>',
  `<script src="/_next/static/chunks/papeliz-site-test.js" async=""></script><script>${papelizSiteTestThemeScript}</script></head>`,
  '<body><main>Papeliz</main><script type="application/ld+json">{"@type":"WebSite"}</script>',
  '<script>self.__next_f.push([1,"papeliz"])</script></body></html>',
].join('')

function hashPapelizSiteTestScript(papelizSiteTestScriptText) {
  return `'sha256-${createHash('sha256').update(papelizSiteTestScriptText, 'utf8').digest('base64')}'`
}

describe('the website page script policy', () => {
  it('reads every runnable inline script and leaves script files and JSON-LD out', () => {
    expect(readPapelizSitePageInlineScriptTexts(papelizSiteTestPageHtml)).toEqual([papelizSiteTestThemeScript, 'self.__next_f.push([1,"papeliz"])'])
  })

  it('hashes a script as the browser does, with LF line endings', () => {
    expect(hashPapelizSitePageInlineScript('a\r\nb\rc')).toBe(hashPapelizSiteTestScript('a\nb\nc'))
  })

  it("allows only 'self' and the page's own inline scripts by hash", () => {
    expect(buildPapelizSitePageScriptPolicy(papelizSiteTestPageHtml)).toBe(
      `script-src 'self' ${hashPapelizSiteTestScript(papelizSiteTestThemeScript)} ${hashPapelizSiteTestScript('self.__next_f.push([1,"papeliz"])')}; object-src 'none'; base-uri 'none'`,
    )
  })

  it('writes the policy right after the character set, before every script, and once only', () => {
    const papelizSiteTestPageWithPolicy = writePapelizSitePageScriptPolicy(papelizSiteTestPageHtml)
    expect(papelizSiteTestPageWithPolicy).toMatch(/^<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"\/><meta http-equiv="Content-Security-Policy" content="script-src 'self' /)
    expect(writePapelizSitePageScriptPolicy(papelizSiteTestPageWithPolicy)).toBe(papelizSiteTestPageWithPolicy)
    expect(findPapelizSitePageScriptPolicyProblems(papelizSiteTestPageWithPolicy)).toEqual([])
  })

  it("adds a page's listed script sources and directives", () => {
    const papelizSiteTestExtraScriptPolicy = {
      papelizSitePageExtraScriptSources: ['https://challenges.cloudflare.com'],
      papelizSitePageExtraDirectives: ["worker-src 'self' blob:"],
    }
    const papelizSiteTestPageWithPolicy = writePapelizSitePageScriptPolicy(
      papelizSiteTestPageHtml.replace('</body>', '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body>'),
      papelizSiteTestExtraScriptPolicy,
    )
    expect(papelizSiteTestPageWithPolicy).toContain(" https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'none'")
    expect(findPapelizSitePageScriptPolicyProblems(papelizSiteTestPageWithPolicy, papelizSiteTestExtraScriptPolicy)).toEqual([])
  })

  it('finds an inline script changed or added after the policy was written', () => {
    const papelizSiteTestPageWithPolicy = writePapelizSitePageScriptPolicy(papelizSiteTestPageHtml)
    const papelizSiteTestPageChanged = papelizSiteTestPageWithPolicy.replace('"light"', '"dark"')
    expect(findPapelizSitePageScriptPolicyProblems(papelizSiteTestPageChanged)).toEqual([expect.stringMatching(/^has an inline script with no hash in its policy/)])
  })

  it('finds what no hash can allow, and script files from another site', () => {
    const papelizSiteTestPageWithPolicy = writePapelizSitePageScriptPolicy(
      papelizSiteTestPageHtml.replace(
        '<main>Papeliz</main>',
        '<main><button onclick="go()">Go</button><a href="javascript:go()">Go</a><script src="https://cdn.example.com/papeliz-test.js"></script></main>',
      ),
    )
    expect(findPapelizSitePageScriptPolicyProblems(papelizSiteTestPageWithPolicy)).toEqual([
      'loads a script file from another site, which its policy refuses: https://cdn.example.com/papeliz-test.js',
      'has an inline onclick handler, which no hash can allow',
      'has a javascript: link, which no hash can allow',
    ])
  })

  it('finds a page with no policy, or a script before it', () => {
    expect(findPapelizSitePageScriptPolicyProblems(papelizSiteTestPageHtml)).toEqual(['has 0 script policies in <meta>, not 1'])
    const papelizSiteTestPageWithPolicy = writePapelizSitePageScriptPolicy(papelizSiteTestPageHtml)
    const papelizSiteTestPageScriptFirst = papelizSiteTestPageWithPolicy.replace('<head>', `<head><script>${papelizSiteTestThemeScript}</script>`)
    expect(findPapelizSitePageScriptPolicyProblems(papelizSiteTestPageScriptFirst)).toContain('has a script before its <meta> policy, which the policy would not cover')
  })
})
