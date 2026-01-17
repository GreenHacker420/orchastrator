"use client";

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Card, CardContent } from '@/components/ui/card';
import { AgentHeader } from './agent/AgentHeader';
import { AgentVisualizer } from './agent/AgentVisualizer';
import { AgentLogs } from './agent/AgentLogs';
import { AgentControls } from './agent/AgentControls';

// Audio Constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

export function SuperAgent() {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isGeminiConnected, setIsGeminiConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState([]);
  const [volume, setVolume] = useState(0);
  const [inputText, setInputText] = useState("");

  // Refs
  const socketRef = useRef(null);
  const recordingContextRef = useRef(null);
  const playbackContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const sourceRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);

  // --- Socket Initialization ---
  useEffect(() => {
    const socket = io('http://localhost:5050');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      addLog('System', 'Connected to Server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsGeminiConnected(false);
      addLog('System', 'Disconnected from Server');
    });

    socket.on('status', (data) => {
      if (data.message === 'Connected to Gemini') {
        setIsGeminiConnected(true);
      }
      addLog('System', data.message);
    });

    socket.on('audio', (data) => {
      playAudio(data.data);
    });

    socket.on('interrupted', () => {
      addLog('System', 'Interrupted by User');
      stopPlayback();
    });

    socket.on('transcript', (data) => {
      addLog(data.source, data.text);
    });

    socket.on('error', (err) => {
      addLog('Error', err.message);
    });

    return () => {
      socket.disconnect();
      stopStreaming();
    };
  }, []);

  // --- Utils ---
  const addLog = (source, message) => {
    setLogs(prev => {
      if (prev.length > 0) {
        const lastLog = prev[prev.length - 1];
        if (lastLog.source === source && (source === 'User (Voice)' || source === 'Model')) {
          return [...prev.slice(0, -1), { ...lastLog, message: lastLog.message + message }];
        }
      }
      return [...prev, { source, message, time: new Date().toLocaleTimeString() }];
    });
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    if (socketRef.current && isConnected) {
      socketRef.current.emit('text', { text: inputText });
      addLog('User (Text)', inputText);
      setInputText("");
    }
  };

  // --- Audio Streaming ---
  const startStreaming = async () => {
    try {
      if (!recordingContextRef.current) {
        recordingContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      }
      const ctx = recordingContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      try {
        await ctx.audioWorklet.addModule('/worklets/recorder.worklet.js');
      } catch (e) {
        addLog('Error', 'Failed to load audio processor');
        console.error('Worklet loading error:', e);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        }
      });

      sourceRef.current = ctx.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(ctx, 'recorder-worklet');

      workletNodeRef.current.port.onmessage = (event) => {
        const float32Data = event.data;

        // Volume calculation for visualizer
        let sum = 0;
        for (let i = 0; i < float32Data.length; i += 10) {
          sum += float32Data[i] * float32Data[i];
        }
        setVolume(Math.sqrt(sum / (float32Data.length / 10)) * 100);

        // Convert and stream
        const pcmData = floatTo16BitPCM(float32Data);
        const base64String = arrayBufferToBase64(pcmData);

        if (socketRef.current && isGeminiConnected) {
          socketRef.current.emit('audio', base64String);
        }
      };

      sourceRef.current.connect(workletNodeRef.current);
      workletNodeRef.current.connect(ctx.destination);

      setIsStreaming(true);
      addLog('User', 'Microphone Live');

    } catch (err) {
      console.error('Mic Error:', err);
      addLog('Error', 'Failed to access microphone');
    }
  };

  const stopStreaming = () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current.port.onmessage = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }
    setIsStreaming(false);
    setVolume(0);
    addLog('User', 'Microphone Muted');
  };

  const toggleStreaming = () => {
    if (isStreaming) stopStreaming();
    else startStreaming();
  };

  const stopPlayback = () => {
    if (activeSourcesRef.current.length > 0) {
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) { }
      });
      activeSourcesRef.current = [];
    }
    if (playbackContextRef.current) {
      nextStartTimeRef.current = playbackContextRef.current.currentTime;
    }
  };

  // --- Playback Helper ---
  const playAudio = async (base64Data) => {
    try {
      if (!playbackContextRef.current) {
        playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      }
      const ctx = playbackContextRef.current;
      const pcmData = base64ToArrayBuffer(base64Data);
      const floatData = int16ToFloat32(pcmData);
      const buffer = ctx.createBuffer(1, floatData.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(floatData, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      // Track active source
      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
      };

    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-3xl shadow-2xl border-zinc-200 dark:border-zinc-800 flex flex-col h-[85vh] backdrop-blur-sm bg-white/90 dark:bg-black/90">

        <AgentHeader
          isConnected={isConnected}
          isGeminiConnected={isGeminiConnected}
        />

        <CardContent className="flex-1 min-h-0 flex flex-col pt-6 gap-6 overflow-hidden">
          <AgentVisualizer
            isGeminiConnected={isGeminiConnected}
            volume={volume}
            isRecording={isStreaming}
          />
          <AgentLogs logs={logs} />
        </CardContent>

        <AgentControls
          isConnected={isConnected}
          inputText={inputText}
          setInputText={setInputText}
          handleSendText={handleSendText}
          isRecording={isStreaming}
          toggleRecording={toggleStreaming}
          volume={volume}
        />

      </Card>

      {/* Ambient background glow */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-white dark:bg-zinc-950">
        <div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen dark:mix-blend-lighten"></div>
      </div>
    </div>
  );
}

// --- Converters & Helpers ---
function floatTo16BitPCM(input) {
  let output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output.buffer;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes.buffer;
}

function int16ToFloat32(buffer) {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) { float32[i] = int16[i] / 32768.0; }
  return float32;
}
