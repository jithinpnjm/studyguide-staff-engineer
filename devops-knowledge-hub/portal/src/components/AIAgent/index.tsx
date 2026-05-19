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

// Web Speech API typings (not in standard TS lib)
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    transcript: string;
  }
}

function getPageContext(): string {
  // Read the main article content from the Docusaurus layout
  const article = document.querySelector('article');
  if (!article) return 'No specific page content available.';
  const text = article.innerText || article.textContent || '';
  // Trim to ~3000 chars to stay within context limits
  return text.slice(0, 3000).trim();
}

export default function AIAgent(): JSX.Element | null {
  const { siteConfig } = useDocusaurusContext();
  const apiKey = (siteConfig.customFields?.geminiApiKey as string) || '';
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [error, setError] = useState('');
  const [pageContext, setPageContext] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Update page context on route change
  useEffect(() => {
    // Small delay to let Docusaurus render the new page
    const t = setTimeout(() => setPageContext(getPageContext()), 500);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystemPrompt = useCallback(() => {
    return SYSTEM_PROMPT.replace('{PAGE_CONTEXT}', pageContext || 'No page context loaded yet.');
  }, [pageContext]);

  const callGemini = useCallback(async (userMessage: string): Promise<string> => {
    if (!apiKey) {
      return 'Gemini API key not configured. Add GEMINI_API_KEY to your GitHub repository secrets and redeploy.';
    }

    const allMessages: Message[] = [...messages, { role: 'user', content: userMessage }];

    const body = {
      system_instruction: {
        parts: [{ text: buildSystemPrompt() }],
      },
      contents: allMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
  }, [apiKey, messages, buildSystemPrompt]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Split into sentences to allow interruption between chunks
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.lang = 'en-US';
    utter.onend = () => setStatus('idle');
    utter.onerror = () => setStatus('idle');
    speechSynthRef.current = utter;
    setStatus('speaking');
    window.speechSynthesis.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStatus('idle');
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError('');
    setStatus('thinking');

    try {
      const reply = await callGemini(text.trim());
      const assistantMsg: Message = { role: 'assistant', content: reply };
      setMessages((prev) => [...prev, assistantMsg]);
      setStatus('idle');
      // Auto-speak only in voice mode
      if (status === 'listening' || recognitionRef.current) {
        speak(reply);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('idle');
    }
  }, [callGemini, speak, status]);

  const startListening = useCallback(() => {
    stopSpeaking();

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError('Voice input not supported in this browser. Use Chrome or Edge.');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
      setStatus('idle');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    setStatus('listening');

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onresult = (event) => {
      finalTranscript = '';
      interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setInput(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
      recognitionRef.current = null;
      setStatus('idle');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (finalTranscript.trim()) {
        sendMessage(finalTranscript.trim());
      } else {
        setStatus('idle');
      }
    };

    recognition.start();
  }, [stopSpeaking, sendMessage]);

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
  };

  const statusLabel: Record<typeof status, string> = {
    idle: '',
    listening: '🎙 Listening...',
    thinking: '💭 Thinking...',
    speaking: '🔊 Speaking...',
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

      {/* Chat panel */}
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span>🤖 Staff SRE Tutor</span>
              <span className={styles.model}>Gemini</span>
            </div>
            <button className={styles.clearBtn} onClick={clearChat} title="Clear chat">
              🗑
            </button>
          </div>

          {!apiKey && (
            <div className={styles.warning}>
              ⚠️ No API key configured. Add <code>GEMINI_API_KEY</code> to GitHub secrets.
            </div>
          )}

          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>Ask me anything about the page you're reading.</p>
                <p className={styles.hint}>
                  Try: <em>"Explain this section"</em> or <em>"What's the difference between X and Y?"</em>
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
              ref={inputRef}
              className={styles.textInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={status === 'listening' ? 'Listening...' : 'Ask a question...'}
              disabled={status === 'thinking'}
            />
            <button
              className={`${styles.iconBtn} ${status === 'listening' ? styles.active : ''}`}
              onClick={startListening}
              title={status === 'listening' ? 'Stop listening' : 'Voice input'}
              disabled={status === 'thinking'}
            >
              🎙
            </button>
            {status === 'speaking' && (
              <button
                className={styles.iconBtn}
                onClick={stopSpeaking}
                title="Stop speaking"
              >
                ⏹
              </button>
            )}
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
