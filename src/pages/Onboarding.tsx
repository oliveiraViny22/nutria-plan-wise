import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Utensils, Heart, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { useTutorial } from '@/hooks/useTutorial';
import { FoodSearchSelect } from '@/components/FoodSearchSelect';
import {
  ACTIVITY_LEVELS,
  GOALS,
  FOOD_PREFERENCES,
  FOOD_RESTRICTIONS,
} from '@/lib/types';

const steps = [
  { id: 1, title: 'Dados Pessoais', description: 'Informações básicas' },
  { id: 2, title: 'Objetivo', description: 'Sua meta principal' },
  { id: 3, title: 'Refeições', description: 'Quantas refeições por dia' },
  { id: 4, title: 'Preferências', description: 'Alimentação e restrições' },
  { id: 5, title: 'Alimentos', description: 'O que você gosta e não gosta' },
];

const MEALS_OPTIONS = [
  { value: 2, label: '2 refeições', description: 'Jejum intermitente' },
  { value: 3, label: '3 refeições', description: 'Tradicional' },
  { value: 4, label: '4 refeições', description: 'Com lanche da tarde' },
  { value: 5, label: '5 refeições', description: 'Com lanches' },
  { value: 6, label: '6 refeições', description: 'Atletas e hipertrofia' },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  
  const navigate = useNavigate();
  const { showTutorial, markTutorialComplete, closeTutorial } = useTutorial();

  // Form data - using v2 schema values
  const [formData, setFormData] = useState({
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    meals_per_day: 4,
    preferences: [] as string[],
    restrictions: [] as string[],
    preferred_foods: [] as string[], // Alimentos preferidos específicos
    avoided_foods: [] as string[],   // Alimentos evitados específicos
  });

  const calculateTargets = () => {
    const { age, sex, height, weight, goal, activity_level } = formData;
    
    if (!age || !sex || !height || !weight || !activity_level) {
      return { calories: 2000, protein: 150, carbs: 250, fat: 65 };
    }

    // Mifflin-St Jeor Equation
    const bmr = sex === 'male'
      ? 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + 5
      : 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) - 161;

    const activityMultiplier = ACTIVITY_LEVELS[activity_level as keyof typeof ACTIVITY_LEVELS]?.multiplier || 1.55;
    const tdee = bmr * activityMultiplier;
    
    const calorieAdjustment = goal ? GOALS[goal as keyof typeof GOALS]?.calorieAdjustment || 0 : 0;
    const calories = Math.round(tdee + calorieAdjustment);

    // Macro distribution based on goal
    let proteinRatio = 0.3;
    let carbsRatio = 0.4;
    let fatRatio = 0.3;

    if (goal === 'gain_muscle') {
      proteinRatio = 0.35;
      carbsRatio = 0.45;
      fatRatio = 0.2;
    } else if (goal === 'lose_weight') {
      proteinRatio = 0.35;
      carbsRatio = 0.35;
      fatRatio = 0.3;
    }

    return {
      calories,
      protein: Math.round((calories * proteinRatio) / 4),
      carbs: Math.round((calories * carbsRatio) / 4),
      fat: Math.round((calories * fatRatio) / 9),
    };
  };

  const handleNext = async () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      const targets = calculateTargets();
      
      // Update profile only - no automatic plan generation
      const { error } = await supabase
        .from('profiles')
        .update({
          age: Number(formData.age),
          sex: formData.sex || null,
          height: Number(formData.height),
          weight: Number(formData.weight),
          goal: formData.goal || null,
          activity_level: formData.activity_level || null,
          meals_per_day: formData.meals_per_day,
          preferences: formData.preferences,
          restrictions: formData.restrictions,
          preferred_foods: formData.preferred_foods,
          avoided_foods: formData.avoided_foods,
          daily_calories: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          onboarding_completed: true,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Perfil configurado com sucesso! Clique em "Gerar Plano" para criar seu plano alimentar.');

      await refreshProfile();
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar perfil');
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

  const canProceed = () => {
    if (currentStep === 1) {
      return formData.age && formData.sex && formData.height && formData.weight;
    }
    if (currentStep === 2) {
      return formData.goal && formData.activity_level;
    }
    if (currentStep === 3) {
      return formData.meals_per_day >= 2 && formData.meals_per_day <= 6;
    }
    return true;
  };

  return (
    <>
      {/* Tutorial Modal */}
      {showTutorial && (
        <OnboardingTutorial 
          onComplete={markTutorialComplete} 
          onSkip={closeTutorial} 
        />
      )}

      <div className="min-h-screen gradient-hero flex flex-col pt-safe">
        {/* Header */}
        <header className="p-4 sm:p-6 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>

      {/* Progress */}
      <div className="px-4 sm:px-6 mb-6 sm:mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-medium text-xs sm:text-sm transition-colors ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-6 xs:w-8 sm:w-16 mx-0.5 xs:mx-1 sm:mx-2 rounded-full transition-colors ${
                      currentStep > step.id ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              {steps[currentStep - 1].title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {steps[currentStep - 1].description}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 pb-24 sm:pb-28 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8"
              >
                <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="age" className="text-sm">Idade</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      min="10"
                      max="120"
                      value={formData.age}
                      onChange={(e) =>
                        setFormData({ ...formData, age: e.target.value })
                      }
                      className="h-10 sm:h-12"
                    />
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Sexo</Label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {(['male', 'female', 'other'] as const).map((sex) => (
                        <button
                          key={sex}
                          type="button"
                          onClick={() => setFormData({ ...formData, sex })}
                          className={`h-10 sm:h-12 rounded-lg border transition-colors text-xs sm:text-sm ${
                            formData.sex === sex
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {sex === 'male' ? 'Masc.' : sex === 'female' ? 'Fem.' : 'Outro'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="height" className="text-sm">Altura (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="175"
                      min="100"
                      max="250"
                      value={formData.height}
                      onChange={(e) =>
                        setFormData({ ...formData, height: e.target.value })
                      }
                      className="h-10 sm:h-12"
                    />
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="weight" className="text-sm">Peso (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="70"
                      min="20"
                      max="400"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                      className="h-10 sm:h-12"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8"
              >
                <div className="space-y-4 sm:space-y-6">
                  <div className="space-y-2 sm:space-y-3">
                    <Label className="text-sm">Qual seu objetivo principal?</Label>
                    <div className="grid gap-2 sm:gap-3">
                      {(Object.entries(GOALS) as [keyof typeof GOALS, typeof GOALS[keyof typeof GOALS]][]).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, goal: key })
                            }
                            className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all ${
                              formData.goal === key
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="font-medium text-foreground text-sm sm:text-base">
                              {value.label}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <Label className="text-sm">Nível de atividade física</Label>
                    <div className="grid gap-2 sm:gap-3">
                      {(Object.entries(ACTIVITY_LEVELS) as [keyof typeof ACTIVITY_LEVELS, typeof ACTIVITY_LEVELS[keyof typeof ACTIVITY_LEVELS]][]).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, activity_level: key })
                            }
                            className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all ${
                              formData.activity_level === key
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="font-medium text-foreground text-sm sm:text-base block">
                              {value.label}
                            </span>
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {value.description}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8"
              >
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Utensils className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold">Quantas refeições por dia?</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Isso nos ajuda a distribuir melhor suas calorias
                    </p>
                  </div>

                  <div className="grid gap-2 sm:gap-3">
                    {MEALS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, meals_per_day: option.value })
                        }
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border text-left transition-all ${
                          formData.meals_per_day === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="font-medium text-foreground text-sm sm:text-base block">
                          {option.label}
                        </span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8"
              >
                <div className="space-y-6 sm:space-y-8">
                  <div className="space-y-3 sm:space-y-4">
                    <Label className="text-sm">Preferências Alimentares (opcional)</Label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {FOOD_PREFERENCES.map((pref) => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => togglePreference(pref)}
                          className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm transition-colors ${
                            formData.preferences.includes(pref)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <Label className="text-sm">Restrições Alimentares (opcional)</Label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {FOOD_RESTRICTIONS.map((rest) => (
                        <button
                          key={rest}
                          type="button"
                          onClick={() => toggleRestriction(rest)}
                          className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm transition-colors ${
                            formData.restrictions.includes(rest)
                              ? 'bg-destructive text-destructive-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {rest}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8"
              >
                <div className="space-y-6 sm:space-y-8">
                  {/* Alimentos Preferidos */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-green-500" />
                      <Label className="text-sm font-medium">Alimentos que você gosta</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Esses alimentos serão priorizados no seu plano alimentar
                    </p>
                    <FoodSearchSelect
                      selectedFoods={formData.preferred_foods}
                      onSelect={(foods) => setFormData(prev => ({ ...prev, preferred_foods: foods }))}
                      placeholder="Buscar alimento preferido..."
                      excludeFoods={formData.avoided_foods}
                      variant="preferred"
                      maxSelections={30}
                    />
                  </div>

                  {/* Alimentos Evitados */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                      <Ban className="w-5 h-5 text-destructive" />
                      <Label className="text-sm font-medium">Alimentos que você NÃO quer</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Esses alimentos NUNCA aparecerão no seu plano, opções ou substituições
                    </p>
                    <FoodSearchSelect
                      selectedFoods={formData.avoided_foods}
                      onSelect={(foods) => setFormData(prev => ({ ...prev, avoided_foods: foods }))}
                      placeholder="Buscar alimento para evitar..."
                      excludeFoods={formData.preferred_foods}
                      variant="avoided"
                      maxSelections={30}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-background/80 backdrop-blur-md border-t pb-safe">
        <div className="max-w-2xl mx-auto flex gap-3 sm:gap-4">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={loading}
              className="flex-1 h-11 sm:h-12"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          <Button
            variant="hero"
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className="flex-1 h-11 sm:h-12"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : currentStep === steps.length ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Concluir
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </footer>
      </div>
    </>
  );
}
