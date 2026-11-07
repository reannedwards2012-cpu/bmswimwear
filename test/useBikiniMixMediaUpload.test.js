// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Video upload hang fix — composables/useBikiniMixMediaUpload.js performs
 * the actual browser-to-Supabase-Storage upload, directly, bypassing the
 * app's own server entirely. The property under test that matters most:
 * the timeout guarantee — the UI must never hang forever even if the
 * underlying network request itself stalls.
 */

let fakeUploadToSignedUrl

function stubGlobals() {
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { supabaseUrl: 'https://proj.supabase.co', supabaseKey: 'anon-key' } }))
  const fakeClient = { storage: { from: () => ({ uploadToSignedUrl: fakeUploadToSignedUrl }) } }
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => fakeClient) }))
}

let useBikiniMixMediaUpload

beforeEach(async () => {
  vi.useFakeTimers()
  fakeUploadToSignedUrl = vi.fn(async () => ({ data: { path: 'x.mp4' }, error: null }))
  stubGlobals()
  vi.resetModules()
  ;({ useBikiniMixMediaUpload } = await import('../composables/useBikiniMixMediaUpload.js'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.doUnmock('@supabase/supabase-js')
  vi.restoreAllMocks()
})

const FAKE_FILE = { type: 'video/mp4', name: 'promo.mp4' }

describe('useBikiniMixMediaUpload', () => {
  it('calls uploadToSignedUrl with the right bucket/path/token/contentType and resolves on success', async () => {
    const { uploadToSignedUrl } = useBikiniMixMediaUpload()
    await uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE, { contentType: 'video/mp4' })

    expect(fakeUploadToSignedUrl).toHaveBeenCalledWith('abc.mp4', 'tok-1', FAKE_FILE, { contentType: 'video/mp4' })
  })

  it('falls back to the file\'s own type when contentType is not explicitly passed', async () => {
    const { uploadToSignedUrl } = useBikiniMixMediaUpload()
    await uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE)

    expect(fakeUploadToSignedUrl).toHaveBeenCalledWith('abc.mp4', 'tok-1', FAKE_FILE, { contentType: 'video/mp4' })
  })

  it('throws when the Storage SDK reports an error', async () => {
    fakeUploadToSignedUrl.mockResolvedValue({ data: null, error: new Error('object too large') })
    const { uploadToSignedUrl } = useBikiniMixMediaUpload()

    await expect(uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE)).rejects.toThrow('object too large')
  })

  it('NEVER hangs forever — rejects with a clear timeout error once timeoutMs elapses, even if the underlying request never settles', async () => {
    fakeUploadToSignedUrl.mockImplementation(() => new Promise(() => {})) // never resolves — simulates exactly the old hang
    const { uploadToSignedUrl } = useBikiniMixMediaUpload()

    const promise = uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE, { timeoutMs: 1000 })
    const assertion = expect(promise).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('handles a realistically large file (40MB, not a trivial tiny test file) without any client-side size-related error', async () => {
    const largeFile = { type: 'video/mp4', name: 'promo.mp4', size: 40 * 1024 * 1024 }
    const { uploadToSignedUrl } = useBikiniMixMediaUpload()

    await uploadToSignedUrl('bikini-mix-media', 'big.mp4', 'tok-1', largeFile, { contentType: 'video/mp4' })

    expect(fakeUploadToSignedUrl).toHaveBeenCalledWith('big.mp4', 'tok-1', largeFile, { contentType: 'video/mp4' })
  })

  it('a slow-but-eventually-successful upload still resolves if it beats the timeout', async () => {
    fakeUploadToSignedUrl.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { path: 'abc.mp4' }, error: null }), 500))
    )
    const { uploadToSignedUrl } = useBikiniMixMediaUpload()

    const promise = uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE, { timeoutMs: 5000 })
    await vi.advanceTimersByTimeAsync(500)
    await expect(promise).resolves.toBeUndefined()
  })

  // Supabase's uploadToSignedUrl() has no AbortSignal/cancellation option at
  // all (confirmed directly against the installed SDK's FileOptions type —
  // only cacheControl/contentType/upsert/duplex exist), so the underlying
  // request genuinely cannot be cancelled when the timeout wins. These
  // prove the documented fallback instead: a late settlement is ALWAYS
  // safely handled, never an unhandled promise rejection.
  describe('late settlement after the timeout has already given up', () => {
    // These two run under REAL timers, not vi.useFakeTimers(). Vitest's fake
    // timers (vi.advanceTimersByTimeAsync) have their own internal
    // microtask-checkpoint timing that doesn't line up with exactly when a
    // handler attached via a plain `promise.then(...)` is considered
    // "handled" — reproduced directly against plain Node with the real
    // setTimeout/Promise implementation (no Vitest involved) and confirmed
    // zero unhandled rejections there, so this is a fake-timer artifact of
    // the test harness, not the application. Running these two under real
    // timers (small, real delays) proves the same behavior without
    // triggering that artifact.
    it('a late REJECTION is observed by a handler, not left dangling — proven by the handler actually firing', async () => {
      vi.useRealTimers()
      let rejectLate
      fakeUploadToSignedUrl.mockImplementation(() => new Promise((_, reject) => { rejectLate = reject }))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { uploadToSignedUrl } = useBikiniMixMediaUpload()
      const promise = uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE, { timeoutMs: 20 })
      await expect(promise).rejects.toThrow('timed out')

      rejectLate(new Error('connection reset'))
      await new Promise((resolve) => setTimeout(resolve, 10)) // let the late .then run

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('AFTER the timeout'), 'connection reset')
    })

    it('a late SUCCESS is observed (logged) rather than silently discarded, and never throws', async () => {
      vi.useRealTimers()
      let resolveLate
      fakeUploadToSignedUrl.mockImplementation(() => new Promise((resolve) => { resolveLate = resolve }))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { uploadToSignedUrl } = useBikiniMixMediaUpload()
      const promise = uploadToSignedUrl('bikini-mix-media', 'abc.mp4', 'tok-1', FAKE_FILE, { timeoutMs: 20 })
      await expect(promise).rejects.toThrow('timed out')

      resolveLate({ data: { path: 'abc.mp4' }, error: null })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('AFTER the timeout'))
    })
  })
})
