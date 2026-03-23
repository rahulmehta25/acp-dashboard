"use client";

import { motion } from "framer-motion";

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  onClick: () => void;
  voiceLevel: number;
}

export function VoiceOrb({
  isListening,
  isSpeaking,
  onClick,
  voiceLevel,
}: VoiceOrbProps) {
  const activeColor = isListening ? "#00d4ff" : isSpeaking ? "#00ff88" : "#333";
  const scale = 1 + voiceLevel * 0.3;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        position: "relative",
        width: "48px",
        height: "48px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Outer ring */}
      <motion.div
        animate={{
          scale: isListening || isSpeaking ? [1, 1.2, 1] : 1,
          opacity: isListening || isSpeaking ? [0.3, 0.6, 0.3] : 0.2,
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: `1px solid ${activeColor}`,
        }}
      />
      {/* Middle ring */}
      <motion.div
        animate={{
          scale: isListening || isSpeaking ? [1, scale, 1] : 1,
          opacity: isListening || isSpeaking ? [0.4, 0.8, 0.4] : 0.1,
        }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "50%",
          border: `1px solid ${activeColor}`,
        }}
      />
      {/* Core orb */}
      <motion.div
        animate={{
          boxShadow: isListening
            ? [`0 0 20px ${activeColor}44`, `0 0 40px ${activeColor}88`, `0 0 20px ${activeColor}44`]
            : isSpeaking
              ? [`0 0 15px ${activeColor}33`, `0 0 30px ${activeColor}66`, `0 0 15px ${activeColor}33`]
              : `0 0 10px ${activeColor}22`,
        }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: `radial-gradient(circle at 40% 40%, ${activeColor}44, ${activeColor}11)`,
          border: `1.5px solid ${activeColor}66`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Mic / Speaker icon via SVG */}
        {isListening ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ) : isSpeaking ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )}
      </motion.div>

      {/* Label */}
      <div style={{
        position: "absolute",
        bottom: -16,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "7px",
        color: activeColor,
        letterSpacing: "1px",
        whiteSpace: "nowrap",
      }}>
        {isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : "VOICE"}
      </div>
    </motion.div>
  );
}
