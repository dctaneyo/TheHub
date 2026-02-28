import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signToken, verifyToken, getTokenExpiry } from './auth'
import type { AuthPayload } from './auth'

// Mock next/headers since cookies() is server-only
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
  })),
}))

const testPayload: AuthPayload = {
  id: 'loc-123',
  tenantId: 'kazi',
  userType: 'location',
  userId: '1001',
  name: 'Test Store',
  storeNumber: '001',
}

describe('Auth Utilities', () => {
  describe('signToken', () => {
    it('generates a valid JWT string', () => {
      const token = signToken(testPayload)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      // JWT has 3 parts separated by dots
      expect(token.split('.')).toHaveLength(3)
    })

    it('includes payload data in the token', () => {
      const token = signToken(testPayload)
      const decoded = verifyToken(token)
      expect(decoded).not.toBeNull()
      expect(decoded?.id).toBe('loc-123')
      expect(decoded?.userType).toBe('location')
      expect(decoded?.name).toBe('Test Store')
    })
  })

  describe('verifyToken', () => {
    it('returns payload for a valid token', () => {
      const token = signToken(testPayload)
      const result = verifyToken(token)
      expect(result).not.toBeNull()
      expect(result?.id).toBe(testPayload.id)
      expect(result?.userType).toBe(testPayload.userType)
      expect(result?.userId).toBe(testPayload.userId)
    })

    it('returns null for an invalid token', () => {
      const result = verifyToken('invalid.token.here')
      expect(result).toBeNull()
    })

    it('returns null for an empty string', () => {
      const result = verifyToken('')
      expect(result).toBeNull()
    })

    it('returns null for a tampered token', () => {
      const token = signToken(testPayload)
      const tampered = token.slice(0, -5) + 'XXXXX'
      const result = verifyToken(tampered)
      expect(result).toBeNull()
    })
  })

  describe('getTokenExpiry', () => {
    it('returns a valid ISO date string', () => {
      const expiry = getTokenExpiry()
      expect(() => new Date(expiry)).not.toThrow()
      expect(new Date(expiry).toISOString()).toBe(expiry)
    })

    it('returns a date approximately 24 hours in the future', () => {
      const expiry = getTokenExpiry()
      const expiryDate = new Date(expiry)
      const now = new Date()
      const diffHours = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      // Should be roughly 24 hours (allow a small window for test execution time)
      expect(diffHours).toBeGreaterThan(23.9)
      expect(diffHours).toBeLessThan(24.1)
    })
  })

  describe('signToken + verifyToken round-trip', () => {
    it('preserves ARL payload', () => {
      const arlPayload: AuthPayload = {
        id: 'arl-456',
        tenantId: 'kazi',
        userType: 'arl',
        userId: '2001',
        name: 'Test ARL',
        role: 'admin',
      }
      const token = signToken(arlPayload)
      const decoded = verifyToken(token)
      expect(decoded?.userType).toBe('arl')
      expect(decoded?.role).toBe('admin')
    })

    it('preserves optional fields', () => {
      const payload: AuthPayload = {
        id: 'loc-789',
        tenantId: 'kazi',
        userType: 'location',
        userId: '3001',
        name: 'Store With Session',
        sessionCode: 'ABC123',
        locationId: 'loc-789',
        storeNumber: '789',
      }
      const token = signToken(payload)
      const decoded = verifyToken(token)
      expect(decoded?.sessionCode).toBe('ABC123')
      expect(decoded?.locationId).toBe('loc-789')
      expect(decoded?.storeNumber).toBe('789')
    })
  })
})
