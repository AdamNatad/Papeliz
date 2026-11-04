import { describe, expect, it } from 'vitest'
import { listPapelizTemplateCodeViewerLines } from './papeliz-template-gallery-code-viewer'

describe('the lines the code viewer numbers', () => {
  it('splits at each line end, a Windows one included, without the empty line after the last', () => {
    expect(listPapelizTemplateCodeViewerLines('#!/usr/bin/env bash\necho "planting"\n')).toEqual(['#!/usr/bin/env bash', 'echo "planting"'])
    expect(listPapelizTemplateCodeViewerLines('one\r\ntwo\r\n')).toEqual(['one', 'two'])
    expect(listPapelizTemplateCodeViewerLines('no line end')).toEqual(['no line end'])
  })

  it('keeps empty lines inside the file, a lone carriage return, and one line for an empty file', () => {
    expect(listPapelizTemplateCodeViewerLines('one\n\n\nfour\n\n')).toEqual(['one', '', '', 'four', ''])
    expect(listPapelizTemplateCodeViewerLines('one\rstill one\n')).toEqual(['one\rstill one'])
    expect(listPapelizTemplateCodeViewerLines('')).toEqual([''])
    expect(listPapelizTemplateCodeViewerLines('\n')).toEqual([''])
  })
})
