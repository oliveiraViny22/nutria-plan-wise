import { Leaf } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-xl gradient-primary flex items-center justify-center shadow-soft`}>
        <Leaf className="text-primary-foreground w-1/2 h-1/2" />
      </div>
      {showText && (
        <span className={`font-bold ${textSizeClasses[size]} text-foreground`}>
          Nutri<span className="text-primary">AI</span>
        </span>
      )}
    </div>
  );
}
