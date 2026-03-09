"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  status: "modified" | "added" | "deleted" | "renamed";
}

interface SessionDiff {
  sessionId: string;
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
}

const MOCK_DIFFS: Record<string, SessionDiff> = {
  default: {
    sessionId: "default",
    files: [
      { path: "src/app/page.tsx", additions: 47, deletions: 12, status: "modified" },
      { path: "src/lib/api-security.ts", additions: 23, deletions: 8, status: "modified" },
      { path: "src/components/Analytics.tsx", additions: 156, deletions: 0, status: "added" },
      { path: "src/app/api/sessions/route.ts", additions: 18, deletions: 5, status: "modified" },
      { path: "docs/architecture.md", additions: 89, deletions: 0, status: "added" },
      { path: "src/utils/deprecated.ts", additions: 0, deletions: 42, status: "deleted" },
    ],
    totalAdditions: 333,
    totalDeletions: 67,
  },
};

function getStatusIcon(status: string): string {
  switch (status) {
    case "added": return "+";
    case "deleted": return "-";
    case "renamed": return "~";
    default: return "\u25CF";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "added": return "#00ff88";
    case "deleted": return "#ff6b6b";
    case "renamed": return "#f9c74f";
    default: return "#00d4ff";
  }
}

export default function DiffViewer({ sessionId, agentColor }: { sessionId: string; agentColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const diff = MOCK_DIFFS.default; // Use mock data

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "transparent",
          border: `1px solid ${agentColor}22`,
          borderRadius: "6px",
          padding: "4px 10px",
          color: `${agentColor}99`,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          letterSpacing: "1px",
          transition: "all 0.2s ease",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${agentColor}44`;
          e.currentTarget.style.background = `${agentColor}08`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `${agentColor}22`;
          e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ fontSize: "10px" }}>{expanded ? "\u25BC" : "\u25B6"}</span>
        DIFF
        <span style={{ color: "#00ff88", fontSize: "9px" }}>+{diff.totalAdditions}</span>
        <span style={{ color: "#ff6b6b", fontSize: "9px" }}>-{diff.totalDeletions}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              marginTop: "8px",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid #27272a",
              borderRadius: "8px",
              padding: "12px",
            }}>
              {/* Summary */}
              <div style={{
                display: "flex",
                gap: "16px",
                marginBottom: "10px",
                paddingBottom: "8px",
                borderBottom: "1px solid #1c1c1e",
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: "#71717a",
                }}>
                  {diff.files.length} files changed
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: "#00ff88",
                }}>
                  +{diff.totalAdditions}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: "#ff6b6b",
                }}>
                  -{diff.totalDeletions}
                </span>
              </div>

              {/* File list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {diff.files.map((file) => (
                  <div
                    key={file.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      color: getStatusColor(file.status),
                      width: "12px",
                      textAlign: "center",
                    }}>
                      {getStatusIcon(file.status)}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      color: "#a1a1aa",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {file.path}
                    </span>
                    {/* Change bar */}
                    <div style={{ display: "flex", gap: "1px", alignItems: "center" }}>
                      {file.additions > 0 && (
                        <div style={{
                          display: "flex",
                          gap: "1px",
                        }}>
                          {Array.from({ length: Math.min(Math.ceil(file.additions / 20), 8) }, (_, i) => (
                            <div
                              key={`a-${i}`}
                              style={{
                                width: "4px",
                                height: "10px",
                                background: "#00ff8866",
                                borderRadius: "1px",
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {file.deletions > 0 && (
                        <div style={{
                          display: "flex",
                          gap: "1px",
                        }}>
                          {Array.from({ length: Math.min(Math.ceil(file.deletions / 20), 8) }, (_, i) => (
                            <div
                              key={`d-${i}`}
                              style={{
                                width: "4px",
                                height: "10px",
                                background: "#ff6b6b66",
                                borderRadius: "1px",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px", minWidth: "55px", justifyContent: "flex-end" }}>
                      {file.additions > 0 && (
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "10px",
                          color: "#00ff88",
                        }}>
                          +{file.additions}
                        </span>
                      )}
                      {file.deletions > 0 && (
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "10px",
                          color: "#ff6b6b",
                        }}>
                          -{file.deletions}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
