import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Send, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import type { ChatMessage } from '../lib/types';

interface ChatProps {
  currentUserName: string;
}

export function Chat({ currentUserName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await api.get<ChatMessage[]>(`/chat/messages?memberName=${encodeURIComponent(currentUserName)}`);
      setMessages(data);
    };
    load();
  }, [currentUserName]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const created = await api.post<ChatMessage>('/chat/messages', { sender: currentUserName, text: newMessage });
    setMessages([...messages, created]);
    setNewMessage('');
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500'];
    return colors[name.length % colors.length];
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8" />
          <div>
            <h2 className="text-white mb-1">Kollektiv Chat</h2>
            <p className="text-blue-100 text-sm">Meldinger fra backend</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white/80 backdrop-blur max-h-[60vh] overflow-y-auto">
        <div className="space-y-4">
          {messages.map(message => {
            const isMe = message.sender === currentUserName;
            return (
              <div key={message.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar className={`w-8 h-8 ${getAvatarColor(message.sender)} flex-shrink-0`}>
                  <AvatarFallback className="text-white text-xs">{getInitials(message.sender)}</AvatarFallback>
                </Avatar>

                <div className={`flex-1 ${isMe ? 'flex flex-col items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{message.sender}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`inline-block p-3 rounded-lg max-w-md ${isMe ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                    <p>{message.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 bg-white/80 backdrop-blur">
        <div className="flex gap-2">
          <Input
            placeholder="Skriv en melding..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void sendMessage()}
            className="bg-white"
          />
          <Button onClick={() => void sendMessage()} className="bg-gradient-to-r from-purple-500 to-pink-500">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
