"use client";

import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";

// ── Queries ──

export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData($locationId: ID!) {
    location(id: $locationId) {
      id
      name
      storeNumber
      tasks {
        id
        title
        type
        priority
        dueTime
        daysOfWeek
        isActive
      }
      gamification {
        streak
        level
        levelTitle
        currentXP
        nextLevelXP
        todayPoints
        badges {
          id
          name
          desc
          tier
          icon
          unlockedAt
        }
      }
      achievements {
        id
        achievementId
        unlockedAt
      }
    }
  }
`;

export const GET_CONVERSATIONS = gql`
  query GetConversations {
    conversations {
      id
      name
      type
      lastMessage
      lastMessageAt
      unreadCount
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!, $limit: Int, $offset: Int) {
    messages(conversationId: $conversationId, limit: $limit, offset: $offset) {
      id
      content
      senderName
      senderType
      senderId
      type
      metadata
      createdAt
      reactions {
        id
        emoji
        userId
        userName
      }
    }
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($userId: ID!) {
    notifications(userId: $userId) {
      id
      type
      title
      message
      isRead
      createdAt
    }
  }
`;

export const GET_TASKS = gql`
  query GetTasks($locationId: ID) {
    tasks(locationId: $locationId) {
      id
      title
      type
      priority
      dueTime
      daysOfWeek
      isActive
      locationId
      createdAt
    }
  }
`;

// ── Mutations ──

export const SEND_MESSAGE = gql`
  mutation SendMessage($conversationId: ID!, $content: String!, $type: String) {
    sendMessage(conversationId: $conversationId, content: $content, type: $type) {
      id
      content
      senderName
      senderType
      createdAt
    }
  }
`;

export const COMPLETE_TASK = gql`
  mutation CompleteTask($taskId: ID!, $locationId: ID!, $completedDate: String!, $completedAt: String!) {
    completeTask(taskId: $taskId, locationId: $locationId, completedDate: $completedDate, completedAt: $completedAt) {
      id
      taskId
      locationId
      completedDate
      pointsEarned
      bonusPoints
    }
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

// ── Custom Hooks ──

export function useDashboardData(locationId: string) {
  return useQuery(GET_DASHBOARD_DATA, {
    variables: { locationId },
    skip: !locationId,
  });
}

export function useConversations() {
  return useQuery(GET_CONVERSATIONS);
}

export function useMessages(conversationId: string, limit = 50, offset = 0) {
  return useQuery(GET_MESSAGES, {
    variables: { conversationId, limit, offset },
    skip: !conversationId,
  });
}

export function useNotifications(userId: string) {
  return useQuery(GET_NOTIFICATIONS, {
    variables: { userId },
    skip: !userId,
    pollInterval: 30000,
  });
}

export function useTasks(locationId?: string) {
  return useQuery(GET_TASKS, {
    variables: { locationId },
  });
}

export function useSendMessage() {
  return useMutation(SEND_MESSAGE);
}

export function useCompleteTask() {
  return useMutation(COMPLETE_TASK);
}

export function useMarkNotificationRead() {
  return useMutation(MARK_NOTIFICATION_READ);
}
