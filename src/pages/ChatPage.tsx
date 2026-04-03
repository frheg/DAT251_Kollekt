import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, BarChart3, X, Smile } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { ChatMessage } from '../lib/types';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮'];

export default function ChatPage() {
  const { currentUser } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [reactingId, setReactingId] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = currentUser?.name ?? '';

  const fetchMessages = async () => {
    if (!name) return;
    const res = await api.get<ChatMessage[]>(`/chat/messages?memberName=${encodeURIComponent(name)}`);
    setMessages(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(
      name,
      (event) => {
        if (event.type === 'CHAT_MESSAGE' || event.type === 'CHAT_REACTION' || event.type === 'CHAT_POLL_VOTE') {
          fetchMessages();
        }
        if (event.type === 'MEMBER_ONLINE') setOnlineCount((c) => c + 1);
        if (event.type === 'MEMBER_OFFLINE') setOnlineCount((c) => Math.max(0, c - 1));
      },
      { onConnected: () => setOnlineCount(1) },
    );
    return disconnect;
  }, [name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await api.post('/chat/messages', { sender: name, text });
    fetchMessages();
  };

  const sendPoll = async () => {
    const opts = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) return;
    await api.post('/chat/polls', { question: pollQuestion, options: opts });
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollForm(false);
    fetchMessages();
  };

  const votePoll = async (messageId: number, optionId: number) => {
    await api.post(`/chat/messages/${messageId}/poll/vote`, { optionId });
    fetchMessages();
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const existing = msg?.reactions.find((r) => r.emoji === emoji);
    const alreadyReacted = existing?.users.includes(name);

    if (alreadyReacted) {
      await api.delete(`/chat/messages/${messageId}/reactions`, { emoji });
    } else {
      await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
    }
    setReactingId(null);
    fetchMessages();
  };

  const sendImage = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    if (input.trim()) {
      form.append('caption', input.trim());
      setInput('');
    }
    await api.postForm('/chat/images', form);
    fetchMessages();
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8.5rem)] pt-4 animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className={`glass rounded-2xl h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />)}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Online indicator */}
      <div className="flex items-center gap-2 pt-4 pb-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <p className="text-[10px] text-muted-foreground">
          Live • {onlineCount > 0 ? `${onlineCount} online` : 'connecting...'}
        </p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m, i) => {
          const isSelf = m.sender === name;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] space-y-1">
                <div
                  className={`rounded-2xl px-3.5 py-2.5 ${
                    isSelf ? 'gradient-primary text-primary-foreground rounded-br-md' : 'glass rounded-bl-md'
                  }`}
                  onClick={() => setReactingId(reactingId === m.id ? null : m.id)}
                >
                  {!isSelf && <p className="text-[10px] text-primary font-semibold mb-0.5">{m.sender}</p>}
                  {m.text && <p className="text-sm">{m.text}</p>}
                  {m.imageData && (
                    <img
                      src={`data:${m.imageMimeType};base64,${m.imageData}`}
                      alt={m.imageFileName ?? 'image'}
                      className="rounded-lg mt-1 max-h-40 object-cover"
                    />
                  )}
                  {m.poll && (
                    <div className="space-y-2 mt-1">
                      <p className="text-sm font-semibold">{m.poll.question}</p>
                      {m.poll.options.map((opt) => {
                        const total = m.poll!.options.reduce((s, o) => s + o.users.length, 0);
                        const votes = opt.users.length;
                        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                        const voted = opt.users.includes(name);
                        return (
                          <button key={opt.id} onClick={() => votePoll(m.id, opt.id)}
                            className={`w-full rounded-lg p-2 text-left text-xs font-medium relative overflow-hidden ${
                              voted ? 'bg-primary/30 border border-primary/40' : isSelf ? 'bg-background/20' : 'bg-muted/50'
                            }`}>
                            <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all" style={{ width: `${pct}%` }} />
                            <span className="relative">{opt.text} ({votes})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className={`text-[9px] mt-1 ${isSelf ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="px-1">
                  <button
                    onClick={() => setReactingId(reactingId === m.id ? null : m.id)}
                    className="h-6 w-6 rounded-full glass flex items-center justify-center"
                    aria-label="React to message"
                  >
                    <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Reactions */}
                {m.reactions.length > 0 && (
                  <div className="flex gap-1 px-1 flex-wrap">
                    {m.reactions.map((r) => {
                      const reacted = r.users.includes(name);
                      return (
                        <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)}
                          className={`text-xs px-1.5 py-0.5 rounded-full ${reacted ? 'bg-primary/20 border border-primary/30' : 'glass'}`}>
                          {r.emoji} {r.users.length}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reaction picker */}
                <AnimatePresence>
                  {reactingId === m.id && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className="flex gap-1 px-1">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                          className="text-lg hover:scale-125 transition-transform">
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Poll form */}
      <AnimatePresence>
        {showPollForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-3 space-y-2 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Create Poll</p>
                <button onClick={() => setShowPollForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Question..."
                className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {pollOptions.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder={`Option ${i + 1}`}
                  className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => setPollOptions((p) => [...p, ''])} className="text-[10px] text-primary font-medium">
                  + Add option
                </button>
                <button onClick={sendPoll} className="ml-auto px-3 py-1 rounded-lg gradient-primary text-[10px] font-semibold text-primary-foreground">
                  Send Poll
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="flex gap-2 pt-2 pb-1">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); }} />
        <button onClick={() => fileInputRef.current?.click()} className="h-10 w-10 rounded-xl glass flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </button>
        <button onClick={() => setShowPollForm((v) => !v)} className="h-10 w-10 rounded-xl glass flex items-center justify-center shrink-0">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={sendMessage} className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
          <Send className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>
    </motion.div>
  );
}
