import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  ACTIVITY_LEVELS,
  GOALS,
  FOOD_PREFERENCES,
  FOOD_RESTRICTIONS,
} from '@/lib/types';

const MEALS_OPTIONS = [
  { value: 2, label: '2 refeições', description: 'Jejum intermitente' },
  { value: 3, label: '3 refeições', description: 'Tradicional' },
  { value: 4, label: '4 refeições', description: 'Com lanche da tarde' },
  { value: 5, label: '5 refeições', description: 'Com lanches' },
  { value: 6, label: '6 refeições', description: 'Atletas e hipertrofia' },
];

const steps = [
  { id: 1, title: 'Credenciais', description: 'Acesso do aluno' },
  { id: 2, title: 'Dados Pessoais', description: 'Informações físicas' },
  { id: 3, title: 'Objetivo', description: 'Meta e atividade' },
  { id: 4, title: 'Preferências', description: 'Alimentação' },
];

interface CreateStudentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function CreateStudentForm({ onSuccess, onCancel }: CreateStudentFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const [formData, setFormData] = useState({
    // Credentials
    name: '',
    email: '',
    password: generatePassword(),
    
    // Physical data
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    
    // Activity and goals
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    meals_per_day: 4,
    
    // Preferences
    preferences: [] as string[],
    restrictions: [] as string[],
  });

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onCancel();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.toLowerCase().trim(),
            password: formData.password,
            age: Number(formData.age),
            sex: formData.sex,
            height: Number(formData.height),
            weight: Number(formData.weight),
            activity_level: formData.activity_level,
            goal: formData.goal,
            meals_per_day: formData.meals_per_day,
            preferences: formData.preferences,
            restrictions: formData.restrictions,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao criar aluno');
        return;
      }

      // Show credentials for the professional to share
      setCreatedCredentials({
        email: formData.email,
        password: formData.password,
      });
      
      toast.success('Aluno cadastrado com sucesso!');
    } catch (error) {
      console.error('Error creating student:', error);
      toast.error('Erro ao criar aluno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = (pref: string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter((p) => p !== pref)
        : [...prev.preferences, pref],
    }));
  };

  const toggleRestriction = (rest: string) => {
    setFormData((prev) => ({
      ...prev,
      restrictions: prev.restrictions.includes(rest)
        ? prev.restrictions.filter((r) => r !== rest)
        : [...prev.restrictions, rest],
    }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const canProceed = () => {
    if (currentStep === 1) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return formData.name.trim() && emailRegex.test(formData.email) && formData.password.length >= 6;
    }
    if (currentStep === 2) {
      return formData.age && formData.sex && formData.height && formData.weight;
    }
    if (currentStep === 3) {
      return formData.goal && formData.activity_level;
    }
    return true;
  };

  // Show credentials after successful creation
  if (createdCredentials) {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Aluno Cadastrado!</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Compartilhe as credenciais abaixo com o aluno para que ele possa acessar a plataforma.
          </p>
        </div>

        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="flex items-center gap-2">
              <Input value={createdCredentials.email} readOnly className="bg-background" />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(createdCredentials.email, 'Email')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Senha</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={createdCredentials.password} 
                readOnly 
                type={showPassword ? 'text' : 'password'}
                className="bg-background font-mono"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(createdCredentials.password, 'Senha')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          ⚠️ O sistema não envia as credenciais automaticamente. Você é responsável por compartilhá-las com o aluno.
        </p>

        <Button onClick={onSuccess} className="w-full">
          Concluir
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep >= step.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-6 sm:w-10 mx-1 transition-colors ${
                  currentStep > step.id ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      
      <div className="text-center mb-4">
        <h3 className="font-medium">{steps[currentStep - 1].title}</h3>
        <p className="text-xs text-muted-foreground">{steps[currentStep - 1].description}</p>
      </div>

      <ScrollArea className="max-h-[400px] pr-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Credentials */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  placeholder="Nome do aluno"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}
                    title="Gerar nova senha"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 6 caracteres. Você pode gerar uma senha automática.
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Physical Data */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Idade *</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="25"
                    min="10"
                    max="120"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sexo *</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['male', 'female', 'other'] as const).map((sex) => (
                      <button
                        key={sex}
                        type="button"
                        onClick={() => setFormData({ ...formData, sex })}
                        className={`h-10 rounded-lg border text-xs transition-colors ${
                          formData.sex === sex
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {sex === 'male' ? 'M' : sex === 'female' ? 'F' : 'Outro'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Altura (cm) *</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="175"
                    min="100"
                    max="250"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Peso (kg) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="70"
                    min="20"
                    max="400"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Goals */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Objetivo *</Label>
                <div className="grid gap-2">
                  {(Object.entries(GOALS) as [keyof typeof GOALS, typeof GOALS[keyof typeof GOALS]][]).map(
                    ([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, goal: key })}
                        className={`p-3 rounded-lg border text-left text-sm transition-all ${
                          formData.goal === key
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {value.label}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nível de atividade *</Label>
                <div className="grid gap-2">
                  {(Object.entries(ACTIVITY_LEVELS) as [keyof typeof ACTIVITY_LEVELS, typeof ACTIVITY_LEVELS[keyof typeof ACTIVITY_LEVELS]][]).map(
                    ([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, activity_level: key })}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          formData.activity_level === key
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="font-medium text-sm">{value.label}</span>
                        <span className="text-xs text-muted-foreground block">{value.description}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Refeições por dia</Label>
                <div className="grid grid-cols-5 gap-1">
                  {MEALS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, meals_per_day: option.value })}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        formData.meals_per_day === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className="font-medium text-sm">{option.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Preferences */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Preferências alimentares (opcional)</Label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_PREFERENCES.map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => togglePreference(pref)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-all ${
                        formData.preferences.includes(pref)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Restrições alimentares (opcional)</Label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_RESTRICTIONS.map((rest) => (
                    <button
                      key={rest}
                      type="button"
                      onClick={() => toggleRestriction(rest)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-all ${
                        formData.restrictions.includes(rest)
                          ? 'border-destructive bg-destructive/10 text-destructive'
                          : 'border-border hover:border-destructive/50'
                      }`}
                    >
                      {rest}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Cancelar' : 'Voltar'}
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={!canProceed() || loading}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Criando...
            </>
          ) : currentStep === steps.length ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Criar Aluno
            </>
          ) : (
            <>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
