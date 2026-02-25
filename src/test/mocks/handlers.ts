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
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task 1',
          type: 'task',
          priority: 'normal',
          dueTime: '09:00',
          points: 10,
          isRecurring: true,
          recurringType: 'daily',
        },
      ],
    })
  }),

  // Gamification
  http.get('/api/gamification', () => {
    return HttpResponse.json({
      points: 1250,
      level: 5,
      streak: 7,
      rank: 3,
    })
  }),

  // Achievements
  http.get('/api/achievements', () => {
    return HttpResponse.json({
      badges: [
        {
          id: 'first_task',
          name: 'Getting Started',
          desc: 'Complete your first task',
          tier: 'bronze',
          icon: '🎯',
          earned: true,
          earnedDate: '2025-01-15T10:00:00Z',
        },
      ],
      earnedCount: 1,
      totalCount: 17,
    })
  }),

  // Notifications
  http.get('/api/notifications', () => {
    return HttpResponse.json({ notifications: [] })
  }),
]
