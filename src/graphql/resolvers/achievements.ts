import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { GraphQLContext } from '../context'
import { ACHIEVEMENTS } from '@/app/api/achievements/route'

export const achievementResolvers = {
  Query: {
    achievements: async (
      _: any,
      { locationId }: { locationId?: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      const targetLocationId = locationId || ctx.session.id

      // Ensure achievements table exists
      try {
        ctx.sqlite.exec(`
          CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            location_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at TEXT NOT NULL,
            notified INTEGER DEFAULT 0
          )
        `)
      } catch {}

      const unlocked = ctx.sqlite
        .prepare('SELECT * FROM achievements WHERE location_id = ? ORDER BY unlocked_at DESC')
        .all(targetLocationId) as any[]

      const unlockedIds = new Set(unlocked.map((a: any) => a.achievement_id))

      const badges = Object.values(ACHIEVEMENTS).map((achievement) => ({
        ...achievement,
        earned: unlockedIds.has(achievement.id),
        earnedDate:
          unlocked.find((a: any) => a.achievement_id === achievement.id)?.unlocked_at || null,
      }))

      return {
        badges,
        earnedCount: unlocked.length,
        totalCount: Object.keys(ACHIEVEMENTS).length,
      }
    },
  },

  Mutation: {
    unlockAchievement: async (
      _: any,
      { achievementId, locationId }: { achievementId: string; locationId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      // Ensure achievements table exists
      try {
        ctx.sqlite.exec(`
          CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            location_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at TEXT NOT NULL,
            notified INTEGER DEFAULT 0
          )
        `)
      } catch {}

      // Check if already unlocked
      const existing = ctx.sqlite
        .prepare('SELECT * FROM achievements WHERE location_id = ? AND achievement_id = ?')
        .get(locationId, achievementId)

      if (existing) {
        const achievement = Object.values(ACHIEVEMENTS).find((a) => a.id === achievementId)
        return {
          ...achievement,
          earned: true,
          earnedDate: (existing as any).unlocked_at,
        }
      }

      // Unlock
      const now = new Date().toISOString()
      ctx.sqlite
        .prepare(
          'INSERT INTO achievements (id, location_id, achievement_id, unlocked_at, notified) VALUES (?, ?, ?, ?, 0)'
        )
        .run(uuid(), locationId, achievementId, now)

      const achievement = Object.values(ACHIEVEMENTS).find((a) => a.id === achievementId)

      return {
        ...achievement,
        earned: true,
        earnedDate: now,
      }
    },
  },
}
