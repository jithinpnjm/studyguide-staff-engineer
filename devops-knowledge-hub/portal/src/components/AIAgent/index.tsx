import React, { useState, useEffect, useRef, useCallback } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocation } from '@docusaurus/router';
import styles from './styles.module.css';

const SYSTEM_PROMPT_TEXT = `You are a Staff SRE with 15+ years of production experience across Linux, Kubernetes, AWS, observability, incident response, CI/CD, databases, networking, and platform engineering.

Answer from your full expertise. If the question relates to the current page, you may reference it — but never limit yourself to it. Answer any SRE, DevOps, cloud, or engineering question the user has.

Style:
- Give the mental model first, then the detail
- Concrete production examples: real failure modes, exact commands, actual tradeoffs
- Be direct. No filler phrases like "Great question!" or "Certainly!"
- Use markdown freely — code blocks, bullet lists, headers are all fine in text mode

Current page (reference only if relevant):
---
{PAGE_CONTEXT}
---`;

const SYSTEM_PROMPT_VOICE = `You are a Staff SRE having a real conversation. The user is speaking to you and you must speak back naturally.

Rules for voice responses:
- Respond in plain spoken sentences only. No bullet points, no numbered lists, no headers, no code blocks, no markdown.
- Keep responses to 2–4 sentences unless the user explicitly asks for more detail.
- Sound like a senior engineer explaining something over Slack — casual, confident, clear.
- If you need to mention a command, say it in plain English like "run kubectl get pods" not a code block.
- Never start with "Great question" or "Certainly" or "Of course".
- After answering, ask one short follow-up question to keep the conversation going.

Answer from your full SRE expertise. Do not limit yourself to the page content.

Current page topic (for context only): {PAGE_CONTEXT}`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyInstance = any;

