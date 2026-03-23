interface MetricProps {
  label: string;
  value: string;
  color: string;
}

export function Metric({ label, value, color }: MetricProps) {
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", letterSpacing: "2px", marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
