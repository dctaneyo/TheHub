"use client";

import { useState, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Trash2, Store, Globe, Users } from "@/lib/icons";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Conversation, ConvType } from "./messaging-types";

const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 72;

export function convIcon(type: ConvType) {
  if (type === "global") return <Globe className="h-5 w-5" />;
  if (type === "group") return <Users className="h-5 w-5" />;
  return <Store className="h-5 w-5" />;
}

export function convIconBg(type: ConvType) {
  if (type === "global") return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (type === "group") return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  return "bg-muted text-muted-foreground";
}

interface SwipeableConvoRowProps {
  convo: Conversation;
  onOpen: () => void;
  onDelete: () => void;
}

export function SwipeableConvoRow({ convo, onOpen, onDelete }: SwipeableConvoRowProps) {
  const x = useMotionValue(0);
  const [swiped, setSwiped] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const clampedX = useTransform(x, (v) => Math.min(0, Math.max(-DELETE_WIDTH, v)));
  const deleteOpacity = useTransform(x, [-DELETE_WIDTH, -SWIPE_THRESHOLD], [1, 0]);

  const snapOpen = useCallback(() => {
    animate(x, -DELETE_WIDTH, { type: "spring", stiffness: 400, damping: 35 });
    setSwiped(true);
  }, [x]);

  const snapClosed = useCallback(() => {
    animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
    setSwiped(false);
    setConfirming(false);
  }, [x]);

  const canDelete = convo.type !== "global";

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canDelete) return;
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canDelete) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (Math.abs(dx) > 5) isDraggingRef.current = true;
    const next = swiped ? -DELETE_WIDTH + dx : dx;
    x.set(Math.min(0, Math.max(-DELETE_WIDTH, next)));
  };

  const handleTouchEnd = () => {
    if (!canDelete || !isDraggingRef.current) return;
    const cur = x.get();
    if (cur < -SWIPE_THRESHOLD) {
      snapOpen();
    } else {
      snapClosed();
    }
  };

  const handleRowClick = () => {
    if (isDraggingRef.current) return;
    if (swiped) { snapClosed(); return; }
    onOpen();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    } else {
      onDelete();
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl">
      {canDelete && (
        <motion.div
          style={{ opacity: deleteOpacity, width: DELETE_WIDTH }}
          className="absolute inset-y-0 right-0 flex items-center justify-end"
        >
          <button
            onClick={handleDeleteClick}
            className={cn(
              "flex h-full w-full items-center justify-center gap-1 rounded-xl text-white text-xs font-bold transition-colors",
              confirming ? "bg-red-700" : "bg-red-500"
            )}
          >
            <Trash2 className="h-4 w-4" />
            {confirming ? "Sure?" : "Delete"}
          </button>
        </motion.div>
      )}

      <motion.div
        style={{ x: clampedX }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleRowClick}
        className={cn(
          "relative flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors cursor-pointer select-none",
          convo.unreadCount > 0 ? "bg-red-50" : "bg-card hover:bg-muted"
        )}
      >
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", convIconBg(convo.type))}>
          {convIcon(convo.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{convo.name}</span>
            {convo.lastMessage && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(convo.lastMessage.createdAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{convo.subtitle}</p>
          {convo.lastMessage && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              <span className="text-muted-foreground">{convo.lastMessage.senderName}: </span>
              {convo.lastMessage.content}
            </p>
          )}
        </div>
        {convo.unreadCount > 0 && (
          <span className="ml-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--hub-red)] px-1 text-[9px] font-bold text-white">
            {convo.unreadCount}
          </span>
        )}
        {convo.type !== "global" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="hidden sm:group-hover:flex absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600"
            title="Delete conversation"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </motion.div>
    </div>
  );
}
