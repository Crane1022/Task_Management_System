import { describe, it, expect, vi } from 'vitest'
vi.mock('@/firebase/sdk', () => ({}))
vi.mock('@/firebase/config', () => ({ db: {}, app: {} }))
import { hintFor } from '@/services/pushService'

describe('what a Firebase refusal means', () => {
  it('explains the common ones in plain words', () => {
    expect(hintFor(['messaging/mismatched-credential: SenderId mismatch'])).toContain('different Firebase project')
    expect(hintFor(['messaging/internal-error: Firebase Cloud Messaging API has not been used in project 123 before or it is disabled'])).toContain('Cloud Messaging API')
    expect(hintFor(['messaging/third-party-auth-error: 403 insufficient'])).toContain('not allowed to send')
    expect(hintFor(['messaging/registration-token-not-registered: x'])).toContain('off, then on again')
    expect(hintFor(['something else'])).toBe('')
  })
})
