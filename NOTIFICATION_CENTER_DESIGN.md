# Notification Center Design Document

## Overview
A unified notification center for The Hub to consolidate all alerts, messages, and updates in one place with filtering, search, and real-time updates.

---

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL, -- 'location' | 'arl' | 'admin'
  type TEXT NOT NULL, -- notification category
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- optional link to relevant page
  action_label TEXT, -- optional CTA text
  is_read INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
  metadata TEXT, -- JSON string for additional data
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

---

## Notification Types

### For Locations (Restaurants)
1. **task_due_soon** - Task due in next 30 minutes
2. **task_overdue** - Task is past due time
3. **new_message** - New message in conversation
4. **new_shoutout** - Received a shoutout
5. **achievement_unlocked** - New achievement earned
6. **high_five** - Received a high five
7. **emergency_broadcast** - Emergency alert from ARL
8. **meeting_starting** - Scheduled meeting starting soon
9. **form_uploaded** - New form available

### For ARLs
1. **task_completed** - Location completed a task
2. **new_message** - New message in conversation
3. **location_online** - Location came online
4. **location_offline** - Location went offline (if offline >30min)
5. **task_overdue_location** - Location has overdue tasks
6. **meeting_joined** - Someone joined your meeting
7. **analytics_alert** - Weekly summary or performance alert
8. **system_update** - Important system announcements

---

## Priority Levels

### Urgent (Red)
- Emergency broadcasts
- Critical system alerts
- Tasks severely overdue (>2 hours)

### High (Orange)
- Tasks due soon (<30min)
- Tasks overdue
- Meeting starting soon

### Normal (Blue)
- New messages
- Task completions
- User status changes

### Low (Gray)
- Achievement unlocks
- Shoutouts
- General updates

---

## UI Components

### Notification Bell (Header)
```typescript
interface NotificationBellProps {
  unreadCount: number;
  urgentCount: number;
  onClick: () => void;
}
```
- Position: Top-right header (both Dashboard and ARL)
- Badge: Shows unread count (max 99+)
- Urgent indicator: Red pulse animation if any urgent notifications
- Sound: Optional chime for new high/urgent notifications

### Notification Panel (Popover)
```typescript
interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}
```

**Features:**
- Dropdown from bell icon
- Width: 360px desktop, full-width mobile
- Max height: 500px with scroll
- Sections:
  - Header with "Mark all as read" and close button
  - Filter tabs: All | Unread | Messages | Tasks | Alerts
  - Search bar (collapsible)
  - Notification list
  - "See all" link to full notification center page

**Notification Item:**
```typescript
interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
}
```
- Icon based on type
- Priority color indicator (left border)
- Title (bold if unread)
- Message (truncated to 2 lines)
- Timestamp (relative: "2m ago", "1h ago", etc.)
- Action button (if action_url exists)
- Swipe-to-delete on mobile
- Mark as read on click

### Full Notification Center Page (Optional)
- Route: `/notifications` (or in ARL Hub)
- Pagination (50 per page)
- Advanced filtering
- Bulk actions (select all, mark as read, delete)
- Date range filter
- Export to CSV

---

## API Endpoints

### GET /api/notifications
**Query params:**
- `limit` (default: 50)
- `offset` (default: 0)
- `unread_only` (boolean)
- `type` (filter by type)
- `priority` (filter by priority)
- `search` (text search in title/message)

**Response:**
```json
{
  "notifications": [...],
  "total": 150,
  "unread": 12,
  "urgent": 2
}
```

### POST /api/notifications/:id/read
Mark single notification as read

### POST /api/notifications/mark-all-read
Mark all notifications as read for current user

### DELETE /api/notifications/:id
Delete single notification

### POST /api/notifications/create
Internal endpoint for system to create notifications

---

## WebSocket Events

### Client → Server
- `notification:subscribe` - Subscribe to notifications for user
- `notification:unsubscribe` - Unsubscribe

### Server → Client
- `notification:new` - New notification created
  ```json
  {
    "notification": {...},
    "count": { "total": 5, "urgent": 1 }
  }
  ```
- `notification:read` - Notification marked as read
- `notification:deleted` - Notification deleted

---

## Integration Points

### Existing Systems → Notifications

1. **Tasks** (`src/app/api/tasks/route.ts`)
   - On task due soon → create `task_due_soon`
   - On task overdue → create `task_overdue`
   - On task complete → create `task_completed` for ARLs

2. **Messages** (`src/app/api/messages/route.ts`)
   - On new message → create `new_message`

3. **Meetings** (`src/app/api/meetings/*`)
   - On meeting starting → create `meeting_starting`
   - On user joined → create `meeting_joined`

4. **Broadcasts** (`src/components/arl/emergency-broadcast.tsx`)
   - On emergency broadcast → create `emergency_broadcast`

5. **Achievements** (`src/app/api/achievements/route.ts`)
   - On achievement unlock → create `achievement_unlocked`

6. **Forms** (`src/app/api/forms/route.ts`)
   - On form upload → create `form_uploaded`

7. **Shoutouts** (`src/app/api/shoutouts/route.ts`)
   - On new shoutout → create `new_shoutout`

---

## Implementation Plan

### Phase 1: Backend
1. Create notifications table migration
2. Create /api/notifications endpoints
3. Add WebSocket events for notifications
4. Create notification creation helper function

### Phase 2: Frontend
1. Create NotificationBell component
2. Create NotificationPanel component
3. Create NotificationItem component
4. Add bell to Dashboard and ARL headers

### Phase 3: Integration
1. Hook into existing systems to create notifications
2. Add scheduled job for task due/overdue checks
3. Test all notification triggers

### Phase 4: Polish
1. Sound preferences (user can toggle)
2. Notification grouping (e.g., "3 new messages")
3. Desktop browser notifications (with permission)
4. Email digest for ARLs (optional)

---

## Performance Considerations

1. **Pagination**: Fetch only recent notifications, load more on scroll
2. **Indexing**: Database indices on user_id, is_read, created_at
3. **Cleanup**: Auto-delete read notifications older than 30 days
4. **Batch operations**: Mark multiple as read in single query
5. **WebSocket throttling**: Debounce rapid notification creation

---

## Accessibility

1. ARIA labels for bell icon and count
2. Keyboard navigation in notification panel
3. Screen reader announcements for new notifications
4. Focus management when opening/closing panel
5. High contrast mode support

---

## Future Enhancements

1. Notification preferences (per type on/off)
2. Quiet hours (no sounds during specified times)
3. Notification templates for easier creation
4. Rich notifications with images/actions
5. Push notifications via service worker
6. Notification history archive