function getSpeechRecognitionClass(): (new () => AnyInstance) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function getPageContext(): string {
  const article = document.querySelector('article');
  if (!article) return 'No specific page content available.';
  const text = (article as HTMLElement).innerText || article.textContent || '';
  return text.slice(0, 3000).trim();
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

export default function AIAgent(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiKey = (siteConfig.customFields?.geminiApiKey as string) || '';
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [voiceMode, setVoiceMode] = useState(false);
  const [muteSpeak, setMuteSpeak] = useState(false);
  const [error, setError] = useState('');
  const [pageContext, setPageContext] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<AnyInstance>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');
  // Refs so callbacks always see current values without re-creating functions
  const voiceModeRef = useRef(false);
  const muteSpeakRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);

  // Keep refs in sync
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { muteSpeakRef.current = muteSpeak; }, [muteSpeak]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const t = setTimeout(() => setPageContext(getPageContext()), 600);
    return () => clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Speech synthesis ────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Forward-declared so speak can reference startListeningCore
  const startListeningCoreRef = useRef<() => void>(() => {});

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      // No TTS: if voice mode, restart listening directly
      if (voiceModeRef.current) setTimeout(() => startListeningCoreRef.current(), 300);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = stripMarkdown(text);
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.93;
    utter.pitch = 1.0;
    utter.lang = 'en-US';

    // Prefer natural-sounding voices: Mac built-ins first, then Google/Neural
    const voices = window.speechSynthesis.getVoices();
    const priority = ['Samantha', 'Karen', 'Moira', 'Daniel', 'Google US English', 'Google UK English Female'];
    const preferred =
      priority.reduce<SpeechSynthesisVoice | null>((found, name) => {
        if (found) return found;
        return voices.find((v) => v.name === name) || null;
      }, null) ||
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural'))) ||
      voices.find((v) => v.lang === 'en-US');
    if (preferred) utter.voice = preferred;

    utter.onstart = () => setStatus('speaking');

    utter.onend = () => {
      setStatus('idle');
      // Auto-restart listening in voice conversation mode
      if (voiceModeRef.current) {
        setTimeout(() => startListeningCoreRef.current(), 400);
      }
    };

    utter.onerror = () => {
      setStatus('idle');
      if (voiceModeRef.current) {
        setTimeout(() => startListeningCoreRef.current(), 400);
      }
    };

    setStatus('speaking');
    window.speechSynthesis.speak(utter);
  }, []);

  // ── Gemini API ──────────────────────────────────────────────────────────

  const buildSystemPrompt = useCallback(
    (isVoice: boolean) => {
      const template = isVoice ? SYSTEM_PROMPT_VOICE : SYSTEM_PROMPT_TEXT;
      const ctx = isVoice
        ? (pageContext ? pageContext.slice(0, 300) : 'general SRE/DevOps')
        : (pageContext || 'No page context loaded yet.');
      return template.replace('{PAGE_CONTEXT}', ctx);
    },
    [pageContext],
  );

  const callGemini = useCallback(async (userMessage: string, isVoice = false): Promise<string> => {
    if (!apiKey) return 'No Gemini API key. Add GEMINI_API_KEY to GitHub secrets and redeploy.';

    const history = messagesRef.current;
    const body = {
      system_instruction: { parts: [{ text: buildSystemPrompt(isVoice) }] },
      contents: [
        ...history.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
  }, [apiKey, buildSystemPrompt]);

  // ── Core send logic ─────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError('');
    setStatus('thinking');

    try {
      const reply = await callGemini(trimmed, voiceModeRef.current);
      const assistantMsg: Message = { role: 'assistant', content: reply };
      setMessages((prev) => [...prev, assistantMsg]);

      if (!muteSpeakRef.current) {
        speak(reply); // speak sets status to 'speaking', then restarts listening on end
      } else {
        setStatus('idle');
        if (voiceModeRef.current) setTimeout(() => startListeningCoreRef.current(), 300);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStatus('idle');
      if (voiceModeRef.current) setTimeout(() => startListeningCoreRef.current(), 500);
    }
  }, [callGemini, speak]);

  // ── Speech recognition ──────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // The core listen function — used both manually and for auto-restart
  const startListeningCore = useCallback(() => {
    stopListening();

    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      setError('Voice input not supported. Use Chrome or Edge.');
      return;
    }

    finalTranscriptRef.current = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: AnyInstance = new (SpeechRecognitionClass as any)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setStatus('listening');
    setInput('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscriptRef.current += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      const displayed = (finalTranscriptRef.current + interim).trim();
      setInput(displayed);

      // Reset silence timer — send 2s after last word
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const captured = finalTranscriptRef.current.trim();
        stopListening();
        if (captured) {
          sendMessage(captured);
        } else {
          setStatus('idle');
          // In voice mode, try again
          if (voiceModeRef.current) setTimeout(() => startListeningCoreRef.current(), 400);
        }
      }, 2000);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
      stopListening();
      setStatus('idle');
      // Auto-retry in voice mode (except for fatal errors)
      if (voiceModeRef.current && event.error !== 'not-allowed' && event.error !== 'service-not-allowed') {
        setTimeout(() => startListeningCoreRef.current(), 500);
      }
    };

    recognition.onend = () => {
      // Recognition stopped without onerror — can happen on Chrome due to inactivity
      if (recognitionRef.current) {
        recognitionRef.current = null;
        // In voice mode, auto-restart unless we're about to send
        if (voiceModeRef.current && !silenceTimerRef.current) {
          setStatus('idle');
          setTimeout(() => startListeningCoreRef.current(), 300);
        }
      }
    };

    try {
      recognition.start();
    } catch {
      setStatus('idle');
    }
  }, [stopListening, sendMessage]);

  // Keep the ref current
  useEffect(() => {
    startListeningCoreRef.current = startListeningCore;
  }, [startListeningCore]);

  // ── Voice mode toggle (the big mic button) ──────────────────────────────

  const toggleVoiceMode = useCallback(() => {
    if (voiceMode) {
      // Turn off
      setVoiceMode(false);
      voiceModeRef.current = false;
      stopListening();
      stopSpeaking();
      setStatus('idle');
      setInput('');
    } else {
      // Turn on — start the continuous loop
      setVoiceMode(true);
      voiceModeRef.current = true;
      setError('');
      startListeningCore();
    }
  }, [voiceMode, stopListening, stopSpeaking, startListeningCore]);

  // Interrupt: stop speaking, start listening immediately
  const interrupt = useCallback(() => {
    stopSpeaking();
    stopListening();
    startListeningCore();
  }, [stopSpeaking, stopListening, startListeningCore]);

  // ── Text input ──────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
    stopListening();
    stopSpeaking();
    setInput('');
    setStatus('idle');
    if (voiceMode) {
      setVoiceMode(false);
      voiceModeRef.current = false;
    }
  };

  // ── Status labels ───────────────────────────────────────────────────────

  const statusLabel: Record<typeof status, string> = {
    idle: voiceMode ? '⏳ Starting...' : '',
    listening: '🎙 Listening — pause to send',
    thinking: '💭 Thinking...',
    speaking: '🔊 Speaking — click interrupt to cut in',
  };

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setIsOpen((o) => !o)}
        title="AI SRE Tutor"
        aria-label="Open AI SRE Tutor"
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
              <button
                className={styles.clearBtn}
                onClick={() => setMuteSpeak((v) => !v)}
                title={muteSpeak ? 'Enable voice responses' : 'Mute voice responses'}
              >
                {muteSpeak ? '🔇' : '🔊'}
              </button>
              <button className={styles.clearBtn} onClick={clearChat} title="Clear chat">
                🗑
              </button>
            </div>
          </div>

          {!apiKey && (
            <div className={styles.warning}>
              ⚠️ No API key. Add <code>GEMINI_API_KEY</code> to GitHub secrets and redeploy.
            </div>
          )}

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>Ask me anything — Kubernetes, Linux, AWS, incident response, or anything SRE.</p>
                <p className={styles.hint}>
                  <strong>🎙 Start Conversation</strong> for hands-free voice mode. In voice mode I keep responses short and conversational.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                <div className={styles.msgRole}>{m.role === 'user' ? 'You' : 'SRE Tutor'}</div>
                <div className={styles.msgContent}>{m.content}</div>
              </div>
            ))}
            {status === 'thinking' && (
              <div className={styles.assistantMsg}>
                <div className={styles.msgRole}>SRE Tutor</div>
                <div className={styles.msgContent}><span className={styles.dots}>●●●</span></div>
              </div>
            )}
            {error && <div className={styles.errorMsg}>{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Status */}
          {(status !== 'idle' || voiceMode) && (
            <div className={`${styles.statusBar} ${status === 'listening' ? styles.statusListening : ''}`}>
              {statusLabel[status]}
            </div>
          )}

          {/* Voice conversation button */}
          <div className={styles.voiceRow}>
            <button
              className={`${styles.voiceBtn} ${voiceMode ? styles.voiceBtnActive : ''}`}
              onClick={toggleVoiceMode}
              disabled={status === 'thinking'}
              title={voiceMode ? 'End voice conversation' : 'Start voice conversation'}
            >
              {voiceMode ? '⏹ End Conversation' : '🎙 Start Conversation'}
            </button>
            {status === 'speaking' && (
              <button className={styles.interruptBtn} onClick={interrupt} title="Interrupt">
                ✋ Interrupt
              </button>
            )}
          </div>

          {/* Text input (always available) */}
          <div className={styles.inputRow}>
            <input
              className={styles.textInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === 'listening'
                  ? '🎙 Listening...'
                  : status === 'speaking'
                  ? '🔊 Agent speaking...'
                  : 'Or type a question...'
              }
              disabled={status === 'thinking'}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || status === 'thinking'}
              title="Send"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
