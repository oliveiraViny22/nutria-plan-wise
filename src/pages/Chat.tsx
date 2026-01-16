import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, AlertTriangle, Bot, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/lib/types';
import { toast } from 'sonner';
import { ChatUsageIndicator } from '@/components/ChatUsageIndicator';

interface ChatUsage {
  current: number;
  limit: number;
}

export default function Chat() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [usage, setUsage] = useState<ChatUsage>({ current: 0, limit: 3 });
  const [planName, setPlanName] = useState('gratuito');
  const [limitReached, setLimitReached] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChatHistory();
    fetchInitialUsage();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchInitialUsage = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('check_feature_limit', {
        _user_id: user?.id,
        _feature: 'chat',
      });
      
      if (!error && data?.[0]) {
        setUsage({
          current: data[0].current_usage,
          limit: data[0].max_limit,
        });
        setLimitReached(!data[0].allowed);
      }

      // Get plan name
      const { data: permData } = await supabase.rpc('get_user_permissions', { _user_id: user?.id });
      if (permData?.[0]) {
        setPlanName(permData[0].plan_name || 'gratuito');
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  }, [user?.id]);

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
    if (!input.trim() || loading || limitReached) return;

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
        // Check for limit exceeded (403)
        const errorContext = response.error?.context;
        if (errorContext?.status === 403) {
          try {
            const errorData = await errorContext.json();
            setLimitReached(true);
            setLimitMessage(errorData.error || 'Limite de mensagens atingido.');
            toast.error(errorData.error || 'Limite de mensagens atingido.');
            // Remove the user message since it wasn't processed
            setMessages((prev) => prev.filter((m) => m.id !== savedUserMsg.id));
            // Delete from database
            await supabase.from('chat_messages').delete().eq('id', savedUserMsg.id);
            return;
          } catch {
            setLimitReached(true);
            toast.error('Limite de mensagens atingido.');
            return;
          }
        }

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
      
      // Update usage from response
      if (response.data.usage) {
        setUsage({
          current: response.data.usage.current,
          limit: response.data.usage.limit,
        });
        // Check if limit just reached
        if (response.data.usage.current >= response.data.usage.limit) {
          setLimitReached(true);
        }
      }
      
      if (response.data.planName) {
        setPlanName(response.data.planName);
      }

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

  const getSuggestions = () => {
    if (planName === 'profissional') {
      return [
        'Analise os macros deste paciente',
        'Sugira opções de ajuste calórico',
        'Quais alimentos ricos em proteína?',
      ];
    }
    if (planName === 'plano_pessoal_pago') {
      return [
        'Crie um plano de café da manhã',
        'Posso trocar arroz por batata?',
        'Recalcule meus macros',
      ];
    }
    if (planName === 'premium') {
      return [
        'Por que esse alimento está no meu plano?',
        'Qual a função da proteína?',
        'Explique meu plano alimentar',
      ];
    }
    return [
      'O que é uma alimentação saudável?',
      'Qual o impacto dos carboidratos?',
      'O que são macronutrientes?',
    ];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">
              Assistente Nutricional
            </h1>
            <p className="text-xs text-muted-foreground">
              {planName === 'profissional' ? 'Assistente Clínico' : 
               planName === 'plano_pessoal_pago' ? 'IA Completa' :
               planName === 'premium' ? 'IA Educacional' : 'IA Básica'}
            </p>
          </div>
        </div>
      </header>

      {/* Usage indicator */}
      <div className="container mx-auto px-4 py-3 max-w-2xl">
        <ChatUsageIndicator 
          currentUsage={usage.current}
          maxLimit={usage.limit}
          planName={planName}
        />
      </div>

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
                {planName === 'profissional' 
                  ? 'Posso auxiliar com análises nutricionais e sugestões técnicas.'
                  : planName === 'plano_pessoal_pago'
                  ? 'Posso criar planos, ajustar macros e sugerir substituições.'
                  : planName === 'premium'
                  ? 'Posso explicar seu plano e tirar dúvidas sobre nutrição.'
                  : 'Posso responder dúvidas básicas sobre alimentação saudável.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {getSuggestions().map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    disabled={limitReached}
                    className="text-xs px-3 py-2 bg-secondary rounded-full text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
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

      {/* Limit reached banner */}
      {limitReached && (
        <div className="bg-destructive/10 border-t border-destructive/20 px-4 py-3">
          <div className="container mx-auto max-w-2xl flex items-center gap-3">
            <Lock className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">
                {limitMessage || 'Limite diário atingido'}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate('/pricing')}>
              Fazer Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border p-4">
        <div className="container mx-auto max-w-2xl flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={limitReached ? 'Limite atingido - volte amanhã' : 'Digite sua pergunta...'}
            className="flex-1 h-12"
            disabled={loading || limitReached}
          />
          <Button
            variant="hero"
            size="icon"
            className="h-12 w-12"
            onClick={sendMessage}
            disabled={!input.trim() || loading || limitReached}
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
