import { useState, useEffect, useCallback } from 'react';

const TUTORIAL_STORAGE_KEY = 'nutriplan_tutorial_completed';
const TUTORIAL_SIGNUP_KEY = 'nutriplan_show_tutorial_after_signup';
const TOOLTIP_STORAGE_PREFIX = 'nutriplan_tooltip_seen_';
const WIZARD_STORAGE_PREFIX = 'nutriplan_wizard_completed_';

export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(true);

  useEffect(() => {
    // Check if tutorial was already completed
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    setHasCompletedTutorial(completed === 'true');
    
    // Check if we should show tutorial after signup
    const showAfterSignup = localStorage.getItem(TUTORIAL_SIGNUP_KEY);
    if (showAfterSignup === 'true') {
      setShowTutorial(true);
      localStorage.removeItem(TUTORIAL_SIGNUP_KEY);
    }
  }, []);

  const markTutorialComplete = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setHasCompletedTutorial(true);
    setShowTutorial(false);
  }, []);

  const triggerTutorialAfterSignup = useCallback(() => {
    localStorage.setItem(TUTORIAL_SIGNUP_KEY, 'true');
  }, []);

  const openTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setHasCompletedTutorial(false);
  }, []);

  // Reset all tutorials, tooltips and wizards
  const resetAllTutorials = useCallback(() => {
    // Reset main tutorial
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setHasCompletedTutorial(false);
    
    // Reset all tooltips
    const tooltipKeys = Object.keys(localStorage).filter(k => k.startsWith(TOOLTIP_STORAGE_PREFIX));
    tooltipKeys.forEach(k => localStorage.removeItem(k));
    
    // Reset all wizards
    const wizardKeys = Object.keys(localStorage).filter(k => k.startsWith(WIZARD_STORAGE_PREFIX));
    wizardKeys.forEach(k => localStorage.removeItem(k));
  }, []);

  return {
    showTutorial,
    hasCompletedTutorial,
    markTutorialComplete,
    triggerTutorialAfterSignup,
    openTutorial,
    closeTutorial,
    resetTutorial,
    resetAllTutorials,
  };
}
