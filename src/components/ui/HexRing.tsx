"use client";

import { motion } from "framer-motion";

interface HexRingProps {
  color: string;
  size?: number;
  pulse?: boolean;
}

export function HexRing({ color, size = 120, pulse = false }: HexRingProps) {
  const id = `glow-${color.replace("#", "")}-${size}`;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      animate={pulse ? { opacity: [0.6, 1, 0.6] } : {}}
      transition={pulse ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
    >
      <defs>
        <filter id={id}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        points="60,5 110,30 110,90 60,115 10,90 10,30"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.6"
        filter={`url(#${id})`}
      />
      <polygon
        points="60,15 100,35 100,85 60,105 20,85 20,35"
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity="0.3"
      />
    </motion.svg>
  );
}
