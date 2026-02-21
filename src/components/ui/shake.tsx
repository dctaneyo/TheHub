"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShakeProps {
  children: React.ReactNode;
  className?: string;
  trigger?: boolean;
  intensity?: "light" | "medium" | "heavy";
}

export function Shake({ children, className, trigger = false, intensity = "medium" }: ShakeProps) {
  const shakeVariants = {
    light: {
      x: [0, -2, 2, -2, 2, -1, 1, 0],
      transition: { duration: 0.4, ease: "easeInOut" as const }
    },
    medium: {
      x: [0, -4, 4, -4, 4, -2, 2, 0],
      transition: { duration: 0.5, ease: "easeInOut" as const }
    },
    heavy: {
      x: [0, -8, 8, -8, 8, -4, 4, -2, 2, 0],
      transition: { duration: 0.6, ease: "easeInOut" as const }
    }
  };

  return (
    <motion.div
      className={cn("inline-block", className)}
      animate={trigger ? shakeVariants[intensity] : {}}
    >
      {children}
    </motion.div>
  );
}

// Hook for shake trigger
export function useShake() {
  const [shakeKey, setShakeKey] = useState(0);
  
  const trigger = () => {
    setShakeKey((prev: number) => prev + 1);
  };
  
  return { shakeKey, trigger };
}
