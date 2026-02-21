"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket-context";

interface HighFive {
  id: string;
  from_user_name: string;
  to_user_name: string;
  message?: string;
}

export function HighFiveAnimation() {
  const [highFives, setHighFives] = useState<HighFive[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleHighFive = (data: HighFive) => {
      setHighFives(prev => [...prev, data]);
      
      // Remove after animation completes
      setTimeout(() => {
        setHighFives(prev => prev.filter(hf => hf.id !== data.id));
      }, 4000);
    };

    socket.on("high-five:received", handleHighFive);

    return () => {
      socket.off("high-five:received", handleHighFive);
    };
  }, [socket]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] flex items-center justify-center">
      <AnimatePresence>
        {highFives.map((hf) => (
          <motion.div
            key={hf.id}
            initial={{ scale: 0, rotate: -45, opacity: 0 }}
            animate={{ 
              scale: [0, 1.2, 1],
              rotate: [0, 10, -10, 0],
              opacity: [0, 1, 1, 0],
              y: [0, -20, -40, -60]
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              duration: 3.5,
              times: [0, 0.2, 0.8, 1],
              ease: "easeOut"
            }}
            className="absolute"
          >
            <div className="relative">
              {/* High-five hand emoji with glow */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 0.5,
                  ease: "easeInOut"
                }}
                className="text-[120px] drop-shadow-2xl"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))"
                }}
              >
                🙌
              </motion.div>

              {/* Message bubble */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap"
              >
                <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-6 py-3 shadow-2xl">
                  <p className="text-white font-black text-lg text-center">
                    {hf.from_user_name} → {hf.to_user_name}
                  </p>
                  {hf.message && (
                    <p className="text-white/90 text-sm text-center mt-1">
                      {hf.message}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Sparkles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 0,
                    scale: 0,
                    x: 0,
                    y: 0
                  }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: Math.cos((i * Math.PI * 2) / 8) * 80,
                    y: Math.sin((i * Math.PI * 2) / 8) * 80
                  }}
                  transition={{ 
                    duration: 1.5,
                    delay: 0.2 + (i * 0.1),
                    ease: "easeOut"
                  }}
                  className="absolute top-1/2 left-1/2 text-4xl"
                >
                  ✨
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
