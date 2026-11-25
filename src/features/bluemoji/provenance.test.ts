import {getLicenseUrl, getSafeSourceUrl, isCopyableLicense} from './provenance'

describe('copy permission', () => {
  it('treats a missing licence as no permission', () => {
    expect(isCopyableLicense(undefined)).toBe(false)
    expect(isCopyableLicense(null)).toBe(false)
    expect(isCopyableLicense('')).toBe(false)
    expect(isCopyableLicense('  ')).toBe(false)
  })

  it('accepts permissive licences case-insensitively', () => {
    expect(isCopyableLicense('CC0-1.0')).toBe(true)
    expect(isCopyableLicense('cc-by-4.0')).toBe(true)
    expect(isCopyableLicense('MIT')).toBe(true)
    expect(isCopyableLicense('GPL-3.0-only')).toBe(false)
    expect(isCopyableLicense('LicenseRef-All-Rights-Reserved')).toBe(false)
  })

  it('applies OR and AND as written', () => {
    expect(isCopyableLicense('CC-BY-4.0 OR LicenseRef-Commercial')).toBe(true)
    expect(isCopyableLicense('MIT OR GPL-3.0-only')).toBe(true)
    expect(isCopyableLicense('MIT AND CC-BY-4.0')).toBe(true)
    expect(isCopyableLicense('MIT AND GPL-3.0-only')).toBe(false)
    expect(isCopyableLicense('(MIT OR CC0-1.0) AND GPL-3.0-only')).toBe(false)
    expect(isCopyableLicense('Apache-2.0 AND (MIT OR CC0-1.0)')).toBe(true)
  })

  it('reads a malformed expression as no permission', () => {
    expect(isCopyableLicense('MIT,')).toBe(false)
    expect(isCopyableLicense('(MIT')).toBe(false)
    expect(isCopyableLicense('MIT WITH classpath-exception-2.0')).toBe(false)
  })
})

describe('licence links', () => {
  it('links canonical identifiers only', () => {
    expect(getLicenseUrl('MIT')).toBe('https://spdx.org/licenses/MIT.html')
    expect(getLicenseUrl('CC-BY-4.0')).toBe(
      'https://spdx.org/licenses/CC-BY-4.0.html',
    )
    expect(getLicenseUrl('LicenseRef-Custom')).toBeUndefined()
    expect(getLicenseUrl('MIT OR CC0-1.0')).toBeUndefined()
    expect(getLicenseUrl(undefined)).toBeUndefined()
  })
})

describe('source links', () => {
  it('links plain http(s) URLs only', () => {
    expect(getSafeSourceUrl('https://example.com/art')).toBe(
      'https://example.com/art',
    )
    expect(getSafeSourceUrl('javascript:alert(1)')).toBeUndefined()
    expect(getSafeSourceUrl('https://user:pw@example.com/')).toBeUndefined()
    expect(getSafeSourceUrl('not a url')).toBeUndefined()
  })
})
