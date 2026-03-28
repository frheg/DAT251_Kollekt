import { useEffect, useRef, useState } from 'react';
import { BarChart3, ImagePlus, MessageSquare, Plus, Send, X } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { api, getUserMessage } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { formatTime, getAvatarToneClass, getInitials } from '../lib/ui';
import { EmptyState, PageHeader, PageStack, SectionCard } from './shared/page';
import type { ChatMessage } from '../lib/types';
import { Button } from './ui/button';

interface ChatProps {
  currentUserName: string;
}

const REACTIONS = ['👍', '❤️', '😂', '🎉', '😮'] as const;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

function sortByTimestamp(left: ChatMessage, right: ChatMessage) {
  return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
}

function getMessageId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return null;
}

function isChatMessagePayload(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.sender === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.timestamp === 'string' &&
    Array.isArray(candidate.reactions)
  );
}

function appendUniqueMessage(previous: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const incomingKey = getMessageId((incoming as { id?: unknown }).id);

  if (incomingKey) {
    const exists = previous.some(
      (message) => getMessageId((message as { id?: unknown }).id) === incomingKey,
    );
    if (exists) return previous;
  } else {
    const exists = previous.some(
      (message) =>
        message.sender === incoming.sender &&
        message.text === incoming.text &&
        message.timestamp === incoming.timestamp,
    );
    if (exists) return previous;
  }

  return [...previous, incoming].sort(sortByTimestamp);
}

function mergeMessage(previous: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const withoutIncoming = previous.filter((message) => message.id !== incoming.id);
  return [...withoutIncoming, incoming].sort(sortByTimestamp);
}

function getReactionCount(message: ChatMessage, emoji: string) {
  return message.reactions?.find((reaction) => reaction.emoji === emoji)?.users.length ?? 0;
}

function hasUserReacted(message: ChatMessage, emoji: string, userName: string) {
  return message.reactions?.some(
    (reaction) => reaction.emoji === emoji && reaction.users.includes(userName),
  );
}

function getChatImageSrc(message: ChatMessage): string | null {
  const rawData = message.imageData?.trim();
  if (!rawData) return null;

  if (rawData.startsWith('data:')) {
    return rawData;
  }

  const mimeType = message.imageMimeType?.trim().toLowerCase();
  if (!mimeType) return null;

  const normalizedData = rawData.replace(/\s+/g, '');
  return `data:${mimeType};base64,${normalizedData}`;
}

