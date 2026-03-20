"use client";

import { X, Send, ThumbsUp, CheckCircle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Question } from "./types";

interface QAPanelProps {
  questions: Question[];
  newQuestion: string;
  onNewQuestionChange: (value: string) => void;
  onSendQuestion: () => void;
  onUpvote: (questionId: string) => void;
  onMarkAnswered: (questionId: string) => void;
  onClose: () => void;
  isHostOrCohost: boolean;
}

export function QAPanel({
  questions,
  newQuestion,
  onNewQuestionChange,
  onSendQuestion,
  onUpvote,
  onMarkAnswered,
  onClose,
  isHostOrCohost,
}: QAPanelProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">Q&A</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {questions.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8">No questions yet</p>
        ) : (
          questions.map(q => (
            <div key={q.id} className={cn("p-3 rounded-lg border", q.isAnswered ? "bg-green-900/20 border-green-800" : "bg-slate-700/50 border-slate-600")}>
              <div className="text-xs font-medium text-slate-300 mb-1">{q.askerName}</div>
              <div className="text-sm text-white mb-2">{q.question}</div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onUpvote(q.id)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-yellow-400"
                >
                  <ThumbsUp className="h-3 w-3" />
                  <span>{q.upvotes}</span>
                </button>
                <div className="flex items-center gap-2">
                  {q.isAnswered && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Answered
                    </span>
                  )}
                  {isHostOrCohost && !q.isAnswered && (
                    <button
                      onClick={() => onMarkAnswered(q.id)}
                      className="text-xs text-green-400 hover:text-green-300 font-medium"
                    >
                      Mark Answered
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-slate-700 flex gap-2">
        <Input
          value={newQuestion}
          onChange={e => onNewQuestionChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onSendQuestion();
          }}
          placeholder="Ask a question..."
          className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm"
        />
        <Button onClick={onSendQuestion} disabled={!newQuestion.trim()} size="icon" className="bg-yellow-600 hover:bg-yellow-700 h-9 w-9 shrink-0" aria-label="Submit question">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
