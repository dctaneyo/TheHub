import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  parsePermissions,
  hasPermission,
  VIEW_PERMISSIONS,
  type PermissionKey,
} from './permissions'

describe('Permissions', () => {
  describe('PERMISSIONS constant', () => {
    it('contains all expected permission keys', () => {
      expect(PERMISSIONS.TASKS_CREATE).toBe('tasks.create')
      expect(PERMISSIONS.TASKS_DELETE).toBe('tasks.delete')
      expect(PERMISSIONS.TASKS_EDIT).toBe('tasks.edit')
      expect(PERMISSIONS.LOCATIONS_CREATE).toBe('locations.create')
      expect(PERMISSIONS.EMERGENCY_ACCESS).toBe('emergency.access')
    })

    it('ALL_PERMISSIONS contains every value from PERMISSIONS', () => {
      const values = Object.values(PERMISSIONS)
      expect(ALL_PERMISSIONS).toHaveLength(values.length)
      for (const v of values) {
        expect(ALL_PERMISSIONS).toContain(v)
      }
    })
  })

  describe('PERMISSION_GROUPS', () => {
    it('covers all permissions', () => {
      const groupedKeys = PERMISSION_GROUPS.flatMap((g) =>
        g.permissions.map((p) => p.key)
      )
      for (const perm of ALL_PERMISSIONS) {
        expect(groupedKeys).toContain(perm)
      }
    })

    it('has no duplicate permission keys across groups', () => {
      const allKeys = PERMISSION_GROUPS.flatMap((g) =>
        g.permissions.map((p) => p.key)
      )
      const unique = new Set(allKeys)
      expect(unique.size).toBe(allKeys.length)
    })

    it('each group has a label and description', () => {
      for (const group of PERMISSION_GROUPS) {
        expect(group.label).toBeTruthy()
        expect(group.description).toBeTruthy()
        expect(group.permissions.length).toBeGreaterThan(0)
      }
    })
  })

  describe('parsePermissions', () => {
    it('returns null for null input (admin / default)', () => {
      expect(parsePermissions(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(parsePermissions(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parsePermissions('')).toBeNull()
    })

    it('parses a valid JSON array of permissions', () => {
      const perms = ['tasks.create', 'tasks.edit']
      const result = parsePermissions(JSON.stringify(perms))
      expect(result).toEqual(perms)
    })

    it('returns null for invalid JSON', () => {
      expect(parsePermissions('not-json')).toBeNull()
    })

    it('returns null for JSON that is not an array', () => {
      expect(parsePermissions('{"key": "value"}')).toBeNull()
    })
  })

  describe('hasPermission', () => {
    it('admins always have all permissions', () => {
      expect(hasPermission('admin', [], PERMISSIONS.TASKS_CREATE)).toBe(true)
      expect(hasPermission('admin', null, PERMISSIONS.EMERGENCY_ACCESS)).toBe(true)
    })

    it('null permissions means all granted (new ARL default)', () => {
      expect(hasPermission('manager', null, PERMISSIONS.TASKS_CREATE)).toBe(true)
      expect(hasPermission('arl', null, PERMISSIONS.EMERGENCY_ACCESS)).toBe(true)
    })

    it('returns true when permission is in the array', () => {
      const perms: PermissionKey[] = [PERMISSIONS.TASKS_CREATE, PERMISSIONS.TASKS_EDIT]
      expect(hasPermission('manager', perms, PERMISSIONS.TASKS_CREATE)).toBe(true)
    })

    it('returns false when permission is not in the array', () => {
      const perms: PermissionKey[] = [PERMISSIONS.TASKS_CREATE]
      expect(hasPermission('manager', perms, PERMISSIONS.TASKS_DELETE)).toBe(false)
    })

    it('returns false for an empty permissions array (all revoked)', () => {
      expect(hasPermission('manager', [], PERMISSIONS.TASKS_CREATE)).toBe(false)
    })
  })

  describe('VIEW_PERMISSIONS', () => {
    it('maps expected views to permissions', () => {
      expect(VIEW_PERMISSIONS['emergency']).toBe(PERMISSIONS.EMERGENCY_ACCESS)
      expect(VIEW_PERMISSIONS['data-management']).toBe(PERMISSIONS.DATA_MANAGEMENT_ACCESS)
      expect(VIEW_PERMISSIONS['analytics']).toBe(PERMISSIONS.ANALYTICS_ACCESS)
    })

    it('does not include always-visible views', () => {
      expect(VIEW_PERMISSIONS['overview']).toBeUndefined()
      expect(VIEW_PERMISSIONS['messages']).toBeUndefined()
      expect(VIEW_PERMISSIONS['calendar']).toBeUndefined()
      expect(VIEW_PERMISSIONS['leaderboard']).toBeUndefined()
    })
  })
})