export function Chat({ currentUserName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      const data = await api.get<ChatMessage[]>(
        `/chat/messages?memberName=${encodeURIComponent(currentUserName)}`,
      );
      setMessages(data.sort(sortByTimestamp));
      setSubmitError('');
    } catch (error) {
      setSubmitError(getUserMessage(error, 'Kunne ikke laste chatten akkurat nå.'));
    }
  };

  useEffect(() => {
    void load();

    const disconnect = connectCollectiveRealtime(
      currentUserName,
      (event) => {
        if (event.type === 'MESSAGE_CREATED') {
          const payload = event.payload;
          if (!isChatMessagePayload(payload)) {
            void load();
            return;
          }
          setMessages((previous) => appendUniqueMessage(previous, payload));
          return;
        }

        if (event.type === 'MESSAGE_REACTION_UPDATED' || event.type === 'MESSAGE_POLL_UPDATED') {
          const payload = event.payload as ChatMessage | undefined;
          if (!payload || typeof payload.id !== 'number') return;
          setMessages((previous) => mergeMessage(previous, payload));
        }
      },
      {
        onConnected: () => {
          void load();
        },
      },
    );

    return disconnect;
  }, [currentUserName]);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text) return;

    try {
      const createdMessage = await api.post<ChatMessage>('/chat/messages', {
        sender: currentUserName,
        text,
      });

      setMessages((previous) => appendUniqueMessage(previous, createdMessage));
      setNewMessage('');
      setSubmitError('');
    } catch (error) {
      setSubmitError(getUserMessage(error, 'Kunne ikke sende melding akkurat nå.'));
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    const reacted = hasUserReacted(message, emoji, currentUserName);

    try {
      const updated = reacted
        ? await api.delete<ChatMessage>(`/chat/messages/${message.id}/reactions`, { emoji })
        : await api.post<ChatMessage>(`/chat/messages/${message.id}/reactions`, { emoji });

      setMessages((previous) => mergeMessage(previous, updated));
      setSubmitError('');
    } catch (error) {
      setSubmitError(getUserMessage(error, 'Kunne ikke oppdatere reaksjonen akkurat nå.'));
    }
  };

  const openImagePicker = () => {
    if (isUploadingImage) return;
    fileInputRef.current?.click();
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSubmitError('Velg en bildefil (png, jpg, webp, osv.).');
      return;
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
      setSubmitError('Filtypen støttes ikke i chatten. Bruk JPG, JPEG, PNG, WEBP, GIF eller HEIC.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const caption = newMessage.trim();
    if (caption.length > 0) {
      formData.append('caption', caption);
    }

    try {
      setIsUploadingImage(true);
      const created = await api.postForm<ChatMessage>('/chat/images', formData);
      setMessages((previous) => appendUniqueMessage(previous, created));
      setNewMessage('');
      setSubmitError('');
    } catch (error) {
      setSubmitError(getUserMessage(error, 'Kunne ikke laste opp bildet akkurat nå.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const createPoll = async () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter((option) => option.length > 0);

    if (!question || options.length < 2) return;

    try {
      const created = await api.post<ChatMessage>('/chat/polls', { question, options });
      setMessages((previous) => appendUniqueMessage(previous, created));

      setShowPollComposer(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setSubmitError('');
    } catch (error) {
      setSubmitError(getUserMessage(error, 'Kunne ikke lage avstemningen akkurat nå.'));
    }
  };

  const votePoll = async (messageId: number, optionId: number) => {
    try {
      const updated = await api.post<ChatMessage>(`/chat/messages/${messageId}/poll/vote`, { optionId });
      setMessages((previous) => mergeMessage(previous, updated));
      setSubmitError('');
    } catch (error) {
      setSubmitError(getUserMessage(error, 'Kunne ikke registrere stemmen akkurat nå.'));
    }
  };

  return (
    <PageStack>
      <PageHeader
        icon={MessageSquare}
        eyebrow="Samtaler"
        title="Felles chat"
        description="Bruk samtalen til raske avklaringer, påminnelser og det som ikke trenger et eget møte."
      >
        <div className="max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--muted)] px-4 py-4 shadow-sm">
          <p className="text-sm text-[var(--muted-foreground)]">Sist aktiv</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">
            {messages.length > 0
              ? formatTime(messages[messages.length - 1].timestamp)
              : 'Ingen meldinger enda'}
          </p>
        </div>
      </PageHeader>

      <SectionCard title="Samtalen" description="Nye meldinger legger seg nederst automatisk.">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Det er stille her enn så lenge"
            description="Send den første meldingen for å få i gang praten."
          />
        ) : (
          <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
            {messages.map((message) => {
              const isMe = message.sender === currentUserName;
              const imageSrc = getChatImageSrc(message);

              return (
                <div key={message.id} className={`group flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <Avatar className={`size-9 ${getAvatarToneClass(message.sender)}`}>
                      <AvatarFallback>{getInitials(message.sender)}</AvatarFallback>
                    </Avatar>
                  )}

                  <div className={`max-w-[min(34rem,85%)] space-y-1 ${isMe ? 'items-end' : ''}`}>
                    <div
                      className={`flex items-center gap-2 text-xs text-[var(--muted-foreground)] ${
                        isMe ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span>{isMe ? 'Deg' : message.sender}</span>
                      <span>{formatTime(message.timestamp)}</span>
                    </div>

                    <div
                      className={`w-fit max-w-full overflow-hidden rounded-2xl px-4 py-3 shadow-sm ${
                        isMe
                          ? 'rounded-tr-md bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'rounded-tl-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]'
                      }`}
                    >
                      {!message.poll && message.text && (
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                      )}

                      {!message.poll && imageSrc && (
                        <button
                          type="button"
                          className="mt-2 inline-block max-w-full text-left"
                          onClick={() =>
                            setExpandedImage({
                              src: imageSrc,
                              alt: message.imageFileName ?? 'Opplastet bilde',
                            })
                          }
                          aria-label="Åpne bilde i stor visning"
                        >
                          <span className="inline-block max-w-[min(22rem,62vw)] overflow-hidden rounded-xl">
                            <img
                              src={imageSrc}
                              alt="Opplastet bilde"
                              className="block h-auto max-h-[18rem] w-auto max-w-full object-contain"
                              loading="lazy"
                            />
                          </span>
                        </button>
                      )}

                      {message.poll && (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 text-[var(--foreground)]">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{message.poll.question}</p>
                          <div className="mt-2 space-y-2">
                            {message.poll.options.map((option) => {
                              const votes = option.users.length;
                              const totalVotes =
                                message.poll?.options.reduce((sum, item) => sum + item.users.length, 0) ?? 0;
                              const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                              const votedByMe = option.users.includes(currentUserName);

                              return (
                                <button
                                  key={`${message.id}-poll-${option.id}`}
                                  type="button"
                                  onClick={() => void votePoll(message.id, option.id)}
                                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm text-[var(--foreground)] ${
                                    votedByMe
                                      ? 'border-[var(--primary)] bg-[var(--primary)]/15'
                                      : 'border-[var(--border)] bg-[var(--card)]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[var(--foreground)]">{option.text}</span>
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      {votes} stemmer · {percent}%
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                        isMe ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {REACTIONS.map((emoji) => {
                        const reacted = hasUserReacted(message, emoji, currentUserName);
                        return (
                          <button
                            key={`${message.id}-${emoji}-picker`}
                            type="button"
                            onClick={() => void toggleReaction(message, emoji)}
                            className={`rounded-full border px-2 py-1 text-sm transition ${
                              reacted
                                ? 'border-[var(--primary)] bg-[var(--primary)]/15'
                                : 'border-[var(--border)] bg-[var(--muted)] hover:bg-[var(--accent)]'
                            }`}
                            aria-label={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>

                    <div className={`flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {REACTIONS.filter((emoji) => getReactionCount(message, emoji) > 0).map((emoji) => {
                        const count = getReactionCount(message, emoji);
                        const reacted = hasUserReacted(message, emoji, currentUserName);

                        return (
                          <button
                            key={`${message.id}-${emoji}-count`}
                            type="button"
                            onClick={() => void toggleReaction(message, emoji)}
                            className={`rounded-full border px-2 py-1 text-xs ${
                              reacted
                                ? 'border-[var(--primary)] bg-[var(--primary)]/15'
                                : 'border-[var(--border)] bg-[var(--muted)]'
                            }`}
                            aria-label={`Toggle ${emoji} reaction`}
                          >
                            <span>{emoji}</span>
                            <span className="ml-1">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isMe && (
                    <Avatar className={`size-9 ${getAvatarToneClass(message.sender)}`}>
                      <AvatarFallback>{getInitials(message.sender)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}
            <div ref={bottomAnchorRef} />
          </div>
        )}

        {showPollComposer && (
          <div className="mb-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Ny avstemning</p>
              <button
                type="button"
                onClick={() => setShowPollComposer(false)}
                className="text-[var(--muted-foreground)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <Input
              placeholder="Spørsmål"
              value={pollQuestion}
              onChange={(event) => setPollQuestion(event.target.value)}
            />

            {pollOptions.map((option, index) => (
              <Input
                key={`poll-option-${index}`}
                placeholder={`Alternativ ${index + 1}`}
                value={option}
                onChange={(event) => {
                  const next = [...pollOptions];
                  next[index] = event.target.value;
                  setPollOptions(next);
                }}
              />
            ))}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPollOptions((prev) => (prev.length < 6 ? [...prev, ''] : prev))}
              >
                <Plus className="size-4" />
                Alternativ
              </Button>
              <Button type="button" onClick={() => void createPoll()}>
                <BarChart3 className="size-4" />
                Lag poll
              </Button>
            </div>
          </div>
        )}

        {submitError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

        {expandedImage && (
          <div
            className="fixed inset-0 z-50 overflow-hidden bg-black/85 p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Bildevisning"
            onClick={() => setExpandedImage(null)}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
              onClick={() => setExpandedImage(null)}
              aria-label="Lukk bildevisning"
            >
              <X className="size-5" />
            </button>
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <img
                src={expandedImage.src}
                alt={expandedImage.alt}
                className="block h-full w-full rounded-xl object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </div>
        )}

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadImage(file);
              }
              event.target.value = '';
            }}
          />

          <Input
            placeholder="Skriv en melding"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            className="bg-[var(--input-background)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />

          <Button
            type="button"
            variant="outline"
            className="sm:w-auto bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]"
            onClick={() => setShowPollComposer((prev) => !prev)}
          >
            <BarChart3 className="size-4" />
            Poll
          </Button>

          <Button
            type="button"
            variant="outline"
            className="sm:w-auto bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]"
            onClick={openImagePicker}
            disabled={isUploadingImage}
          >
            <ImagePlus className="size-4" />
            {isUploadingImage ? 'Laster opp...' : 'Bilde'}
          </Button>

          <Button
            variant="outline"
            className="sm:w-auto bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]"
            type="submit"
            disabled={isUploadingImage}
          >
            <Send className="size-4" />
            Send
          </Button>
        </form>
      </SectionCard>
    </PageStack>
  );
}
