import { describe, it, expect } from 'vitest'
import { apiSuccess, apiError, ApiErrors } from './api-response'

describe('API Response Helpers', () => {
  describe('apiSuccess', () => {
    it('returns 200 status by default', () => {
      const res = apiSuccess({ foo: 'bar' })
      expect(res.status).toBe(200)
    })

    it('wraps data in a success envelope', async () => {
      const res = apiSuccess({ items: [1, 2, 3] })
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.items).toEqual([1, 2, 3])
    })

    it('accepts a custom status code', () => {
      const res = apiSuccess({ created: true }, 201)
      expect(res.status).toBe(201)
    })

    it('returns valid JSON content-type', () => {
      const res = apiSuccess({})
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('apiError', () => {
    it('returns the specified status code', () => {
      const res = apiError('NOT_FOUND', 'Not found', 404)
      expect(res.status).toBe(404)
    })

    it('wraps error in a structured envelope', async () => {
      const res = apiError('INTERNAL', 'Something broke', 500)
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.error.code).toBe('INTERNAL')
      expect(json.error.message).toBe('Something broke')
    })

    it('defaults to 400 status', () => {
      const res = apiError('BAD_REQUEST', 'Invalid input')
      expect(res.status).toBe(400)
    })
  })

  describe('ApiErrors shortcuts', () => {
    it('unauthorized returns 401', () => {
      const res = ApiErrors.unauthorized()
      expect(res.status).toBe(401)
    })

    it('forbidden returns 403', () => {
      const res = ApiErrors.forbidden()
      expect(res.status).toBe(403)
    })

    it('notFound returns 404', () => {
      const res = ApiErrors.notFound()
      expect(res.status).toBe(404)
    })

    it('badRequest returns 400', () => {
      const res = ApiErrors.badRequest('Missing field')
      expect(res.status).toBe(400)
    })

    it('tooManyRequests returns 429 with Retry-After header', () => {
      const res = ApiErrors.tooManyRequests(60)
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('internal returns 500', () => {
      const res = ApiErrors.internal()
      expect(res.status).toBe(500)
    })

    it('forbidden accepts custom message', async () => {
      const res = ApiErrors.forbidden('No access to this resource')
      const json = await res.json()
      expect(json.error.message).toBe('No access to this resource')
    })

    it('notFound accepts custom entity name', async () => {
      const res = ApiErrors.notFound('Task')
      const json = await res.json()
      expect(json.error.message).toBe('Task not found')
    })
  })
})
