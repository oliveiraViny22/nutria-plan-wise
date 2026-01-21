import { useState, useEffect, useCallback } from 'react';

const TUTORIAL_STORAGE_KEY = 'nutriplan_tutorial_completed';
const TUTORIAL_SIGNUP_KEY = 'nutriplan_show_tutorial_after_signup';

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

  return {
    showTutorial,
    hasCompletedTutorial,
    markTutorialComplete,
    triggerTutorialAfterSignup,
    openTutorial,
    closeTutorial,
    resetTutorial,
  };
}
