import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { signupSchema, validatePassword } from '@/lib/password-validation';
import { useTutorial } from '@/hooks/useTutorial';

export default function Signup() {
  const { triggerTutorialAfterSignup } = useTutorial();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Real-time password validation
  const passwordValidation = validatePassword(password);
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Check terms acceptance first
    if (!acceptedTerms) {
      setFieldErrors({ terms: 'Você deve aceitar os termos para continuar' });
      toast.error('Você deve aceitar os Termos de Uso e Política de Privacidade');
      return;
    }

    // Validate all fields with zod schema
    const result = signupSchema.safeParse({ name, email, password, confirmPassword });
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!errors[field]) {
          errors[field] = err.message;
        }
      });
      setFieldErrors(errors);
      
      // Show first error as toast
      const firstError = result.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, name);
      triggerTutorialAfterSignup(); // Trigger tutorial to show after signup
      toast.success('Conta criada com sucesso!');
      navigate('/onboarding');
    } catch (error: any) {
      // Handle specific Supabase auth errors
      const message = error.message || 'Erro ao criar conta';
      
      if (message.includes('weak_password') || message.includes('Password') || message.includes('password')) {
        toast.error('Senha muito fraca. Use uma combinação mais forte com letras, números e símbolos.');
        setFieldErrors({ password: 'Senha muito fraca' });
      } else if (message.includes('already registered') || message.includes('already exists') || message.includes('User already registered')) {
        toast.error('Este e-mail já está cadastrado.');
        setFieldErrors({ email: 'E-mail já cadastrado' });
      } else if (message.includes('leaked') || message.includes('compromised') || message.includes('HIBP')) {
        toast.error('Esta senha foi encontrada em vazamentos de dados conhecidos. Por segurança, escolha outra senha.');
        setFieldErrors({ password: 'Senha comprometida - escolha outra' });
      } else if (message.includes('invalid') || message.includes('Invalid')) {
        toast.error('Dados inválidos. Verifique o e-mail e senha.');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col lg:flex-row">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-16 xl:px-24 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Link to="/">
              <Logo size="lg" />
            </Link>
            <ThemeToggle />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1.5 sm:mb-2">
            Crie sua conta
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
            Comece sua jornada para uma alimentação mais saudável
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="name" className="text-sm">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`pl-9 sm:pl-10 h-10 sm:h-12 ${fieldErrors.name ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {fieldErrors.name && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-9 sm:pl-10 h-10 sm:h-12 ${fieldErrors.email ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-sm">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres com letras e números"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-9 sm:pl-10 pr-10 h-10 sm:h-12 ${fieldErrors.password ? 'border-destructive' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
              
              {/* Password strength indicators */}
              {password.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    {hasMinLength ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={hasMinLength ? 'text-green-600' : 'text-muted-foreground'}>
                      Mínimo 8 caracteres
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {hasLetter ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={hasLetter ? 'text-green-600' : 'text-muted-foreground'}>
                      Pelo menos uma letra
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {hasNumber ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                      Pelo menos um número
                    </span>
                  </div>
                </div>
              )}
              
              {fieldErrors.password && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">Confirme a senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pl-9 sm:pl-10 h-10 sm:h-12 ${fieldErrors.confirmPassword ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms acceptance checkbox */}
            <div className="space-y-1.5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className={fieldErrors.terms ? 'border-destructive' : ''}
                />
                <label
                  htmlFor="acceptTerms"
                  className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                >
                  Li e aceito os{' '}
                  <Link to="/terms" className="text-primary hover:underline" target="_blank">
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                    Política de Privacidade
                  </Link>
                </label>
              </div>
              {fieldErrors.terms && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.terms}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full h-10 sm:h-12 text-sm sm:text-base"
              disabled={loading || !acceptedTerms}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5 sm:mt-6">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 xl:p-12 bg-secondary/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-lg text-center"
        >
          <div className="w-48 h-48 xl:w-64 xl:h-64 mx-auto mb-6 xl:mb-8 rounded-full gradient-primary opacity-20" />
          <h2 className="text-xl xl:text-2xl font-bold text-foreground mb-3 xl:mb-4">
            Alimentação personalizada
          </h2>
          <p className="text-sm xl:text-base text-muted-foreground">
            Receba planos alimentares adaptados às suas necessidades, 
            com explicações claras sobre cada escolha nutricional.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
