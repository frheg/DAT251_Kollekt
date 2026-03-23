import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { AnimatedButton } from './ui/AnimatedButton';
import { Input } from './ui/input';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { formatTime, getAvatarToneClass, getInitials } from '../lib/ui';
import { EmptyState, PageHeader, PageStack, SectionCard } from './shared/page';
import type { ChatMessage } from '../lib/types';
import { Button } from './ui/button';

interface ChatProps {
  currentUserName: string;
}

function sortByTimestamp(left: ChatMessage, right: ChatMessage) {
  return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
}

function getMessageId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return null;
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

export function Chat({ currentUserName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const data = await api.get<ChatMessage[]>(
      `/chat/messages?memberName=${encodeURIComponent(currentUserName)}`,
    );
    setMessages(data.sort(sortByTimestamp));
  };

  useEffect(() => {
    void load();

    const disconnect = connectCollectiveRealtime(
      currentUserName,
      (event) => {
        if (event.type !== 'MESSAGE_CREATED') return;

        const payload = event.payload as ChatMessage | undefined;
        if (
          !payload ||
          typeof payload.sender !== 'string' ||
          typeof payload.text !== 'string' ||
          typeof payload.timestamp !== 'string'
        ) {
          void load();
          return;
        }

        setMessages((previous) => appendUniqueMessage(previous, payload));
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

    const createdMessage = await api.post<ChatMessage>('/chat/messages', {
      sender: currentUserName,
      text,
    });

    setMessages((previous) => appendUniqueMessage(previous, createdMessage));
    setNewMessage('');
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

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
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
                      className={`rounded-2xl px-4 py-3 shadow-sm ${
                        isMe
                          ? 'rounded-tr-md bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'rounded-tl-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
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

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <Input
            placeholder="Skriv en melding"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            className="bg-[var(--input-background)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          <Button variant="outline" className="sm:w-auto bg-[var(--muted)] border-[var(--border)] text-[var(--muted-foreground)]" type="submit">
            <Send className="size-4" />
            Send
          </Button>
        </form>
      </SectionCard>
    </PageStack>
  );
}
