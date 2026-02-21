"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface AnimatedBackgroundProps {
  variant?: "subtle" | "particles" | "gradient";
  className?: string;
}

export function AnimatedBackground({ variant = "subtle", className = "" }: AnimatedBackgroundProps) {
  // Generate deterministic particles based on variant
  const particles = useMemo(() => {
    const count = variant === "particles" ? 30 : 15;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5,
    }));
  }, [variant]);

  if (variant === "gradient") {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.03) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(249, 115, 22, 0.03) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 80%, rgba(234, 179, 8, 0.03) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.03) 0%, transparent 50%)",
            ],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-gradient-to-br from-orange-200/20 to-red-200/20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.sin(particle.id) * 20, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
