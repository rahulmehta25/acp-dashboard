export interface AcpSession {
  id: string;
  key: string;
  agent: string;
  status: string;
  task: string;
  mode: string;
  startedAt: string;
  elapsed: string;
  thread?: string;
  pid?: string;
  cwd?: string;
}

export interface GatewayInfo {
  status: string;
  pid: string | null;
  port: number;
  uptime: string | null;
}

export interface OpenClawConfig {
  maxConcurrent: number;
  defaultAgent: string;
  allowedAgents: string[];
  ttlMinutes: number;
  backend: string;
  dispatchEnabled: boolean;
}

export interface DashboardConfig {
  branding: { title: string; subtitle: string; version: string };
  refresh: { intervalMs: number; sessionHistoryLimit: number };
  notifications: { sound: boolean; onComplete: boolean; onError: boolean; volume: number };
  display: { showHistory: boolean; historyLimit: number; compactMode: boolean };
}

export interface DashboardData {
  gateway: GatewayInfo;
  sessions: AcpSession[];
  history: AcpSession[];
  timestamp: string;
  config: OpenClawConfig;
}

export interface SystemVitals {
  cpu: { usage: number; cores: number; model: string };
  memory: { usage: number; total: string; used: string; free: string };
  disk: { usage: number; total: string; used: string };
  load: { avg1: string; avg5: string; avg15: string };
  uptime: string;
  network: boolean;
  processes: number;
}

export interface StreamLine {
  type: string;
  line?: string;
  data?: string;
  timestamp: string;
}

export interface AgentTheme {
  color: string;
  glow: string;
  icon: string;
  label: string;
}

// Web Speech API Types
export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
