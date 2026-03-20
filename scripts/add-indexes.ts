import { sqlite } from '../src/lib/db';

console.log('🔧 Adding database indexes for optimization...\n');

function createIndex(sql: string, description: string) {
  try {
    sqlite.exec(sql);
  } catch (error: any) {
    if (error.message?.includes('no such column') || error.message?.includes('no such table')) {
      console.log(`  ⚠ Skipped ${description} (table/column missing)`);
    } else {
      throw error;
    }
  }
}

try {
  // ── Tenant isolation (most important for multi-tenant queries) ──
  console.log('🏢 Creating tenant_id indexes...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_arls_tenant ON arls(tenant_id)`, 'arls.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id)`, 'locations.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id)`, 'tasks.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id)`, 'conversations.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id)`, 'roles.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id)`, 'broadcasts.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_emergency_tenant ON emergency_messages(tenant_id)`, 'emergency_messages.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id)`, 'notifications.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_forms_tenant ON forms(tenant_id)`, 'forms.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_meeting_analytics_tenant ON meeting_analytics(tenant_id)`, 'meeting_analytics.tenant_id');
  console.log('  ✅ Tenant indexes created');

  // ── Tasks ──
  console.log('📋 Creating indexes for tasks table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_tasks_location_id ON tasks(location_id)`, 'tasks.location_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`, 'tasks.due_date');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_tasks_due_time ON tasks(due_time)`, 'tasks.due_time');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(is_recurring, recurring_type)`, 'tasks.recurring');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_tasks_tenant_location ON tasks(tenant_id, location_id)`, 'tasks.tenant+location');
  console.log('  ✅ Tasks indexes created');

  // ── Task Completions ──
  console.log('📋 Creating indexes for task_completions table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_completions_task_id ON task_completions(task_id)`, 'completions.task_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_completions_location_id ON task_completions(location_id)`, 'completions.location_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_completions_date ON task_completions(completed_date)`, 'completions.completed_date');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_completions_location_date ON task_completions(location_id, completed_date)`, 'completions.location+date');
  console.log('  ✅ Task completions indexes created');

  // ── Messages ──
  console.log('💬 Creating indexes for messages table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`, 'messages.conversation_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)`, 'messages.created_at');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON messages(conversation_id, created_at DESC)`, 'messages.conversation+time');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, sender_type)`, 'messages.sender');
  console.log('  ✅ Messages indexes created');

  // ── Conversations ──
  console.log('💬 Creating indexes for conversations table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type)`, 'conversations.type');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON conversations(participant_a_id, participant_a_type)`, 'conversations.participantA');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON conversations(participant_b_id, participant_b_type)`, 'conversations.participantB');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC)`, 'conversations.lastMessage');
  console.log('  ✅ Conversations indexes created');

  // ── Conversation Members ──
  console.log('👥 Creating indexes for conversation_members table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conv_members_conversation ON conversation_members(conversation_id)`, 'members.conversation_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_conv_members_member ON conversation_members(member_id, member_type)`, 'members.member');
  console.log('  ✅ Conversation members indexes created');

  // ── Message Reads ──
  console.log('✓ Creating indexes for message_reads table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id)`, 'reads.message_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_message_reads_reader ON message_reads(reader_id, reader_type)`, 'reads.reader');
  console.log('  ✅ Message reads indexes created');

  // ── Message Reactions ──
  console.log('😊 Creating indexes for message_reactions table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id)`, 'reactions.message_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id, user_type)`, 'reactions.user');
  console.log('  ✅ Message reactions indexes created');

  // ── Sessions ──
  console.log('🔐 Creating indexes for sessions table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, user_type)`, 'sessions.user');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_online ON sessions(is_online)`, 'sessions.online');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_user_online ON sessions(user_id, user_type, is_online)`, 'sessions.user+online');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`, 'sessions.expires');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen)`, 'sessions.last_seen');
  console.log('  ✅ Sessions indexes created');

  // ── Notifications ──
  console.log('🔔 Creating indexes for notifications table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`, 'notifications.user_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read, is_dismissed)`, 'notifications.read');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)`, 'notifications.created');
  console.log('  ✅ Notifications indexes created');

  // ── Meeting Analytics ──
  console.log('📊 Creating indexes for meeting_analytics table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_meeting_analytics_host ON meeting_analytics(host_id)`, 'analytics.host_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_meeting_analytics_started ON meeting_analytics(started_at DESC)`, 'analytics.started');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_meeting_analytics_meeting_id ON meeting_analytics(meeting_id)`, 'analytics.meeting_id');
  console.log('  ✅ Meeting analytics indexes created');

  // ── Meeting Participants ──
  console.log('👤 Creating indexes for meeting_participants table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id)`, 'participants.meeting_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_meeting_participants_participant ON meeting_participants(participant_id, participant_type)`, 'participants.participant');
  console.log('  ✅ Meeting participants indexes created');

  // ── Broadcasts ──
  console.log('📡 Creating indexes for broadcasts table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_broadcasts_arl ON broadcasts(arl_id)`, 'broadcasts.arl_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status)`, 'broadcasts.status');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC)`, 'broadcasts.created');
  console.log('  ✅ Broadcasts indexes created');

  // ── Audit Log ──
  console.log('📝 Creating indexes for audit_log table...');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id)`, 'audit_log.tenant_id');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`, 'audit_log.created');
  createIndex(`CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)`, 'audit_log.user_id');
  console.log('  ✅ Audit log indexes created');

  // ── Optimize ──
  console.log('\n🔧 Running ANALYZE...');
  sqlite.exec('ANALYZE');
  sqlite.exec('PRAGMA optimize');
  console.log('  ✅ Database optimized');

  console.log('\n✅ All indexes created successfully!');

} catch (error) {
  console.error('❌ Error creating indexes:', error);
  process.exit(1);
}
