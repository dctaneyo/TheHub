import { eq, and } from 'drizzle-orm'
import type { GraphQLContext } from '../context'

export const notificationResolvers = {
  Query: {
    notifications: async (
      _: any,
      { locationId, unreadOnly }: { locationId: string; unreadOnly?: boolean },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      let results = ctx.db
        .select()
        .from(ctx.schema.notifications)
        .where(eq(ctx.schema.notifications.userId, locationId))
        .all()

      if (unreadOnly) {
        results = results.filter((n: any) => !n.isRead)
      }

      // Sort by createdAt descending
      results.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))

      return results
    },
  },

  Mutation: {
    markNotificationRead: async (
      _: any,
      { id }: { id: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      ctx.db
        .update(ctx.schema.notifications)
        .set({ isRead: true, readAt: new Date().toISOString() })
        .where(eq(ctx.schema.notifications.id, id))
        .run()

      return ctx.db
        .select()
        .from(ctx.schema.notifications)
        .where(eq(ctx.schema.notifications.id, id))
        .get()
    },

    dismissNotification: async (
      _: any,
      { id }: { id: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      // Delete notification instead of dismiss (new schema has no isDismissed)
      ctx.db
        .delete(ctx.schema.notifications)
        .where(eq(ctx.schema.notifications.id, id))
        .run()

      return { id }
    },

    clearAllNotifications: async (
      _: any,
      { locationId }: { locationId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      ctx.db
        .delete(ctx.schema.notifications)
        .where(eq(ctx.schema.notifications.userId, locationId))
        .run()

      return true
    },
  },
}
