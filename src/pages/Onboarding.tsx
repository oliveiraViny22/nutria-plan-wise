import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ACTIVITY_LEVELS,
  GOALS,
  FOOD_PREFERENCES,
  FOOD_RESTRICTIONS,
} from '@/lib/types';

const steps = [
  { id: 1, title: 'Dados Pessoais', description: 'Informações básicas' },
  { id: 2, title: 'Objetivo', description: 'Sua meta principal' },
  { id: 3, title: 'Preferências', description: 'Alimentação e restrições' },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Form data
  const [formData, setFormData] = useState({
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    preferences: [] as string[],
    restrictions: [] as string[],
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
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      const targets = calculateTargets();
      
      const { error } = await supabase
        .from('profiles')
        .update({
          age: Number(formData.age),
          sex: formData.sex || null,
          height: Number(formData.height),
          weight: Number(formData.weight),
          goal: formData.goal || null,
          activity_level: formData.activity_level || null,
          preferences: formData.preferences,
          restrictions: formData.restrictions,
          daily_calories: targets.calories,
          protein_target: targets.protein,
          carbs_target: targets.carbs,
          fat_target: targets.fat,
          onboarding_completed: true,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Perfil configurado com sucesso!');
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
    return true;
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Logo />
      </header>

      {/* Progress */}
      <div className="px-6 mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-16 sm:w-24 mx-2 rounded-full transition-colors ${
                      currentStep > step.id ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">
              {steps[currentStep - 1].title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {steps[currentStep - 1].description}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-24">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card-elevated rounded-2xl p-6 sm:p-8"
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="age">Idade</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      value={formData.age}
                      onChange={(e) =>
                        setFormData({ ...formData, age: e.target.value })
                      }
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['male', 'female', 'other'] as const).map((sex) => (
                        <button
                          key={sex}
                          type="button"
                          onClick={() => setFormData({ ...formData, sex })}
                          className={`h-12 rounded-lg border transition-colors ${
                            formData.sex === sex
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {sex === 'male' ? 'Masculino' : sex === 'female' ? 'Feminino' : 'Outro'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Altura (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="175"
                      value={formData.height}
                      onChange={(e) =>
                        setFormData({ ...formData, height: e.target.value })
                      }
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight">Peso (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="70"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                      className="h-12"
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
                className="card-elevated rounded-2xl p-6 sm:p-8"
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Qual seu objetivo principal?</Label>
                    <div className="grid gap-3">
                      {(Object.entries(GOALS) as [keyof typeof GOALS, typeof GOALS[keyof typeof GOALS]][]).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, goal: key })
                            }
                            className={`p-4 rounded-xl border text-left transition-all ${
                              formData.goal === key
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="font-medium text-foreground">
                              {value.label}
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Nível de atividade física</Label>
                    <div className="grid gap-3">
                      {(Object.entries(ACTIVITY_LEVELS) as [keyof typeof ACTIVITY_LEVELS, typeof ACTIVITY_LEVELS[keyof typeof ACTIVITY_LEVELS]][]).map(
                        ([key, value]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, activity_level: key })
                            }
                            className={`p-4 rounded-xl border text-left transition-all ${
                              formData.activity_level === key
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <span className="font-medium text-foreground block">
                              {value.label}
                            </span>
                            <span className="text-sm text-muted-foreground">
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
                className="card-elevated rounded-2xl p-6 sm:p-8"
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Preferências alimentares (opcional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {FOOD_PREFERENCES.map((pref) => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => togglePreference(pref)}
                          className={`px-4 py-2 rounded-full border transition-all ${
                            formData.preferences.includes(pref)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Restrições alimentares (opcional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {FOOD_RESTRICTIONS.map((rest) => (
                        <button
                          key={rest}
                          type="button"
                          onClick={() => toggleRestriction(rest)}
                          className={`px-4 py-2 rounded-full border transition-all ${
                            formData.restrictions.includes(rest)
                              ? 'border-destructive bg-destructive text-destructive-foreground'
                              : 'border-border hover:border-destructive/50'
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
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-background/80 backdrop-blur-md border-t border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Button
            variant="hero"
            onClick={handleNext}
            disabled={!canProceed() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : currentStep === 3 ? (
              <>
                Concluir
                <Check className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
