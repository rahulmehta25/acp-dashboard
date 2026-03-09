"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function generateMockHeatmapData(): number[][] {
  const data: number[][] = [];
  for (let day = 0; day < 7; day++) {
    const row: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      // Simulate realistic patterns: more activity during work hours
      const isWeekday = day < 5;
      const isWorkHour = hour >= 9 && hour <= 18;
      const isLateNight = hour >= 22 || hour <= 5;

      let base = 0;
      if (isWeekday && isWorkHour) base = 0.5 + Math.random() * 0.5;
      else if (isWeekday && !isLateNight) base = 0.2 + Math.random() * 0.3;
      else if (isWeekday) base = Math.random() * 0.15;
      else if (!isLateNight) base = 0.1 + Math.random() * 0.25;
      else base = Math.random() * 0.08;

      row.push(Math.round(base * 100) / 100);
    }
    data.push(row);
  }
  return data;
}

const HEATMAP_DATA = generateMockHeatmapData();

function getCellColor(value: number): string {
  if (value === 0) return "rgba(39, 39, 42, 0.3)";
  if (value < 0.15) return "rgba(0, 212, 255, 0.1)";
  if (value < 0.3) return "rgba(0, 212, 255, 0.2)";
  if (value < 0.5) return "rgba(0, 212, 255, 0.35)";
  if (value < 0.7) return "rgba(0, 212, 255, 0.5)";
  if (value < 0.85) return "rgba(0, 212, 255, 0.65)";
  return "rgba(0, 212, 255, 0.8)";
}

export default function FleetHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      style={{ marginBottom: "40px" }}
    >
      <h2 style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "12px",
        color: "#52525b",
        letterSpacing: "4px",
        marginBottom: "16px",
        textTransform: "uppercase",
      }}>
        Fleet Activity Heatmap
      </h2>

      <div style={{
        background: "rgba(15, 15, 25, 0.6)",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "20px",
        overflowX: "auto",
      }}>
        {/* Hour labels */}
        <div style={{ display: "flex", marginLeft: "44px", marginBottom: "4px" }}>
          {HOURS.map((h) => (
            <div
              key={h}
              style={{
                flex: "1 0 0",
                minWidth: "20px",
                textAlign: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                color: "#3f3f46",
                letterSpacing: "0.5px",
              }}
            >
              {h % 3 === 0 ? `${h.toString().padStart(2, "0")}` : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, dayIndex) => (
          <div key={day} style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              color: "#52525b",
              width: "36px",
              textAlign: "right",
              letterSpacing: "1px",
            }}>
              {day.toUpperCase()}
            </span>
            <div style={{ display: "flex", flex: 1, gap: "2px" }}>
              {HOURS.map((hour) => {
                const value = HEATMAP_DATA[dayIndex][hour];
                const isHovered = hoveredCell?.day === dayIndex && hoveredCell?.hour === hour;
                return (
                  <motion.div
                    key={hour}
                    onMouseEnter={() => setHoveredCell({ day: dayIndex, hour })}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      flex: "1 0 0",
                      minWidth: "16px",
                      height: "18px",
                      background: getCellColor(value),
                      borderRadius: "2px",
                      cursor: "crosshair",
                      border: isHovered ? "1px solid #00d4ff66" : "1px solid transparent",
                      transition: "border-color 0.15s ease",
                      position: "relative",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Tooltip */}
        {hoveredCell && (
          <div style={{
            marginTop: "12px",
            padding: "8px 14px",
            background: "rgba(0, 0, 0, 0.5)",
            borderRadius: "6px",
            display: "inline-flex",
            gap: "16px",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              color: "#a1a1aa",
            }}>
              {DAYS[hoveredCell.day]} {hoveredCell.hour.toString().padStart(2, "0")}:00
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              color: "#00d4ff",
            }}>
              {Math.round(HEATMAP_DATA[hoveredCell.day][hoveredCell.hour] * 10)} sessions
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "12px",
          justifyContent: "flex-end",
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#3f3f46",
          }}>
            LESS
          </span>
          {[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map((v, i) => (
            <div
              key={i}
              style={{
                width: "12px",
                height: "12px",
                background: getCellColor(v),
                borderRadius: "2px",
              }}
            />
          ))}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#3f3f46",
          }}>
            MORE
          </span>
        </div>
      </div>
    </motion.div>
  );
}
