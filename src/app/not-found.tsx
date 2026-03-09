"use client";

import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#e0e0e0",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: "center" }}
      >
        <div
          style={{
            fontSize: "64px",
            fontWeight: 700,
            color: "#00d4ff",
            letterSpacing: "8px",
            textShadow: "0 0 30px rgba(0,212,255,0.3)",
          }}
        >
          404
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#444",
            letterSpacing: "4px",
            marginTop: "16px",
          }}
        >
          SECTOR NOT FOUND
        </div>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: "32px",
            padding: "10px 24px",
            background: "rgba(0,212,255,0.08)",
            border: "1px solid #00d4ff22",
            borderRadius: "8px",
            color: "#00d4ff",
            textDecoration: "none",
            fontSize: "11px",
            letterSpacing: "2px",
          }}
        >
          RETURN TO MISSION CONTROL
        </a>
      </motion.div>
    </div>
  );
}
