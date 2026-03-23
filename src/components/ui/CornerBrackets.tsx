import type { ReactNode } from "react";

interface CornerBracketsProps {
  color?: string;
  children: ReactNode;
}

export function CornerBrackets({ color = "#00d4ff", children }: CornerBracketsProps) {
  const bracketStyle = {
    position: "absolute" as const,
    width: "12px",
    height: "12px",
    border: `1px solid ${color}33`,
  };
  return (
    <div style={{ position: "relative", padding: "2px" }}>
      <div style={{ ...bracketStyle, top: 0, left: 0, borderRight: "none", borderBottom: "none" }} />
      <div style={{ ...bracketStyle, top: 0, right: 0, borderLeft: "none", borderBottom: "none" }} />
      <div style={{ ...bracketStyle, bottom: 0, left: 0, borderRight: "none", borderTop: "none" }} />
      <div style={{ ...bracketStyle, bottom: 0, right: 0, borderLeft: "none", borderTop: "none" }} />
      {children}
    </div>
  );
}
