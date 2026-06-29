import { describe, it, expect } from 'vitest'
import { startOfWeekMonday, taskAppliesToDate, type TaskRecurrenceFields } from './task-utils'

function task(overrides: Partial<TaskRecurrenceFields> = {}): TaskRecurrenceFields {
  return {
    isRecurring: false,
    recurringType: null,
    recurringDays: null,
    dueDate: null,
    createdAt: null,
    biweeklyStart: null,
    isHidden: false,
    showInToday: true,
    ...overrides,
  }
}

describe('startOfWeekMonday', () => {
  it('returns the same date for a Monday', () => {
    const mon = new Date('2026-06-22T15:00:00') // a Monday
    const result = startOfWeekMonday(mon)
    expect(result.getDate()).toBe(22)
    expect(result.getHours()).toBe(0)
  })

  it('rolls forward a Sunday to the previous Monday', () => {
    const sun = new Date('2026-06-28T10:00:00') // a Sunday
    const result = startOfWeekMonday(sun)
    expect(result.getDate()).toBe(22) // the Monday of that same week
  })

  it('rolls a midweek date back to that week\'s Monday', () => {
    const wed = new Date('2026-06-24T10:00:00')
    const result = startOfWeekMonday(wed)
    expect(result.getDate()).toBe(22)
  })

  it('zeroes out the time component', () => {
    const result = startOfWeekMonday(new Date('2026-06-24T23:59:59'))
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})

describe('taskAppliesToDate — visibility gating', () => {
  it('excludes a hidden task when checkVisibility is true (default)', () => {
    const t = task({ isHidden: true, dueDate: '2026-06-28' })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(false)
  })

  it('excludes a task with showInToday === false', () => {
    const t = task({ showInToday: false, dueDate: '2026-06-28' })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(false)
  })

  it('includes a hidden task when checkVisibility is false (e.g. upcoming-tasks view)', () => {
    const t = task({ isHidden: true, dueDate: '2026-06-28' })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun', false)).toBe(true)
  })
})

describe('taskAppliesToDate — non-recurring tasks', () => {
  it('applies only on its exact due date', () => {
    const t = task({ dueDate: '2026-06-28' })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(true)
    expect(taskAppliesToDate(t, new Date('2026-06-29T12:00:00'), '2026-06-29', 'mon')).toBe(false)
  })

  it('does not apply when dueDate is null', () => {
    const t = task({ dueDate: null })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(false)
  })
})

describe('taskAppliesToDate — created-date floor', () => {
  it('never applies to a recurring task before its createdAt date', () => {
    const t = task({ isRecurring: true, recurringType: 'daily', createdAt: '2026-06-28T12:00:00Z' })
    expect(taskAppliesToDate(t, new Date('2026-06-27T12:00:00'), '2026-06-27', 'sat')).toBe(false)
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(true)
  })

  it('does not apply the floor to non-recurring tasks', () => {
    const t = task({ isRecurring: false, dueDate: '2026-06-20', createdAt: '2026-06-28T12:00:00Z' })
    expect(taskAppliesToDate(t, new Date('2026-06-20T12:00:00'), '2026-06-20', 'sat')).toBe(true)
  })
})

describe('taskAppliesToDate — daily recurrence', () => {
  it('applies on every date', () => {
    const t = task({ isRecurring: true, recurringType: 'daily' })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(true)
    expect(taskAppliesToDate(t, new Date('2026-07-15T12:00:00'), '2026-07-15', 'wed')).toBe(true)
  })
})

describe('taskAppliesToDate — weekly recurrence', () => {
  it('applies only on the configured days', () => {
    const t = task({ isRecurring: true, recurringType: 'weekly', recurringDays: '["mon","wed","fri"]' })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(true)
    expect(taskAppliesToDate(t, new Date('2026-06-23T12:00:00'), '2026-06-23', 'tue')).toBe(false)
  })

  it('defaults to weekly when recurringType is null', () => {
    const t = task({ isRecurring: true, recurringType: null, recurringDays: '["mon"]' })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(true)
  })

  it('returns false when recurringDays is missing', () => {
    const t = task({ isRecurring: true, recurringType: 'weekly', recurringDays: null })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(false)
  })

  it('returns false (not throws) on malformed recurringDays JSON', () => {
    const t = task({ isRecurring: true, recurringType: 'weekly', recurringDays: 'not-json' })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(false)
  })
})

describe('taskAppliesToDate — biweekly recurrence', () => {
  it('applies on the anchor week and every other week after', () => {
    // Anchor: created Monday 2026-06-22 (week 0). biweeklyStart defaults to the anchor week being "active".
    const t = task({
      isRecurring: true,
      recurringType: 'biweekly',
      recurringDays: '["mon"]',
      createdAt: '2026-06-22T00:00:00',
    })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(true) // week 0 - active
    expect(taskAppliesToDate(t, new Date('2026-06-29T12:00:00'), '2026-06-29', 'mon')).toBe(false) // week 1 - skipped
    expect(taskAppliesToDate(t, new Date('2026-07-06T12:00:00'), '2026-07-06', 'mon')).toBe(true) // week 2 - active
  })

  it('inverts the active week when biweeklyStart is "next"', () => {
    const t = task({
      isRecurring: true,
      recurringType: 'biweekly',
      recurringDays: '["mon"]',
      createdAt: '2026-06-22T00:00:00',
      biweeklyStart: 'next',
    })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(false) // week 0 - skipped
    expect(taskAppliesToDate(t, new Date('2026-06-29T12:00:00'), '2026-06-29', 'mon')).toBe(true) // week 1 - active
  })

  it('returns false on a day not in recurringDays regardless of week parity', () => {
    const t = task({
      isRecurring: true,
      recurringType: 'biweekly',
      recurringDays: '["mon"]',
      createdAt: '2026-06-22T00:00:00',
    })
    expect(taskAppliesToDate(t, new Date('2026-06-23T12:00:00'), '2026-06-23', 'tue')).toBe(false)
  })

  it('returns false when recurringDays is missing', () => {
    const t = task({ isRecurring: true, recurringType: 'biweekly', recurringDays: null })
    expect(taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).toBe(false)
  })

  it('falls back to epoch as anchor when createdAt is missing, without throwing', () => {
    const t = task({ isRecurring: true, recurringType: 'biweekly', recurringDays: '["mon"]', createdAt: null })
    expect(() => taskAppliesToDate(t, new Date('2026-06-22T12:00:00'), '2026-06-22', 'mon')).not.toThrow()
  })
})

describe('taskAppliesToDate — monthly recurrence', () => {
  it('applies only on the configured day-of-month', () => {
    const t = task({ isRecurring: true, recurringType: 'monthly', recurringDays: '[1,15]' })
    expect(taskAppliesToDate(t, new Date('2026-06-15T12:00:00'), '2026-06-15', 'mon')).toBe(true)
    expect(taskAppliesToDate(t, new Date('2026-06-16T12:00:00'), '2026-06-16', 'tue')).toBe(false)
  })

  it('returns false when recurringDays is missing', () => {
    const t = task({ isRecurring: true, recurringType: 'monthly', recurringDays: null })
    expect(taskAppliesToDate(t, new Date('2026-06-15T12:00:00'), '2026-06-15', 'mon')).toBe(false)
  })

  it('returns false (not throws) on malformed recurringDays JSON', () => {
    const t = task({ isRecurring: true, recurringType: 'monthly', recurringDays: 'oops' })
    expect(taskAppliesToDate(t, new Date('2026-06-15T12:00:00'), '2026-06-15', 'mon')).toBe(false)
  })
})

describe('taskAppliesToDate — unknown recurrence type', () => {
  it('returns false for an unrecognized recurringType', () => {
    const t = task({ isRecurring: true, recurringType: 'yearly' })
    expect(taskAppliesToDate(t, new Date('2026-06-28T12:00:00'), '2026-06-28', 'sun')).toBe(false)
  })
})
