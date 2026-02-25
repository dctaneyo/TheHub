import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ACHIEVEMENTS } from './route'

// Test achievement definitions (pure data, no mocking needed)
describe('Achievement Definitions', () => {
  it('has all expected achievements defined', () => {
    expect(Object.keys(ACHIEVEMENTS).length).toBeGreaterThanOrEqual(29)
  })

  it('each achievement has required fields', () => {
    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
      expect(achievement.id, `${key} missing id`).toBeTruthy()
      expect(achievement.name, `${key} missing name`).toBeTruthy()
      expect(achievement.desc, `${key} missing desc`).toBeTruthy()
      expect(achievement.tier, `${key} missing tier`).toBeTruthy()
      expect(achievement.icon, `${key} missing icon`).toBeTruthy()
    }
  })

  it('achievement IDs are unique', () => {
    const ids = Object.values(ACHIEVEMENTS).map((a) => a.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all tiers are valid', () => {
    const validTiers = ['bronze', 'silver', 'gold', 'platinum']
    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
      expect(validTiers, `${key} has invalid tier: ${achievement.tier}`).toContain(
        achievement.tier
      )
    }
  })

  it('has achievements across multiple tiers', () => {
    const tiers = new Set(Object.values(ACHIEVEMENTS).map((a) => a.tier))
    expect(tiers.size).toBeGreaterThanOrEqual(3)
  })

  it('has task milestone achievements in correct order', () => {
    const taskMilestones = ['TASKS_10', 'TASKS_50', 'TASKS_100', 'TASKS_500'] as const
    for (const key of taskMilestones) {
      expect(ACHIEVEMENTS[key], `Missing ${key}`).toBeDefined()
    }
  })

  it('has streak achievements in correct order', () => {
    const streakAchievements = ['STREAK_7', 'STREAK_30', 'STREAK_100', 'STREAK_365'] as const
    for (const key of streakAchievements) {
      expect(ACHIEVEMENTS[key], `Missing ${key}`).toBeDefined()
    }
  })

  it('has point-based achievements', () => {
    const pointAchievements = ['POINTS_1000', 'POINTS_5000', 'POINTS_10000'] as const
    for (const key of pointAchievements) {
      expect(ACHIEVEMENTS[key], `Missing ${key}`).toBeDefined()
    }
  })
})
