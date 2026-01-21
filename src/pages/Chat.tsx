import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, AlertTriangle, Bot, User, Lock } from 'lucide-react';
import { ThemeToggleSimple } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileNav } from '@/components/MobileNav';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatUsageIndicator } from '@/components/ChatUsageIndicator';

interface ChatUsage {
  current: number;
  limit: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function Chat() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [usage, setUsage] = useState<ChatUsage>({ current: 0, limit: 3 });
  const [planName, setPlanName] = useState('gratuito');
  const [limitReached, setLimitReached] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialUsage();
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchInitialUsage = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Check if chat is available using can_use_feature
      const { data: canUse } = await supabase.rpc('can_use_feature', {
        _user_id: user.id,
        _feature: 'chat',
      });
      
      setLimitReached(!canUse);

      // Get plan info
      const { data: planData } = await supabase.rpc('get_user_plan', { _user_id: user.id });
      if (planData?.[0]) {
        setPlanName(planData[0].plan_name || 'gratuito');
        setUsage({
          current: 0, // Will be updated on first message
          limit: planData[0].chat_messages_per_day || 3,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  }, [user?.id]);

  const sendMessage = async () => {
    if (!input.trim() || loading || limitReached) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Get AI response via edge function
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
            setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
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

      // Add assistant message to local state (no database in v2)
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
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
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Header - Mobile responsive */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
          <MobileNav />
          <Button variant="ghost" size="icon" className="hidden md:flex shrink-0 w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">
              Assistente Nutricional
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {planName === 'profissional' ? 'Assistente Clínico' : 
               planName === 'plano_pessoal_pago' ? 'IA Completa' :
               planName === 'premium' ? 'IA Educacional' : 'IA Básica'}
            </p>
          </div>
          <ThemeToggleSimple />
        </div>
      </header>

      {/* Usage indicator */}
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-2xl">
        <ChatUsageIndicator 
          currentUsage={usage.current}
          maxLimit={usage.limit}
          planName={planName}
        />
      </div>

      {/* Disclaimer */}
      <div className="bg-warning/10 border-b border-warning/20 px-3 sm:px-4 py-2">
        <div className="container mx-auto flex items-center gap-2 text-[10px] sm:text-xs text-warning">
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
          <p className="line-clamp-2">
            Este assistente oferece educação nutricional e não substitui um
            profissional de saúde.
          </p>
        </div>
      </div>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="container mx-auto max-w-2xl space-y-3 sm:space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">
                Olá! Sou seu assistente nutricional
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto px-2">
                {planName === 'profissional' 
                  ? 'Posso auxiliar com análises nutricionais e sugestões técnicas.'
                  : planName === 'plano_pessoal_pago'
                  ? 'Posso criar planos, ajustar macros e sugerir substituições.'
                  : planName === 'premium'
                  ? 'Posso explicar seu plano e tirar dúvidas sobre nutrição.'
                  : 'Posso responder dúvidas básicas sobre alimentação saudável.'}
              </p>
              {/* Suggestion chips - responsive grid on mobile */}
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-4 sm:mt-6 px-2">
                {getSuggestions().map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    disabled={limitReached}
                    className="text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary rounded-full text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
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
                className={`flex gap-2 sm:gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl sm:rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  <p className="text-xs sm:text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary-foreground" />
                  </div>
                )}
              </motion.div>
            ))
          )}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 sm:gap-3"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-xl sm:rounded-2xl rounded-bl-md p-3 sm:p-4">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Limit reached banner */}
      {limitReached && (
        <div className="bg-destructive/10 border-t border-destructive/20 px-3 sm:px-4 py-2 sm:py-3">
          <div className="container mx-auto max-w-2xl flex items-center gap-2 sm:gap-3">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-destructive font-medium truncate">
                {limitMessage || 'Limite diário atingido'}
              </p>
            </div>
            <Button size="sm" className="shrink-0 text-xs sm:text-sm h-8 sm:h-9" onClick={() => navigate('/pricing')}>
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Input - Fixed at bottom */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border p-3 sm:p-4 safe-area-inset-bottom">
        <div className="container mx-auto max-w-2xl flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={limitReached ? 'Limite atingido' : 'Digite sua pergunta...'}
            className="flex-1 h-10 sm:h-12 text-sm"
            disabled={loading || limitReached}
          />
          <Button
            variant="hero"
            size="icon"
            className="h-10 w-10 sm:h-12 sm:w-12 shrink-0"
            onClick={sendMessage}
            disabled={!input.trim() || loading || limitReached}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
