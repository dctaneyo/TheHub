import { eq } from 'drizzle-orm'
import type { GraphQLContext } from '../context'

export const locationResolvers = {
  Query: {
    location: async (_: any, { id }: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.session) return null
      return ctx.db
        .select()
        .from(ctx.schema.locations)
        .where(eq(ctx.schema.locations.id, id))
        .get()
    },

    locations: async (_: any, { isActive }: { isActive?: boolean }, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      if (isActive !== undefined) {
        return ctx.db
          .select()
          .from(ctx.schema.locations)
          .where(eq(ctx.schema.locations.isActive, isActive))
          .all()
      }

      return ctx.db.select().from(ctx.schema.locations).all()
    },

    arls: async (_: any, { isActive }: { isActive?: boolean }, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      if (isActive !== undefined) {
        return ctx.db
          .select()
          .from(ctx.schema.arls)
          .where(eq(ctx.schema.arls.isActive, isActive))
          .all()
      }

      return ctx.db.select().from(ctx.schema.arls).all()
    },
  },

  Location: {
    tasks: async (parent: any, { completed, date }: { completed?: boolean; date?: string }, ctx: GraphQLContext) => {
      const allTasks = ctx.db.select().from(ctx.schema.tasks).all()

      // Filter tasks for this location
      return allTasks.filter((t: any) => {
        if (t.locationId && t.locationId !== parent.id) return false
        if (!t.locationId) return true // Global tasks
        return true
      })
    },

    completions: async (
      parent: any,
      { startDate, endDate, limit }: { startDate?: string; endDate?: string; limit?: number },
      ctx: GraphQLContext
    ) => {
      let query = ctx.db
        .select()
        .from(ctx.schema.taskCompletions)
        .where(eq(ctx.schema.taskCompletions.locationId, parent.id))

      const results = query.all()

      let filtered = results
      if (startDate) {
        filtered = filtered.filter((c: any) => c.completedDate >= startDate)
      }
      if (endDate) {
        filtered = filtered.filter((c: any) => c.completedDate <= endDate)
      }
      if (limit) {
        filtered = filtered.slice(0, limit)
      }

      return filtered
    },

    gamification: async (parent: any, _args: any, ctx: GraphQLContext) => {
      // Delegate to the gamification query resolver
      return null // Will be resolved by the gamification query
    },

    achievements: async (parent: any, _args: any, ctx: GraphQLContext) => {
      // Delegate to the achievements query resolver
      return null // Will be resolved by the achievements query
    },

    notifications: async (
      parent: any,
      { unreadOnly }: { unreadOnly?: boolean },
      ctx: GraphQLContext
    ) => {
      let results = ctx.db
        .select()
        .from(ctx.schema.notifications)
        .where(eq(ctx.schema.notifications.userId, parent.id))
        .all()

      if (unreadOnly) {
        results = results.filter((n: any) => !n.isRead)
      }

      return results
    },
  },
}
