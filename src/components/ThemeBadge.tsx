import { Moon, Sun, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeBadge({ className, showLabel = true }: ThemeBadgeProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-3 w-3" />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon className="h-3 w-3" />
    ) : (
      <Sun className="h-3 w-3" />
    );
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Claro';
      case 'dark':
        return 'Escuro';
      case 'system':
        return 'Sistema';
    }
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        'cursor-pointer select-none gap-1.5 transition-all hover:bg-secondary/80 active:scale-95',
        className
      )}
      onClick={cycleTheme}
      role="button"
      aria-label={`Tema atual: ${getThemeLabel()}. Clique para alternar.`}
    >
      {getThemeIcon()}
      {showLabel && <span>{getThemeLabel()}</span>}
    </Badge>
  );
}
