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
    <div className="flex items-center gap-2.5">
      <div className={`${sizeClasses[size]} rounded-xl gradient-gold flex items-center justify-center shadow-md`}>
        <Leaf className="text-primary-foreground w-1/2 h-1/2 drop-shadow-sm" />
      </div>
      {showText && (
        <span className={`font-display font-semibold ${textSizeClasses[size]} tracking-tight`}>
          <span className="text-foreground">Nutri</span>
          <span className="text-gold">AI</span>
        </span>
      )}
    </div>
  );
}
