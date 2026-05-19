import React, { useState, useEffect, useRef, useCallback } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocation } from '@docusaurus/router';
import styles from './styles.module.css';

const SYSTEM_PROMPT = `You are a Staff SRE (Site Reliability Engineer) with 15+ years of production experience across Linux, Kubernetes, AWS, observability, incident response, platform engineering, CI/CD, databases, and networking.

Your teaching style:
- Direct and precise — no filler words, no hedging
- Give the mental model first, then the detail
- Use concrete production examples: real failure modes, exact commands, actual tradeoffs
- Challenge the learner: ask a follow-up question after explaining something
- When multiple root causes exist, enumerate them and help narrow down
- Treat the learner as a peer engineer who wants depth, not a tutorial

When the user asks about something on the page they are reading, reference that content directly.
If they say "explain this section" or "teach me this", use the page context below.

Current page content:
---
{PAGE_CONTEXT}
---`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Use 'any' to avoid conflicts with lib.dom.d.ts SpeechRecognition definitions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClass = new (...args: any[]) => any;

function getSpeechRecognition(): AnyClass | null {
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

export default function AIAgent(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiKey = (siteConfig.customFields?.geminiApiKey as string) || '';
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState('');
  const [pageContext, setPageContext] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  // Update page context on route change
  useEffect(() => {
    const t = setTimeout(() => setPageContext(getPageContext()), 600);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystemPrompt = useCallback(
    () => SYSTEM_PROMPT.replace('{PAGE_CONTEXT}', pageContext || 'No page context loaded yet.'),
    [pageContext],
  );

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Strip markdown symbols for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block omitted.')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\|[^\n]+\|/g, '')
      .replace(/[-*]\s/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.lang = 'en-US';

    // Pick a natural-sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural')),
    );
    if (preferred) utter.voice = preferred;

    utter.onend = () => setStatus('idle');
    utter.onerror = () => setStatus('idle');

    setStatus('speaking');
    window.speechSynthesis.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStatus('idle');
  }, []);

  const callGemini = useCallback(
    async (userMessage: string, currentMessages: Message[]): Promise<string> => {
      if (!apiKey) {
        return 'Gemini API key not configured. Add GEMINI_API_KEY to your GitHub repository secrets and redeploy.';
      }

      const allMessages: Message[] = [...currentMessages, { role: 'user', content: userMessage }];

      const body = {
        system_instruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: allMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    },
    [apiKey, buildSystemPrompt],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const trimmed = text.trim();

      setMessages((prev) => {
        const next = [...prev, { role: 'user' as const, content: trimmed }];
        setInput('');
        setError('');
        setStatus('thinking');

        // Use the snapshot of messages at send time for the API call
        callGemini(trimmed, prev)
          .then((reply) => {
            setMessages((m) => [...m, { role: 'assistant' as const, content: reply }]);
            setStatus('idle');
            if (autoSpeak) speak(reply);
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
            setStatus('idle');
          });

        return next;
      });
    },
    [callGemini, speak, autoSpeak],
  );

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    // If speaking, stop and start listening (interrupt)
    stopSpeaking();

    // Toggle off if already listening
    if (recognitionRef.current) {
      stopListening();
      setStatus('idle');
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      setError('Voice input not supported. Use Chrome or Edge.');
      return;
    }

    finalTranscriptRef.current = '';
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;      // don't stop on pauses
    recognition.interimResults = true;  // show words as you speak
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setStatus('listening');

    recognition.onresult = (event: {results: {isFinal: boolean; [n: number]: {transcript: string}}[]; resultIndex: number}) => {
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
      setInput((finalTranscriptRef.current + interim).trim());

      // Reset the silence timer — auto-send 2s after user stops speaking
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const captured = finalTranscriptRef.current.trim();
        stopListening();
        if (captured) {
          sendMessage(captured);
          setInput('');
        } else {
          setStatus('idle');
        }
      }, 2000);
    };

    recognition.onerror = (event: {error: string}) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
      stopListening();
      setStatus('idle');
    };

    recognition.onend = () => {
      // Only called when recognition stops naturally (e.g. network error)
      // The silence timer handles intentional stops
      if (recognitionRef.current) {
        recognitionRef.current = null;
        setStatus('idle');
      }
    };

    recognition.start();
  }, [stopSpeaking, stopListening, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
    stopSpeaking();
    stopListening();
    setInput('');
    setStatus('idle');
  };

  const statusLabel: Record<typeof status, string> = {
    idle: '',
    listening: '🎙 Listening — pause 2 s to send',
    thinking: '💭 Thinking...',
    speaking: '🔊 Speaking — click 🎙 to interrupt',
  };

  return (
    <>
      {/* Floating toggle button */}
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
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span>🤖 Staff SRE Tutor</span>
              <span className={styles.model}>Gemini 2.5</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={styles.clearBtn}
                onClick={() => setAutoSpeak((v) => !v)}
                title={autoSpeak ? 'Mute voice responses' : 'Enable voice responses'}
              >
                {autoSpeak ? '🔊' : '🔇'}
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

          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>Ask me anything about the page you're reading.</p>
                <p className={styles.hint}>
                  Click 🎙 to speak. Pause 2 s to auto-send. Click again to interrupt.
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
                <div className={styles.msgContent}>
                  <span className={styles.dots}>●●●</span>
                </div>
              </div>
            )}
            {error && <div className={styles.errorMsg}>{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {status !== 'idle' && (
            <div className={styles.statusBar}>{statusLabel[status]}</div>
          )}

          <div className={styles.inputRow}>
            <input
              className={styles.textInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === 'listening' ? '🎙 Listening...' : 'Ask a question...'
              }
              disabled={status === 'thinking'}
            />
            <button
              className={`${styles.iconBtn} ${status === 'listening' ? styles.active : ''} ${status === 'speaking' ? styles.interrupt : ''}`}
              onClick={startListening}
              title={
                status === 'listening'
                  ? 'Stop listening'
                  : status === 'speaking'
                  ? 'Interrupt and speak'
                  : 'Voice input'
              }
              disabled={status === 'thinking'}
            >
              🎙
            </button>
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
