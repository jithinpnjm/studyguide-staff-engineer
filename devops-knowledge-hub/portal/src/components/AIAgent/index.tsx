import React, { useState, useEffect, useRef, useCallback } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocation } from '@docusaurus/router';
import styles from './styles.module.css';

// ── System prompts ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_TEXT = `You are a Staff SRE with 15+ years of production experience across Linux, Kubernetes, AWS, observability, incident response, CI/CD, databases, networking, and platform engineering.

Answer from your full expertise. If the question relates to the current page, reference it — but never limit yourself to it.

Style:
- Mental model first, then the detail
- Concrete production examples: real failure modes, exact commands, actual tradeoffs
- Direct. No filler like "Great question!" or "Certainly!"
- Use markdown freely in text mode

Current page (reference only if relevant):
---
{PAGE_CONTEXT}
---`;

const SYSTEM_PROMPT_VOICE = `You are a Staff SRE having a live voice conversation. Be a natural, knowledgeable teacher.

Rules:
- Spoken sentences only — no bullet lists, no markdown, no code blocks
- 2–4 sentences unless the user asks for more
- Casual and confident, like explaining over a call with a colleague
- If you mention a command, say it in plain English: "run kubectl get pods"
- Never say "Great question" or "Certainly"
- End your answer with a short follow-up question

