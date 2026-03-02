import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Send, ThumbsUp, ThumbsDown, BarChart3, MessageSquare } from 'lucide-react';
import { Progress } from './ui/progress';

interface Message {
  id: number;
  sender: string;
  text: string;
  timestamp: string;
  type: 'message' | 'poll';
  poll?: {
    question: string;
    options: { id: number; text: string; votes: number }[];
    totalVotes: number;
  };
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'Fredric',
      text: 'Hei! Noen som vil ha filmkveld på onsdag?',
      timestamp: '14:23',
      type: 'message',
    },
    {
      id: 2,
      sender: 'Emma',
      text: 'Ja! Hva skal vi se?',
      timestamp: '14:25',
      type: 'message',
    },
    {
      id: 3,
      sender: 'Kasper',
      text: '',
      timestamp: '14:30',
      type: 'poll',
      poll: {
        question: 'Hvilken film skal vi se?',
        options: [
          { id: 1, text: 'Dune 2', votes: 3 },
          { id: 2, text: 'Oppenheimer', votes: 2 },
          { id: 3, text: 'Barbie', votes: 1 },
        ],
        totalVotes: 6,
      },
    },
    {
      id: 4,
      sender: 'Lars',
      text: 'Stemmer for Dune 2! 🍿',
      timestamp: '14:32',
      type: 'message',
    },
    {
      id: 5,
      sender: 'Emma',
      text: '',
      timestamp: '16:45',
      type: 'poll',
      poll: {
        question: 'Er det greit med fest på lørdag?',
        options: [
          { id: 1, text: '👍 Ja, kjør på!', votes: 5 },
          { id: 2, text: '👎 Nei, har eksamen', votes: 1 },
        ],
        totalVotes: 6,
      },
    },
  ]);

  const [newMessage, setNewMessage] = useState('');

  const sendMessage = () => {
    if (newMessage.trim()) {
      setMessages([
        ...messages,
        {
          id: Date.now(),
          sender: 'Deg',
          text: newMessage,
          timestamp: new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
          type: 'message',
        },
      ]);
      setNewMessage('');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-red-500',
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8" />
          <div>
            <h2 className="text-white mb-1">Kollektiv Chat</h2>
            <p className="text-blue-100 text-sm">8 medlemmer • 5 online</p>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button className="bg-white/80 backdrop-blur text-gray-700 hover:bg-white border-2 border-gray-200">
          <BarChart3 className="w-4 h-4 mr-2" />
          Ny avstemning
        </Button>
        <Button className="bg-white/80 backdrop-blur text-gray-700 hover:bg-white border-2 border-gray-200">
          <ThumbsUp className="w-4 h-4 mr-2" />
          Quick poll
        </Button>
      </div>

      {/* Messages */}
      <Card className="p-4 bg-white/80 backdrop-blur max-h-[60vh] overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message) => {
            const isMe = message.sender === 'Deg';
            
            if (message.type === 'poll' && message.poll) {
              return (
                <div key={message.id} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Avatar className={`w-6 h-6 ${getAvatarColor(message.sender)}`}>
                      <AvatarFallback className="text-white text-xs">
                        {getInitials(message.sender)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{message.sender}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400">{message.timestamp}</span>
                  </div>
                  
                  <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                      <h4 className="text-purple-900">{message.poll.question}</h4>
                    </div>
                    
                    <div className="space-y-2">
                      {message.poll.options.map((option) => {
                        const percentage = message.poll!.totalVotes > 0 
                          ? (option.votes / message.poll!.totalVotes) * 100 
                          : 0;
                        
                        return (
                          <button
                            key={option.id}
                            className="w-full text-left p-3 rounded-lg bg-white hover:bg-purple-50 border-2 border-purple-200 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span>{option.text}</span>
                              <Badge variant="secondary">{option.votes} {option.votes === 1 ? 'stemme' : 'stemmer'}</Badge>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </button>
                        );
                      })}
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-3">
                      {message.poll.totalVotes} {message.poll.totalVotes === 1 ? 'stemme' : 'stemmer'} totalt
                    </p>
                  </Card>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className={`w-8 h-8 ${getAvatarColor(message.sender)} flex-shrink-0`}>
                  <AvatarFallback className="text-white text-xs">
                    {getInitials(message.sender)}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex-1 ${isMe ? 'flex flex-col items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{message.sender}</span>
                    <span className="text-xs text-gray-400">{message.timestamp}</span>
                  </div>
                  <div
                    className={`inline-block p-3 rounded-lg max-w-md ${
                      isMe
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p>{message.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Input */}
      <Card className="p-4 bg-white/80 backdrop-blur">
        <div className="flex gap-2">
          <Input
            placeholder="Skriv en melding..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="bg-white"
          />
          <Button 
            onClick={sendMessage}
            className="bg-gradient-to-r from-purple-500 to-pink-500"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
