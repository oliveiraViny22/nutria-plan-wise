import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, AlertTriangle, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/lib/types';
import { toast } from 'sonner';

export default function Chat() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch (error: any) {
      console.error('Error fetching chat history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: user?.id || '',
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Save user message to database
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({ user_id: user?.id, role: 'user', content: userMessage })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Update temp message with real data
      setMessages((prev) =>
        prev.map((m) => (m.id === tempUserMsg.id ? (savedUserMsg as ChatMessage) : m))
      );

      // Get AI response
      const response = await supabase.functions.invoke('nutritional-chat', {
        body: {
          message: userMessage,
          profile: {
            goal: profile?.goal,
            daily_calories: profile?.daily_calories,
            protein_target: profile?.protein_target,
            carbs_target: profile?.carbs_target,
            fat_target: profile?.fat_target,
            preferences: profile?.preferences,
            restrictions: profile?.restrictions,
          },
          chatHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (response.error) {
        // Check for rate limit or payment errors
        if (response.error.message?.includes('429') || response.error.message?.includes('Rate limit')) {
          toast.error('Limite de requisições excedido. Tente novamente em alguns segundos.');
          return;
        }
        if (response.error.message?.includes('402') || response.error.message?.includes('Payment')) {
          toast.error('Créditos insuficientes. Adicione mais créditos para continuar.');
          return;
        }
        throw response.error;
      }

      const assistantContent = response.data.message;

      // Save assistant message
      const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({ user_id: user?.id, role: 'assistant', content: assistantContent })
        .select()
        .single();

      if (assistantMsgError) throw assistantMsgError;

      setMessages((prev) => [...prev, savedAssistantMsg as ChatMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground">
              Assistente Nutricional
            </h1>
            <p className="text-xs text-muted-foreground">
              Tire suas dúvidas sobre nutrição
            </p>
          </div>
        </div>
      </header>

      {/* Disclaimer */}
      <div className="bg-warning/10 border-b border-warning/20 px-4 py-2">
        <div className="container mx-auto flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>
            Este assistente oferece educação nutricional e não substitui um
            profissional de saúde.
          </p>
        </div>
      </div>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="container mx-auto max-w-2xl space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Olá! Sou seu assistente nutricional
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Posso responder perguntas sobre seu plano alimentar, explicar
                escolhas nutricionais e ajudar com substituições de alimentos.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {[
                  'Por que esse alimento está no meu plano?',
                  'Qual o impacto dessa refeição?',
                  'Posso trocar arroz por batata?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs px-3 py-2 bg-secondary rounded-full text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </motion.div>
            ))
          )}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md p-4">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border p-4">
        <div className="container mx-auto max-w-2xl flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua pergunta..."
            className="flex-1 h-12"
            disabled={loading}
          />
          <Button
            variant="hero"
            size="icon"
            className="h-12 w-12"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
