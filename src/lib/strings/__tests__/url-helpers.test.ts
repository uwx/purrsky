import {parseLinkableUrl} from '../url-helpers'

describe('parseLinkableUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=1#c',
    'https://sub.example.co.uk/path',
    'https://witchsky.app',
  ])('accepts a genuine host: %s', input => {
    expect(parseLinkableUrl(input)).toBeInstanceOf(URL)
  })

  it.each([
    // scheme only, no host at all
    'https://',
    // degenerate host made of dots
    'https://...',
    'https://..../path',
    // trailing dot in the host
    'https://example.com.',
    // hosts without a dot
    'https://localhost:8080/x',
    // other schemes
    'at://did:plc:abc/app.bsky.feed.post/1',
    'mailto:hello@example.com',
    'javascript:alert(1)',
    // not a URL
    'example',
    '',
  ])('rejects %s', input => {
    expect(parseLinkableUrl(input)).toBeNull()
  })
})
