import { http, HttpResponse } from 'msw'

// Default mock API handlers
export const handlers = [
  // Auth
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 'test-user-1',
        name: 'Test Location',
        userType: 'location',
      },
    })
  }),

  // Tasks
  http.get('/api/tasks', () => {
    return HttpResponse.json({
      ok: true,
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task 1',
          type: 'task',
          priority: 'normal',
          dueTime: '09:00',
          isRecurring: true,
          recurringType: 'daily',
        },
      ],
    })
  }),

  // Notifications
  http.get('/api/notifications', () => {
    return HttpResponse.json({ ok: true, notifications: [] })
  }),
]
