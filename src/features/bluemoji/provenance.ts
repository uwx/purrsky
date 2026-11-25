/**
 * Provenance fields are self-asserted by the record's owner. These helpers only
 * decide how to interpret them: a source is a link only if it is a plain http(s)
 * URL, a licence links only to a canonical SPDX page, and a licence is
 * permission to copy only if this client can make sense of the expression.
 */

/** Only `http(s)` sources without credentials become links. */
export function getSafeSourceUrl(source: string | null | undefined) {
  const raw = source?.trim()
  if (!raw || /\s/.test(raw)) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (url.username || url.password) return undefined
    return url.href
  } catch {
    return undefined
  }
}

/**
 * SPDX identifiers link to their canonical page; `LicenseRef-*` and malformed
 * expressions are shown as plain text. Mirrors the AppView's own validation.
 */
export function getLicenseUrl(license: string | null | undefined) {
  const id = license?.trim()
  if (!id || !/^[A-Za-z0-9.-]+$/.test(id) || id.startsWith('LicenseRef-')) {
    return undefined
  }
  return `https://spdx.org/licenses/${id}.html`
}

/**
 * Licences we treat as permission to copy an emoji into another account.
 *
 * Deliberately conservative: unknown identifiers, `LicenseRef-…`, and a
 * missing licence all read as "no permission", since an absent licence is not
 * the same as public domain. `OR` only needs one usable operand, `AND` needs
 * all of them.
 *
 * Read by the pack copy flow and by the emoji editor, which shows the viewer
 * whether what they typed will actually let someone else take a copy.
 */
export function isCopyableLicense(license: string | null | undefined) {
  const expression = license?.trim()
  if (!expression) return false
  const tokens = expression.match(/\(|\)|[^\s()]+/g)
  if (!tokens) return false
  let index = 0
  const peek = () => tokens[index]
  const take = () => tokens[index++]
  const isId = (token: string) => {
    const id = token.toLowerCase()
    return Boolean(COPYABLE_LICENSES[id] || /^cc-by(-[a-z]{2})?-4\.0$/.test(id))
  }
  const parseOr = (): boolean => {
    let value = parseAnd()
    while (peek()?.toUpperCase() === 'OR') {
      take()
      const right = parseAnd()
      value = value || right
    }
    return value
  }
  const parseAnd = (): boolean => {
    let value = parseAtom()
    while (peek()?.toUpperCase() === 'AND') {
      take()
      const right = parseAtom()
      value = value && right
    }
    return value
  }
  const parseAtom = (): boolean => {
    const token = take()
    if (!token) throw new Error('Unexpected end of licence expression')
    if (token === '(') {
      const value = parseOr()
      if (take() !== ')') throw new Error('Unbalanced licence expression')
      return value
    }
    return isId(token)
  }
  try {
    // Anything left over is an operator we do not understand (`WITH`, a stray
    // close paren); an unparsed expression is not permission.
    const value = parseOr()
    return index === tokens.length && value
  } catch {
    return false
  }
}

const COPYABLE_LICENSES: Record<string, true> = {
  '0bsd': true,
  'apache-2.0': true,
  'bsd-2-clause': true,
  'bsd-3-clause': true,
  'cc-by-3.0': true,
  'cc-by-4.0': true,
  'cc0-1.0': true,
  isc: true,
  mit: true,
  unlicense: true,
}