You have deep expertise in all SRE and DevOps topics. Answer anything the user asks.`;

// ── PCM helpers ────────────────────────────────────────────────────────────────

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output.buffer;
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
  return float32;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // chunk to avoid call stack overflow on large buffers
  for (let i = 0; i < bytes.byteLength; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'See the code in the chat.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type TextStatus = 'idle' | 'thinking';
type LiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking';

function getPageContext(): string {
  const article = document.querySelector('article');
  if (!article) return 'General SRE/DevOps topic.';
  const text = (article as HTMLElement).innerText || article.textContent || '';
  return text.slice(0, 2000).trim();
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AIAgent(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  const apiKey = (siteConfig.customFields?.geminiApiKey as string) || '';
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'voice'>('chat');

  // Text chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [textStatus, setTextStatus] = useState<TextStatus>('idle');
  const [textError, setTextError] = useState('');
  const [pageContext, setPageContext] = useState('');

  // Live voice state
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [liveError, setLiveError] = useState('');
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');

  // Live session refs
  const wsRef = useRef<WebSocket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const t = setTimeout(() => setPageContext(getPageContext()), 600);
    return () => clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, outputTranscript]);

  // Clean up live session when panel closes
  useEffect(() => {
    if (!isOpen && wsRef.current) stopLiveSession();
  }, [isOpen]);

  // ── Audio playback ───────────────────────────────────────────────────────────

  const playAudioChunk = useCallback((base64: string, sampleRate: number) => {
    if (!audioCtxRef.current) return;
    const float32 = base64ToFloat32(base64);
    const buffer = audioCtxRef.current.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtxRef.current.destination);

    const JITTER = 0.01;
    const startTime = Math.max(audioCtxRef.current.currentTime + JITTER, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
    audioQueueRef.current.push(source);

    source.onended = () => {
      audioQueueRef.current = audioQueueRef.current.filter((s) => s !== source);
      if (audioQueueRef.current.length === 0) setLiveStatus('listening');
    };
  }, []);

  const stopAllPlayback = useCallback(() => {
    audioQueueRef.current.forEach((s) => { try { s.stop(); } catch {} });
    audioQueueRef.current = [];
    const pb = playbackCtxRef.current;
    if (pb) nextStartTimeRef.current = pb.currentTime;
  }, []);

  // ── Live voice session (direct browser → Gemini Live WebSocket) ─────────────

  const stopLiveSession = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    stopAllPlayback();
    setLiveStatus('idle');
    setInputTranscript('');
  }, [stopAllPlayback]);

  const startLiveSession = useCallback(async () => {
    if (!apiKey) { setLiveError('No API key configured.'); return; }
    setLiveError('');
    setOutputTranscript('');
    setInputTranscript('');
    setLiveStatus('connecting');

    const INPUT_RATE = 16000;
    const OUTPUT_RATE = 24000;

    try {
      // ── Step 1: Get mic + create AudioContexts while inside the user gesture ──
      // Chrome suspends AudioContext created outside a user gesture.
      // Doing this here (button click handler) ensures they start in running state.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;

      const captureCtx: AudioContext = new AudioCtxClass({ sampleRate: INPUT_RATE });
      await captureCtx.resume();
      audioCtxRef.current = captureCtx;

      const playbackCtx: AudioContext = new AudioCtxClass({ sampleRate: OUTPUT_RATE });
      await playbackCtx.resume();
      playbackCtxRef.current = playbackCtx;
      nextStartTimeRef.current = playbackCtx.currentTime + 0.1;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // ── Step 2: Connect WebSocket ──────────────────────────────────────────
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
              },
            },
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT_VOICE }] },
          },
        }));
      };

      ws.onmessage = async (event) => {
        const text = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
        const msg = JSON.parse(text);

        if (msg.setupComplete) {
          // ── Step 3: Start sending mic audio — captureCtx already running ──
          const source = captureCtx.createMediaStreamSource(stream);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const processor = (captureCtx as any).createScriptProcessor(2048, 1, 1);
          processorRef.current = processor;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          processor.onaudioprocess = (e: any) => {
            if (ws.readyState === WebSocket.OPEN) {
              const b64 = arrayBufferToBase64(floatTo16BitPCM(e.inputBuffer.getChannelData(0)));
              ws.send(JSON.stringify({
                realtimeInput: {
                  mediaChunks: [{ mimeType: `audio/pcm;rate=${INPUT_RATE}`, data: b64 }],
                },
              }));
            }
          };

          // Connect source → processor only (NOT to destination — avoids mic echo)
          source.connect(processor);
          processor.connect(captureCtx.createGain()); // silent sink to keep processor alive
          setLiveStatus('listening');
          return;
        }

        const sc = msg.serverContent;
        if (!sc) return;

        if (sc.interrupted) {
          stopAllPlayback();
          setLiveStatus('listening');
        }
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              // Play on dedicated 24kHz playback context
              const pb = playbackCtxRef.current;
              if (pb) {
                const float32 = base64ToFloat32(part.inlineData.data);
                const buf = pb.createBuffer(1, float32.length, OUTPUT_RATE);
                buf.getChannelData(0).set(float32);
                const src = pb.createBufferSource();
                src.buffer = buf;
                src.connect(pb.destination);
                const JITTER = 0.01;
                const startTime = Math.max(pb.currentTime + JITTER, nextStartTimeRef.current);
                src.start(startTime);
                nextStartTimeRef.current = startTime + buf.duration;
                audioQueueRef.current.push(src);
                src.onended = () => {
                  audioQueueRef.current = audioQueueRef.current.filter((s) => s !== src);
                  if (audioQueueRef.current.length === 0) setLiveStatus('listening');
                };
                setLiveStatus('speaking');
              }
            }
            if (part.text) {
              setOutputTranscript((prev) => prev + ' ' + part.text);
            }
          }
        }
      };

      ws.onerror = () => {
        setLiveError('Connection to Gemini failed. Check your API key.');
        stopLiveSession();
      };
      ws.onclose = (e) => {
        if (e.code !== 1000) setLiveError(`Disconnected (${e.code}): ${e.reason || 'unknown'}`);
        stopLiveSession();
      };

    } catch (err: unknown) {
      setLiveError(err instanceof Error ? err.message : 'Failed to start session');
      stopLiveSession();
    }
  }, [apiKey, stopAllPlayback, stopLiveSession]);

  // ── Text chat ────────────────────────────────────────────────────────────────

  const sendTextMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || textStatus === 'thinking') return;
    if (!apiKey) {
      setTextError('No API key configured.');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setTextError('');
    setTextStatus('thinking');

    try {
      const ctx = pageContext || 'General SRE/DevOps question.';
      const systemPrompt = SYSTEM_PROMPT_TEXT.replace('{PAGE_CONTEXT}', ctx);
      const history = messagesRef.current;

      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          { role: 'user', parts: [{ text: trimmed }] },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );

      if (!res.ok) throw new Error(`Gemini error ${res.status}`);
      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      setTextError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTextStatus('idle');
    }
  }, [apiKey, pageContext, textStatus]);

  const isLiveActive = liveStatus !== 'idle';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setIsOpen((o) => !o)}
        title="AI SRE Tutor"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span>🤖 Staff SRE Tutor</span>
              <span className={styles.model}>Gemini 2.5</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={styles.clearBtn} onClick={() => { setMessages([]); setTextError(''); }} title="Clear chat">
                🗑
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabRow}>
            <button
              className={`${styles.tabBtn} ${tab === 'chat' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('chat')}
            >
              💬 Chat
            </button>
            <button
              className={`${styles.tabBtn} ${tab === 'voice' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('voice')}
            >
              🎙 Voice
            </button>
          </div>

          {!apiKey && (
            <div className={styles.warning}>
              ⚠️ No API key. Add <code>GEMINI_API_KEY</code> to GitHub secrets and redeploy.
            </div>
          )}

          {/* ── CHAT TAB ── */}
          {tab === 'chat' && (
            <>
              <div className={styles.messages}>
                {messages.length === 0 && (
                  <div className={styles.empty}>
                    <p>Ask me anything — Kubernetes, Linux, AWS, incident response, SRE practices.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                    <div className={styles.msgRole}>{m.role === 'user' ? 'You' : 'SRE Tutor'}</div>
                    <div className={styles.msgContent}>{m.content}</div>
                  </div>
                ))}
                {textStatus === 'thinking' && (
                  <div className={styles.assistantMsg}>
                    <div className={styles.msgRole}>SRE Tutor</div>
                    <div className={styles.msgContent}><span className={styles.dots}>●●●</span></div>
                  </div>
                )}
                {textError && <div className={styles.errorMsg}>{textError}</div>}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.inputRow}>
                <input
                  className={styles.textInput}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(input); }}}
                  placeholder="Ask anything..."
                  disabled={textStatus === 'thinking'}
                />
                <button
                  className={styles.sendBtn}
                  onClick={() => sendTextMessage(input)}
                  disabled={!input.trim() || textStatus === 'thinking'}
                >
                  ↑
                </button>
              </div>
            </>
          )}

          {/* ── VOICE TAB ── */}
          {tab === 'voice' && (
            <div className={styles.voicePanel}>
              {/* Status circle */}
              <div className={`${styles.voiceOrb} ${
                liveStatus === 'listening' ? styles.voiceOrbListening :
                liveStatus === 'speaking' ? styles.voiceOrbSpeaking :
                liveStatus === 'connecting' ? styles.voiceOrbConnecting : ''
              }`}>
                <span className={styles.voiceOrbIcon}>
                  {liveStatus === 'idle' ? '🎙' :
                   liveStatus === 'connecting' ? '⏳' :
                   liveStatus === 'listening' ? '👂' : '🔊'}
                </span>
              </div>

              <div className={styles.voiceStatusText}>
                {liveStatus === 'idle' && 'Press Start to talk with your SRE tutor'}
                {liveStatus === 'connecting' && 'Connecting...'}
                {liveStatus === 'listening' && 'Listening — speak freely'}
                {liveStatus === 'speaking' && 'Responding — interrupt anytime'}
              </div>

              {/* Live transcripts */}
              {(inputTranscript || outputTranscript) && (
                <div className={styles.transcriptBox}>
                  {inputTranscript && (
                    <div className={styles.transcriptYou}>
                      <span className={styles.transcriptLabel}>You</span> {inputTranscript}
                    </div>
                  )}
                  {outputTranscript && (
                    <div className={styles.transcriptAI}>
                      <span className={styles.transcriptLabel}>Tutor</span>
                      {stripMarkdown(outputTranscript)}
                    </div>
                  )}
                </div>
              )}

              {liveError && <div className={styles.errorMsg}>{liveError}</div>}

              <button
                className={`${styles.voiceStartBtn} ${isLiveActive ? styles.voiceStopBtn : ''}`}
                onClick={isLiveActive ? stopLiveSession : startLiveSession}
                disabled={liveStatus === 'connecting'}
              >
                {liveStatus === 'connecting' ? 'Connecting...' :
                 isLiveActive ? '⏹ End Session' : '🎙 Start Voice Session'}
              </button>

              <p className={styles.voiceHint}>
                Gemini Live — real-time neural audio, no backend needed
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
