export interface ChatMessage {
  id: string;
  senderName: string;
  senderType: string;
  content: string;
  timestamp: number;
}

export interface Question {
  id: string;
  askerName: string;
  question: string;
  upvotes: number;
  isAnswered: boolean;
}

export const REACTION_EMOJIS = ["❤️", "👍", "🔥", "😂", "👏", "💯"];
