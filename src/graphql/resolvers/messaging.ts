import { eq, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { GraphQLContext } from '../context'

export const messagingResolvers = {
  Query: {
    conversation: async (_: any, { id }: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.session) throw new Error('Unauthorized')
      return ctx.db
        .select()
        .from(ctx.schema.conversations)
        .where(eq(ctx.schema.conversations.id, id))
        .get()
    },

    conversations: async (_: any, __: any, ctx: GraphQLContext) => {
      if (!ctx.session) throw new Error('Unauthorized')

      const allConversations = ctx.db
        .select()
        .from(ctx.schema.conversations)
        .orderBy(desc(ctx.schema.conversations.lastMessageAt))
        .all()

      // Filter based on user type and membership
      return allConversations.filter((conv: any) => {
        // Check if user has deleted/hidden this conversation
        try {
          const deletedBy = JSON.parse(conv.deletedBy || '[]')
          if (deletedBy.includes(ctx.session!.id)) return false
        } catch {}

        if (conv.type === 'global') return true

        if (conv.type === 'direct') {
          return (
            (conv.participantAId === ctx.session!.id && conv.participantAType === ctx.session!.userType) ||
            (conv.participantBId === ctx.session!.id && conv.participantBType === ctx.session!.userType)
          )
        }

        if (conv.type === 'group') {
          // Check membership
          const member = ctx.db
            .select()
            .from(ctx.schema.conversationMembers)
            .where(eq(ctx.schema.conversationMembers.conversationId, conv.id))
            .all()
            .find(
              (m: any) =>
                m.memberId === ctx.session!.id &&
                m.memberType === ctx.session!.userType &&
                !m.leftAt
            )
          return !!member
        }

        return false
      })
    },

    messages: async (
      _: any,
      { conversationId, limit, offset }: { conversationId: string; limit?: number; offset?: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      let results = ctx.db
        .select()
        .from(ctx.schema.messages)
        .where(eq(ctx.schema.messages.conversationId, conversationId))
        .orderBy(desc(ctx.schema.messages.createdAt))
        .all()

      if (offset) results = results.slice(offset)
      if (limit) results = results.slice(0, limit)

      return results
    },
  },

  Mutation: {
    sendMessage: async (
      _: any,
      { conversationId, content, messageType }: { conversationId: string; content: string; messageType?: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      const messageId = uuid()
      const now = new Date().toISOString()

      const message = {
        id: messageId,
        conversationId,
        senderType: ctx.session.userType,
        senderId: ctx.session.id,
        senderName: ctx.session.name,
        content,
        messageType: messageType || 'text',
        createdAt: now,
      }

      ctx.db.insert(ctx.schema.messages).values(message).run()

      // Update conversation last message
      ctx.db
        .update(ctx.schema.conversations)
        .set({
          lastMessageAt: now,
          lastMessagePreview: content.slice(0, 100),
        })
        .where(eq(ctx.schema.conversations.id, conversationId))
        .run()

      return ctx.db
        .select()
        .from(ctx.schema.messages)
        .where(eq(ctx.schema.messages.id, messageId))
        .get()
    },

    reactToMessage: async (
      _: any,
      { messageId, emoji }: { messageId: string; emoji: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      const reactionId = uuid()
      const now = new Date().toISOString()

      const reaction = {
        id: reactionId,
        messageId,
        userId: ctx.session.id,
        userType: ctx.session.userType,
        userName: ctx.session.name,
        emoji,
        createdAt: now,
      }

      ctx.db.insert(ctx.schema.messageReactions).values(reaction).run()

      return reaction
    },
  },

  Conversation: {
    messages: async (
      parent: any,
      { limit, offset }: { limit?: number; offset?: number },
      ctx: GraphQLContext
    ) => {
      let results = ctx.db
        .select()
        .from(ctx.schema.messages)
        .where(eq(ctx.schema.messages.conversationId, parent.id))
        .orderBy(desc(ctx.schema.messages.createdAt))
        .all()

      if (offset) results = results.slice(offset)
      if (limit) results = results.slice(0, limit)

      return results
    },

    members: async (parent: any, _args: any, ctx: GraphQLContext) => {
      return ctx.db
        .select()
        .from(ctx.schema.conversationMembers)
        .where(eq(ctx.schema.conversationMembers.conversationId, parent.id))
        .all()
    },

    unreadCount: async (
      parent: any,
      { userId, userType }: { userId: string; userType: string },
      ctx: GraphQLContext
    ) => {
      const allMessages = ctx.db
        .select()
        .from(ctx.schema.messages)
        .where(eq(ctx.schema.messages.conversationId, parent.id))
        .all()

      const readMessages = ctx.db
        .select()
        .from(ctx.schema.messageReads)
        .where(eq(ctx.schema.messageReads.readerId, userId))
        .all()

      const readMessageIds = new Set(readMessages.map((r: any) => r.messageId))

      return allMessages.filter(
        (m: any) =>
          !readMessageIds.has(m.id) &&
          !(m.senderId === userId && m.senderType === userType)
      ).length
    },
  },

  Message: {
    reactions: async (parent: any, _args: any, ctx: GraphQLContext) => {
      return ctx.db
        .select()
        .from(ctx.schema.messageReactions)
        .where(eq(ctx.schema.messageReactions.messageId, parent.id))
        .all()
    },
  },
}
