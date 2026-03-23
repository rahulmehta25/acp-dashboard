"use client";

import { useState, useCallback, useRef } from "react";
import { parseVoiceCommand } from "@/lib/utils";
import type { SpeechRecognitionEvent, SpeechRecognitionInstance } from "@/types";

export function useVoice(onCommand: (cmd: { action: string; agent?: string; target?: string }) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        const cmd = parseVoiceCommand(finalTranscript);
        if (cmd) {
          onCommand(cmd);
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Clean up audio stream when recognition ends
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setVoiceLevel(0);
      // Keep transcript visible for 3 seconds after recognition ends
      setTimeout(() => setTranscript(""), 3000);
      // If wake word is enabled, restart listening
      if (wakeWordEnabled) {
        setTimeout(() => startWakeWordListening(), 500);
      }
    };

    recognition.onerror = (e: Event) => {
      setIsListening(false);
      setTranscript(`Error: ${(e as ErrorEvent).message || "mic failed"}`);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setVoiceLevel(0);
      setTimeout(() => setTranscript(""), 3000);
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Start audio level monitoring
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioStreamRef.current = stream;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVoiceLevel(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    }).catch(() => {});
  }, [onCommand, wakeWordEnabled]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setVoiceLevel(0);
  }, []);

  const startWakeWordListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.toLowerCase();
        if (text.includes("hey jarvis") || text.includes("jarvis")) {
          recognition.stop();
          startListening();
          return;
        }
      }
    };

    recognition.onend = () => {
      if (wakeWordEnabled && !isListening) {
        setTimeout(() => startWakeWordListening(), 500);
      }
    };

    recognition.onerror = () => {};

    recognition.start();
  }, [wakeWordEnabled, isListening, startListening]);

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);
    try {
      // Try ElevenLabs first
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (response.ok && response.headers.get("Content-Type")?.includes("audio")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
        return;
      }
    } catch { /* fall through to browser TTS */ }

    // Fallback: browser speech synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      utterance.volume = 0.8;
      // Try to find a deep male voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.name.includes("Daniel") || v.name.includes("Alex") || v.name.includes("Google UK English Male"));
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  }, []);

  const toggleWakeWord = useCallback(() => {
    if (wakeWordEnabled) {
      setWakeWordEnabled(false);
      stopListening();
    } else {
      setWakeWordEnabled(true);
      startWakeWordListening();
    }
  }, [wakeWordEnabled, stopListening, startWakeWordListening]);

  return {
    isListening,
    isSpeaking,
    voiceLevel,
    transcript,
    wakeWordEnabled,
    startListening,
    stopListening,
    speak,
    toggleWakeWord,
  };
}
