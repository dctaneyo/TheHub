import { eq, desc } from 'drizzle-orm'
import type { GraphQLContext } from '../context'

export const meetingResolvers = {
  Query: {
    meeting: async (_: any, { id }: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }
      return ctx.db
        .select()
        .from(ctx.schema.meetingAnalytics)
        .where(eq(ctx.schema.meetingAnalytics.id, id))
        .get()
    },

    meetings: async (
      _: any,
      { limit, startDate, endDate }: { limit?: number; startDate?: string; endDate?: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      let results = ctx.db
        .select()
        .from(ctx.schema.meetingAnalytics)
        .orderBy(desc(ctx.schema.meetingAnalytics.startedAt))
        .all()

      if (startDate) {
        results = results.filter((m: any) => m.startedAt >= startDate)
      }
      if (endDate) {
        results = results.filter((m: any) => m.startedAt <= endDate)
      }
      if (limit) {
        results = results.slice(0, limit)
      }

      return results
    },

    meetingAnalytics: async (_: any, __: any, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      const meetings = ctx.db
        .select()
        .from(ctx.schema.meetingAnalytics)
        .orderBy(desc(ctx.schema.meetingAnalytics.startedAt))
        .all()

      const totalMeetings = meetings.length
      const completedMeetings = meetings.filter((m: any) => m.endedAt).length
      const totalDuration = meetings.reduce((sum: number, m: any) => sum + (m.duration || 0), 0)
      const avgDuration = completedMeetings > 0 ? Math.round(totalDuration / completedMeetings) : 0
      const avgParticipants =
        totalMeetings > 0
          ? Math.round(
              meetings.reduce((sum: number, m: any) => sum + (m.peakParticipants || 0), 0) /
                totalMeetings
            )
          : 0
      const totalMessages = meetings.reduce((sum: number, m: any) => sum + (m.totalMessages || 0), 0)
      const totalReactions = meetings.reduce((sum: number, m: any) => sum + (m.totalReactions || 0), 0)
      const totalQuestions = meetings.reduce((sum: number, m: any) => sum + (m.totalQuestions || 0), 0)
      const totalHandRaises = meetings.reduce((sum: number, m: any) => sum + (m.totalHandRaises || 0), 0)

      return {
        meetings,
        summary: {
          totalMeetings,
          completedMeetings,
          totalDuration,
          avgDuration,
          avgParticipants,
          totalMessages,
          totalReactions,
          totalQuestions,
          totalHandRaises,
        },
      }
    },
  },

  Meeting: {
    participants: async (parent: any, _args: any, ctx: GraphQLContext) => {
      const allParticipants = ctx.db
        .select()
        .from(ctx.schema.meetingParticipants)
        .where(eq(ctx.schema.meetingParticipants.meetingId, parent.meetingId))
        .all()

      // Scope participants to this specific meeting session
      const meetingStart = new Date(parent.startedAt).getTime()
      const meetingEnd = parent.endedAt
        ? new Date(parent.endedAt).getTime() + 60_000
        : Date.now() + 86400_000

      return allParticipants.filter((p: any) => {
        const joinedAt = new Date(p.joinedAt).getTime()
        return joinedAt >= meetingStart - 60_000 && joinedAt <= meetingEnd
      })
    },
  },
}
