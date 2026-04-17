import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, BarChart3, X, Smile, Reply } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { formatDateTime, formatTime } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { ChatMessage } from '../lib/types';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮'];

export default function ChatPage() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [reactingId, setReactingId] = useState<number | null>(null);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = currentUser?.name ?? '';
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const formatMessageTimestamp = (value: string) => {
    const messageDate = new Date(value);
    const now = new Date();
    const isToday =
      messageDate.getFullYear() === now.getFullYear() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getDate() === now.getDate();
    return isToday ? formatTime(value) : formatDateTime(value);
  };

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
        if (event.type === 'MEMBER_ONLINE' || event.type === 'MEMBER_OFFLINE') {
          const count = (event.payload as { count?: number })?.count;
          if (count !== undefined) setOnlineCount(count);
        }
      },
    );
    return disconnect;
  }, [name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input;
    const replyToMessageId = replyingToId;
    setInput('');
    setReplyingToId(null);
    await api.post('/chat/messages', { sender: name, text, replyToMessageId });
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Online indicator */}
      <div className="flex items-center gap-2 pt-4 pb-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <p className="text-[10px] text-muted-foreground">
          {t('common.live')} • {onlineCount > 0 ? t('chat.onlineCount', { count: onlineCount }) : t('common.connecting')}
        </p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((message, i) => {
          const isSelf = message.sender === name;
          const replyTarget = message.replyToMessageId != null ? messageById.get(message.replyToMessageId) : undefined;
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[80%] space-y-1">
                {replyTarget && (
                  <div
                    className={`mx-1 rounded-lg px-2.5 py-1.5 text-[10px] leading-tight border ${
                      isSelf
                        ? 'border-primary/25 bg-primary/10 text-foreground'
                        : 'border-border/60 bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className={`mb-1 flex items-center gap-1 ${isSelf ? 'text-primary/80' : 'text-muted-foreground'}`}>
                      <Reply className="h-2.5 w-2.5" />
                      <span>{t('chat.replyingTo', { name: replyTarget.sender })}</span>
                    </div>
                    <p className={`font-semibold ${isSelf ? 'text-foreground' : 'text-primary'}`}>{replyTarget.sender}</p>
                    <p className="truncate">{replyTarget.text || t('chat.imageAlt')}</p>
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 ${
                    isSelf ? 'gradient-primary text-primary-foreground rounded-br-md' : 'glass rounded-bl-md'
                  }`}
                  onClick={() => setReactingId(reactingId === message.id ? null : message.id)}
                >
                  {!isSelf && <p className="text-[10px] text-primary font-semibold mb-0.5">{message.sender}</p>}
                  {message.text && <p className="text-sm">{message.text}</p>}
                  {message.imageData && (
                    <img
                      src={`data:${message.imageMimeType};base64,${message.imageData}`}
                      alt={message.imageFileName ?? t('chat.imageAlt')}
                      className="rounded-lg mt-1 max-h-40 object-cover cursor-zoom-in"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedImage({
                          src: `data:${message.imageMimeType};base64,${message.imageData}`,
                          alt: message.imageFileName ?? t('chat.imageAlt'),
                        });
                      }}
                    />
                  )}
                  {message.poll && (
                    <div className="space-y-2 mt-1">
                      <p className="text-sm font-semibold">{message.poll.question}</p>
                      {message.poll.options.map((opt) => {
                        const total = message.poll!.options.reduce((s, o) => s + o.users.length, 0);
                        const votes = opt.users.length;
                        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                        const voted = opt.users.includes(name);
                        return (
                          <button key={opt.id} onClick={() => votePoll(message.id, opt.id)}
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
                    {formatMessageTimestamp(message.timestamp)}
                  </p>
                </div>

                <div className={`px-1 flex gap-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                  <button
                    onClick={() => setReplyingToId(message.id)}
                    className="h-6 w-6 rounded-full glass flex items-center justify-center"
                    aria-label={t('chat.replyToMessage')}
                  >
                    <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setReactingId(reactingId === message.id ? null : message.id)}
                    className="h-6 w-6 rounded-full glass flex items-center justify-center"
                    aria-label={t('chat.reactToMessage')}
                  >
                    <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                {message.reactions.length > 0 && (
                  <div className={`px-1 flex gap-1 flex-wrap ${isSelf ? 'justify-end' : 'justify-start'}`}>
                    {message.reactions.map((r) => {
                      const reacted = r.users.includes(name);
                      return (
                        <button key={r.emoji} onClick={() => toggleReaction(message.id, r.emoji)}
                          className={`text-xs px-1.5 py-0.5 rounded-full ${reacted ? 'bg-primary/20 border border-primary/30' : 'glass'}`}>
                          {r.emoji} {r.users.length}
                        </button>
                      );
                    })}
                  </div>
                )}

                <AnimatePresence>
                  {reactingId === message.id && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className={`px-1 flex gap-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(message.id, emoji)}
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
                <p className="text-xs font-semibold">{t('chat.createPoll')}</p>
                <button onClick={() => setShowPollForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)}
                placeholder={t('chat.pollQuestionPlaceholder')}
                className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              {pollOptions.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder={t('chat.pollOption', { index: i + 1 })}
                  className="w-full bg-muted/50 rounded-lg px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => setPollOptions((p) => [...p, ''])} className="text-[10px] text-primary font-medium">
                  {t('chat.addOption')}
                </button>
                <button onClick={sendPoll} className="ml-auto px-3 py-1 rounded-lg gradient-primary text-[10px] font-semibold text-primary-foreground">
                  {t('chat.sendPoll')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {replyingToId != null && messageById.get(replyingToId) && (
        <div className="glass rounded-lg px-3 py-2 mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-primary">{t('chat.replyingTo', { name: messageById.get(replyingToId)?.sender })}</p>
            <p className="text-xs truncate text-muted-foreground">{messageById.get(replyingToId)?.text || t('chat.imageAlt')}</p>
          </div>
          <button onClick={() => setReplyingToId(null)} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
            {t('chat.cancelReply')}
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-2 pt-2 pb-1">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
          className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); }} />
        <button onClick={() => fileInputRef.current?.click()} className="h-10 w-10 rounded-xl glass flex items-center justify-center shrink-0" aria-label={t('chat.sendImage')}>
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </button>
        <button onClick={() => setShowPollForm((v) => !v)} className="h-10 w-10 rounded-xl glass flex items-center justify-center shrink-0" aria-label={t('chat.togglePollForm')}>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={t('chat.messagePlaceholder')}
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={sendMessage} className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shrink-0" aria-label={t('common.send')}>
          <Send className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-0"
            onClick={() => setExpandedImage(null)}
          >
            <button
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              onClick={() => setExpandedImage(null)}
              aria-label={t('chat.closeImage')}
            >
              <X className="h-5 w-5 text-white" />
            </button>
            <img
              src={expandedImage.src}
              alt={expandedImage.alt}
              className="h-full w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
