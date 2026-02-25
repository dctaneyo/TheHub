import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { GraphQLContext } from '../context'

export const taskResolvers = {
  Query: {
    task: async (_: any, { id }: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.session) throw new Error('Unauthorized')
      return ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, id))
        .get()
    },

    tasks: async (
      _: any,
      { locationId, type, priority }: { locationId?: string; type?: string; priority?: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      let results = ctx.db.select().from(ctx.schema.tasks).all()

      if (locationId) {
        results = results.filter(
          (t: any) => !t.locationId || t.locationId === locationId
        )
      }
      if (type) {
        results = results.filter((t: any) => t.type === type)
      }
      if (priority) {
        results = results.filter((t: any) => t.priority === priority)
      }

      return results
    },

    taskCompletions: async (
      _: any,
      args: { locationId?: string; taskId?: string; startDate?: string; endDate?: string; limit?: number },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      let results = ctx.db.select().from(ctx.schema.taskCompletions).all()

      if (args.locationId) {
        results = results.filter((c: any) => c.locationId === args.locationId)
      }
      if (args.taskId) {
        results = results.filter((c: any) => c.taskId === args.taskId)
      }
      if (args.startDate) {
        results = results.filter((c: any) => c.completedDate >= args.startDate!)
      }
      if (args.endDate) {
        results = results.filter((c: any) => c.completedDate <= args.endDate!)
      }

      // Sort by date descending
      results.sort((a: any, b: any) => b.completedDate.localeCompare(a.completedDate))

      if (args.limit) {
        results = results.slice(0, args.limit)
      }

      return results
    },
  },

  Mutation: {
    createTask: async (_: any, { input }: { input: any }, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      const taskId = uuid()
      const now = new Date().toISOString()

      const task = {
        id: taskId,
        title: input.title,
        description: input.description || null,
        type: input.type || 'task',
        priority: input.priority || 'normal',
        dueTime: input.dueTime,
        dueDate: input.dueDate || null,
        isRecurring: input.isRecurring || false,
        recurringType: input.recurringType || null,
        recurringDays: input.recurringDays ? JSON.stringify(input.recurringDays) : null,
        biweeklyStart: input.biweeklyStart || null,
        locationId: input.locationId || null,
        createdBy: ctx.session.id,
        createdByType: 'arl' as const,
        isHidden: false,
        allowEarlyComplete: input.allowEarlyComplete || false,
        showInToday: input.showInToday !== undefined ? input.showInToday : true,
        showIn7Day: input.showIn7Day !== undefined ? input.showIn7Day : true,
        showInCalendar: input.showInCalendar !== undefined ? input.showInCalendar : true,
        points: input.points || 10,
        createdAt: now,
        updatedAt: now,
      }

      ctx.db.insert(ctx.schema.tasks).values(task).run()

      return ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, taskId))
        .get()
    },

    updateTask: async (_: any, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      const existing = ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, id))
        .get()

      if (!existing) throw new Error('Task not found')

      const updates: any = { updatedAt: new Date().toISOString() }

      if (input.title !== undefined) updates.title = input.title
      if (input.description !== undefined) updates.description = input.description
      if (input.type !== undefined) updates.type = input.type
      if (input.priority !== undefined) updates.priority = input.priority
      if (input.dueTime !== undefined) updates.dueTime = input.dueTime
      if (input.dueDate !== undefined) updates.dueDate = input.dueDate
      if (input.isRecurring !== undefined) updates.isRecurring = input.isRecurring
      if (input.recurringType !== undefined) updates.recurringType = input.recurringType
      if (input.recurringDays !== undefined) updates.recurringDays = JSON.stringify(input.recurringDays)
      if (input.biweeklyStart !== undefined) updates.biweeklyStart = input.biweeklyStart
      if (input.locationId !== undefined) updates.locationId = input.locationId
      if (input.points !== undefined) updates.points = input.points
      if (input.isHidden !== undefined) updates.isHidden = input.isHidden
      if (input.allowEarlyComplete !== undefined) updates.allowEarlyComplete = input.allowEarlyComplete
      if (input.showInToday !== undefined) updates.showInToday = input.showInToday
      if (input.showIn7Day !== undefined) updates.showIn7Day = input.showIn7Day
      if (input.showInCalendar !== undefined) updates.showInCalendar = input.showInCalendar

      ctx.db
        .update(ctx.schema.tasks)
        .set(updates)
        .where(eq(ctx.schema.tasks.id, id))
        .run()

      return ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, id))
        .get()
    },

    deleteTask: async (_: any, { id }: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.session || ctx.session.userType !== 'arl') {
        throw new Error('Unauthorized - ARL access required')
      }

      const existing = ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, id))
        .get()

      if (!existing) throw new Error('Task not found')

      ctx.db
        .delete(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, id))
        .run()

      return true
    },

    completeTask: async (
      _: any,
      { taskId, locationId, date, notes }: { taskId: string; locationId: string; date: string; notes?: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      const task = ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, taskId))
        .get()

      if (!task) throw new Error('Task not found')

      // Check if already completed for this date
      const existing = ctx.db
        .select()
        .from(ctx.schema.taskCompletions)
        .where(
          and(
            eq(ctx.schema.taskCompletions.taskId, taskId),
            eq(ctx.schema.taskCompletions.locationId, locationId),
            eq(ctx.schema.taskCompletions.completedDate, date)
          )
        )
        .get()

      if (existing) throw new Error('Task already completed for this date')

      const completionId = uuid()
      const now = new Date().toISOString()

      const completion = {
        id: completionId,
        taskId,
        locationId,
        completedAt: now,
        completedDate: date,
        notes: notes || null,
        pointsEarned: task.points || 10,
        bonusPoints: 0,
      }

      ctx.db.insert(ctx.schema.taskCompletions).values(completion).run()

      return ctx.db
        .select()
        .from(ctx.schema.taskCompletions)
        .where(eq(ctx.schema.taskCompletions.id, completionId))
        .get()
    },

    uncompleteTask: async (
      _: any,
      { taskId, locationId, date }: { taskId: string; locationId: string; date: string },
      ctx: GraphQLContext
    ) => {
      if (!ctx.session) throw new Error('Unauthorized')

      ctx.db
        .delete(ctx.schema.taskCompletions)
        .where(
          and(
            eq(ctx.schema.taskCompletions.taskId, taskId),
            eq(ctx.schema.taskCompletions.locationId, locationId),
            eq(ctx.schema.taskCompletions.completedDate, date)
          )
        )
        .run()

      return true
    },
  },

  Task: {
    location: async (parent: any, _args: any, ctx: GraphQLContext) => {
      if (!parent.locationId) return null
      return ctx.db
        .select()
        .from(ctx.schema.locations)
        .where(eq(ctx.schema.locations.id, parent.locationId))
        .get()
    },

    completions: async (
      parent: any,
      { startDate, endDate }: { startDate?: string; endDate?: string },
      ctx: GraphQLContext
    ) => {
      let results = ctx.db
        .select()
        .from(ctx.schema.taskCompletions)
        .where(eq(ctx.schema.taskCompletions.taskId, parent.id))
        .all()

      if (startDate) results = results.filter((c: any) => c.completedDate >= startDate)
      if (endDate) results = results.filter((c: any) => c.completedDate <= endDate)

      return results
    },

    isCompletedForDate: async (
      parent: any,
      { locationId, date }: { locationId: string; date: string },
      ctx: GraphQLContext
    ) => {
      const completion = ctx.db
        .select()
        .from(ctx.schema.taskCompletions)
        .where(
          and(
            eq(ctx.schema.taskCompletions.taskId, parent.id),
            eq(ctx.schema.taskCompletions.locationId, locationId),
            eq(ctx.schema.taskCompletions.completedDate, date)
          )
        )
        .get()

      return !!completion
    },

    recurringDays: (parent: any) => {
      if (!parent.recurringDays) return null
      try {
        return JSON.parse(parent.recurringDays)
      } catch {
        return null
      }
    },
  },

  TaskCompletion: {
    task: async (parent: any, _args: any, ctx: GraphQLContext) => {
      return ctx.db
        .select()
        .from(ctx.schema.tasks)
        .where(eq(ctx.schema.tasks.id, parent.taskId))
        .get()
    },

    location: async (parent: any, _args: any, ctx: GraphQLContext) => {
      return ctx.db
        .select()
        .from(ctx.schema.locations)
        .where(eq(ctx.schema.locations.id, parent.locationId))
        .get()
    },
  },
}
