"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface SuccessCheckmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  show?: boolean;
  onComplete?: () => void;
}

export function SuccessCheckmark({ className, size = "md", show = false, onComplete }: SuccessCheckmarkProps) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20,
            onComplete
          }}
          className={cn("inline-flex", className)}
        >
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            exit={{ pathLength: 0 }}
            transition={{ 
              duration: 0.5, 
              ease: "easeInOut",
              delay: 0.1
            }}
          >
            <CheckCircle2 className={cn("text-emerald-500", sizes[size])} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Animated task completion checkmark
export function TaskCheckmark({ completed, className }: { completed: boolean; className?: string }) {
  return (
    <motion.div
      className={cn("relative", className)}
    >
      <motion.div
        initial={{ scale: 1, rotate: 0 }}
        animate={completed ? {
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0],
        } : {}}
        transition={{ 
          duration: 0.6, 
          ease: "easeInOut" 
        }}
      >
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
        )}
      </motion.div>
      
      {/* Success burst effect */}
      <AnimatePresence>
        {completed && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  scale: 0, 
                  opacity: 1,
                  x: 0,
                  y: 0
                }}
                animate={{
                  scale: [0, 1.5, 0],
                  opacity: [1, 0.8, 0],
                  x: Math.cos((i * 60) * Math.PI / 180) * 20,
                  y: Math.sin((i * 60) * Math.PI / 180) * 20,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.05,
                  ease: "easeOut"
                }}
                className="absolute inset-0 rounded-full bg-emerald-400"
                style={{ width: 4, height: 4 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
