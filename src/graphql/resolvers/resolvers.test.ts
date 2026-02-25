import { describe, it, expect } from 'vitest'
import { resolvers } from './index'

describe('GraphQL Resolvers', () => {
  describe('Structure', () => {
    it('exports Query resolvers', () => {
      expect(resolvers.Query).toBeDefined()
      expect(typeof resolvers.Query.me).toBe('function')
    })

    it('has task query resolvers', () => {
      expect(typeof resolvers.Query.task).toBe('function')
      expect(typeof resolvers.Query.tasks).toBe('function')
      expect(typeof resolvers.Query.taskCompletions).toBe('function')
    })

    it('has location query resolvers', () => {
      expect(typeof resolvers.Query.location).toBe('function')
      expect(typeof resolvers.Query.locations).toBe('function')
      expect(typeof resolvers.Query.arls).toBe('function')
    })

    it('has messaging query resolvers', () => {
      expect(typeof resolvers.Query.conversation).toBe('function')
      expect(typeof resolvers.Query.conversations).toBe('function')
      expect(typeof resolvers.Query.messages).toBe('function')
    })

    it('has meeting query resolvers', () => {
      expect(typeof resolvers.Query.meeting).toBe('function')
      expect(typeof resolvers.Query.meetings).toBe('function')
      expect(typeof resolvers.Query.meetingAnalytics).toBe('function')
    })

    it('has achievement query resolvers', () => {
      expect(typeof resolvers.Query.achievements).toBe('function')
    })

    it('has notification query resolvers', () => {
      expect(typeof resolvers.Query.notifications).toBe('function')
    })

    it('exports Mutation resolvers', () => {
      expect(resolvers.Mutation).toBeDefined()
    })

    it('has task mutation resolvers', () => {
      expect(typeof resolvers.Mutation.createTask).toBe('function')
      expect(typeof resolvers.Mutation.updateTask).toBe('function')
      expect(typeof resolvers.Mutation.deleteTask).toBe('function')
      expect(typeof resolvers.Mutation.completeTask).toBe('function')
      expect(typeof resolvers.Mutation.uncompleteTask).toBe('function')
    })

    it('has messaging mutation resolvers', () => {
      expect(typeof resolvers.Mutation.sendMessage).toBe('function')
      expect(typeof resolvers.Mutation.reactToMessage).toBe('function')
    })

    it('has notification mutation resolvers', () => {
      expect(typeof resolvers.Mutation.markNotificationRead).toBe('function')
      expect(typeof resolvers.Mutation.dismissNotification).toBe('function')
      expect(typeof resolvers.Mutation.clearAllNotifications).toBe('function')
    })

    it('has achievement mutation resolvers', () => {
      expect(typeof resolvers.Mutation.unlockAchievement).toBe('function')
    })

    it('has type resolvers for Location', () => {
      expect(resolvers.Location).toBeDefined()
      expect(typeof resolvers.Location.tasks).toBe('function')
      expect(typeof resolvers.Location.completions).toBe('function')
      expect(typeof resolvers.Location.notifications).toBe('function')
    })

    it('has type resolvers for Task', () => {
      expect(resolvers.Task).toBeDefined()
      expect(typeof resolvers.Task.location).toBe('function')
      expect(typeof resolvers.Task.completions).toBe('function')
      expect(typeof resolvers.Task.isCompletedForDate).toBe('function')
    })

    it('has type resolvers for Conversation', () => {
      expect(resolvers.Conversation).toBeDefined()
      expect(typeof resolvers.Conversation.messages).toBe('function')
      expect(typeof resolvers.Conversation.members).toBe('function')
      expect(typeof resolvers.Conversation.unreadCount).toBe('function')
    })

    it('has type resolvers for Message', () => {
      expect(resolvers.Message).toBeDefined()
      expect(typeof resolvers.Message.reactions).toBe('function')
    })

    it('has type resolvers for Meeting', () => {
      expect(resolvers.Meeting).toBeDefined()
      expect(typeof resolvers.Meeting.participants).toBe('function')
    })

    it('has MeResult union type resolver', () => {
      expect(resolvers.MeResult).toBeDefined()
      expect(typeof resolvers.MeResult.__resolveType).toBe('function')
    })

    it('resolves MeResult to Location for objects with storeNumber', () => {
      expect(resolvers.MeResult.__resolveType({ storeNumber: '001' })).toBe('Location')
    })

    it('resolves MeResult to ARL for objects without storeNumber', () => {
      expect(resolvers.MeResult.__resolveType({ role: 'admin' })).toBe('ARL')
    })
  })

  describe('Authorization', () => {
    it('task query throws for unauthenticated users', async () => {
      const ctx = { session: null, db: {}, sqlite: {}, schema: {} } as any
      await expect(resolvers.Query.task({}, { id: 'test' }, ctx)).rejects.toThrow('Unauthorized')
    })

    it('tasks query throws for unauthenticated users', async () => {
      const ctx = { session: null, db: {}, sqlite: {}, schema: {} } as any
      await expect(resolvers.Query.tasks({}, {}, ctx)).rejects.toThrow('Unauthorized')
    })

    it('conversations query throws for unauthenticated users', async () => {
      const ctx = { session: null, db: {}, sqlite: {}, schema: {} } as any
      await expect(resolvers.Query.conversations({}, {}, ctx)).rejects.toThrow('Unauthorized')
    })

    it('locations query throws for non-ARL users', async () => {
      const ctx = {
        session: { id: 'loc-1', userType: 'location', name: 'Store' },
        db: {},
        sqlite: {},
        schema: {},
      } as any
      await expect(resolvers.Query.locations({}, {}, ctx)).rejects.toThrow('Unauthorized')
    })

    it('meeting query throws for non-ARL users', async () => {
      const ctx = {
        session: { id: 'loc-1', userType: 'location', name: 'Store' },
        db: {},
        sqlite: {},
        schema: {},
      } as any
      await expect(resolvers.Query.meeting({}, { id: 'test' }, ctx)).rejects.toThrow('Unauthorized')
    })

    it('createTask throws for non-ARL users', async () => {
      const ctx = {
        session: { id: 'loc-1', userType: 'location', name: 'Store' },
        db: {},
        sqlite: {},
        schema: {},
      } as any
      await expect(
        resolvers.Mutation.createTask({}, { input: { title: 'Test' } }, ctx)
      ).rejects.toThrow('Unauthorized')
    })
  })
})
