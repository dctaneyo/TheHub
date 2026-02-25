import { taskResolvers } from './tasks'
import { locationResolvers } from './locations'
import { messagingResolvers } from './messaging'
import { meetingResolvers } from './meetings'
import { achievementResolvers } from './achievements'
import { notificationResolvers } from './notifications'
import type { GraphQLContext } from '../context'

export const resolvers = {
  // Union type resolver
  MeResult: {
    __resolveType(obj: any) {
      return obj.storeNumber ? 'Location' : 'ARL'
    },
  },

  // Scalar resolvers
  DateTime: {
    // GraphQL Yoga handles scalars automatically for strings
  },

  Query: {
    me: async (_: any, __: any, ctx: GraphQLContext) => {
      if (!ctx.session) return null
      const { eq } = await import('drizzle-orm')

      if (ctx.session.userType === 'location') {
        return ctx.db
          .select()
          .from(ctx.schema.locations)
          .where(eq(ctx.schema.locations.id, ctx.session.id))
          .get()
      }

      if (ctx.session.userType === 'arl') {
        return ctx.db
          .select()
          .from(ctx.schema.arls)
          .where(eq(ctx.schema.arls.id, ctx.session.id))
          .get()
      }

      return null
    },

    ...locationResolvers.Query,
    ...taskResolvers.Query,
    ...messagingResolvers.Query,
    ...meetingResolvers.Query,
    ...achievementResolvers.Query,
    ...notificationResolvers.Query,
  },

  Mutation: {
    ...taskResolvers.Mutation,
    ...messagingResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...achievementResolvers.Mutation,
  },

  // Type resolvers
  Location: locationResolvers.Location,
  Task: taskResolvers.Task,
  TaskCompletion: taskResolvers.TaskCompletion,
  Conversation: messagingResolvers.Conversation,
  Message: messagingResolvers.Message,
  Meeting: meetingResolvers.Meeting,
}
