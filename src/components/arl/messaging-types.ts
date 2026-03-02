export interface Conversation {
  id: string;
  type: "direct" | "global" | "group";
  name: string;
  subtitle: string;
  lastMessage: {
    content: string;
    createdAt: string;
    senderType: string;
    senderName: string;
  } | null;
  unreadCount: number;
  memberCount: number;
  members?: Array<{ memberId: string; memberType: string }>;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: string;
  createdAt: string;
  reads: Array<{ readerType: string; readerId: string; readAt: string }>;
  reactions?: Array<{ emoji: string; userId: string; userName: string; createdAt: string }>;
}

export interface MemberInfo {
  id: string;
  name: string;
  type: "location" | "arl";
}

export type ConvType = "direct" | "global" | "group";

export interface NewGroupState {
  name: string;
  memberIds: string[];
  memberTypes: string[];
}

export interface Participant {
  id: string;
  name: string;
  type: "location" | "arl";
  storeNumber?: string;
}
