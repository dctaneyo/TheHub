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
        .where(eq(ctx.schema.notifications.locationId, locationId))
        .all()

      if (unreadOnly) {
        results = results.filter((n: any) => !n.isRead && !n.isDismissed)
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
        .set({ isRead: true })
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

      ctx.db
        .update(ctx.schema.notifications)
        .set({ isDismissed: true })
        .where(eq(ctx.schema.notifications.id, id))
        .run()

      return ctx.db
        .select()
        .from(ctx.schema.notifications)
        .where(eq(ctx.schema.notifications.id, id))
        .get()
    },

    clearAllNotifications: async (
      _: any,
      { locationId }: { locationId: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      ctx.db
        .update(ctx.schema.notifications)
        .set({ isDismissed: true })
        .where(eq(ctx.schema.notifications.locationId, locationId))
        .run()

      return true
    },
  },
}
