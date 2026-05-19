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
    if (audioCtxRef.current) nextStartTimeRef.current = audioCtxRef.current.currentTime;
  }, []);

  // ── Live voice session (WebSocket proxy via local backend) ──────────────────

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
    stopAllPlayback();
    setLiveStatus('idle');
    setInputTranscript('');
  }, [stopAllPlayback]);

  const startLiveSession = useCallback(async () => {
    setLiveError('');
    setOutputTranscript('');
    setInputTranscript('');
    setLiveStatus('connecting');

    try {
      const SAMPLE_RATE = 24000;

      // Derive WebSocket URL from the configured backend URL
      const httpBase =
        (typeof window !== 'undefined' && localStorage.getItem('devopshub_backend_url')) ||
        'http://localhost:8765';
      const wsUrl = httpBase.replace(/^http/, 'ws') + '/ws/live';

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setLiveStatus('listening');

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'audio' && msg.audio) {
          playAudioChunk(msg.audio, SAMPLE_RATE);
          setLiveStatus('speaking');
        } else if (msg.type === 'interrupted') {
          stopAllPlayback();
          setLiveStatus('listening');
        } else if (msg.type === 'transcription' && msg.text) {
          setOutputTranscript((prev) => prev + ' ' + msg.text);
        } else if (msg.type === 'error') {
          setLiveError(msg.message || 'Backend error');
          stopLiveSession();
        }
      };

      ws.onclose = () => stopLiveSession();
      ws.onerror = () => {
        setLiveError('Cannot connect to backend. Start the backend first.');
        stopLiveSession();
      };

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 8000);
        ws.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
        ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket error')); }, { once: true });
      });

      // Set up mic capture
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtxClass({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime + 0.1;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processor = (audioCtx as any).createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processor.onaudioprocess = (e: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const pcm = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
          const b64 = arrayBufferToBase64(pcm);
          wsRef.current.send(JSON.stringify({ type: 'audio', audio: b64 }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      setLiveError(msg);
      stopLiveSession();
    }
  }, [playAudioChunk, stopAllPlayback, stopLiveSession]);

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
                Powered by Gemini Live — real-time neural audio, voice: Puck
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
