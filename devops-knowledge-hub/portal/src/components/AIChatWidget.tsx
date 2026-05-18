import React, {useState, useRef, useEffect} from 'react';

const API = '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  domain?: string;
  docIds?: number[];
  docId?: number | string;
  title?: string;
}

export default function AIChatWidget({domain, docIds, docId, title}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const effectiveDocIds = docIds ?? (docId != null ? [Number(docId)] : undefined);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const next: Message[] = [...messages, {role: 'user', content: text}];
    setMessages(next);
    setLoading(true);
    try {
      const history = next.slice(0, -1).map(m => ({role: m.role, parts: m.content}));
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          message: text,
          history,
          domain,
          doc_ids: effectiveDocIds,
          doc_id: effectiveDocIds?.[0],
        }),
      });
      const data = await res.json();
      // backend returns either 'response' or 'answer'
      const answer = data.response || data.answer || data.error || 'No response';
      setMessages([...next, {role: 'assistant', content: answer}]);
    } catch {
      setMessages([...next, {role: 'assistant', content: 'Error reaching backend.'}]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const label = title || (domain ? `Ask AI · ${domain}` : 'Ask AI');

  return (
    <div className="ai-chat-container">
      {open && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <span>🤖 {label}</span>
            <button
              onClick={() => setOpen(false)}
              style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem'}}
            >
              ✕
            </button>
          </div>
          <div className="ai-chat-messages" ref={messagesRef}>
            {messages.length === 0 && (
              <div style={{opacity: 0.4, fontSize: '0.82rem', textAlign: 'center', marginTop: '2rem'}}>
                Ask anything about your DevOps knowledge base
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-chat-message ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="ai-chat-message assistant" style={{opacity: 0.5}}>
                Thinking…
              </div>
            )}
          </div>
          <div className="ai-chat-input-row">
            <input
              className="ai-chat-input"
              placeholder="Ask a question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              autoFocus
            />
            <button className="ai-chat-send" onClick={send} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
      <button className="ai-chat-button" onClick={() => setOpen(o => !o)} title="Ask AI">
        {open ? '✕' : '🤖'}
      </button>
    </div>
  );
}
