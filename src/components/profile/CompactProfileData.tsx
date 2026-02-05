import { User, Calendar, Ruler, Weight, UserCircle } from 'lucide-react';

interface CompactProfileDataProps {
  name: string;
  age: string;
  sex: string;
  height: string;
  weight: string;
}

const getSexLabel = (sex: string) => {
  switch (sex) {
    case 'male': return 'Masculino';
    case 'female': return 'Feminino';
    case 'other': return 'Outro';
    default: return '-';
  }
};

export function CompactProfileData({ name, age, sex, height, weight }: CompactProfileDataProps) {
  const dataItems = [
    { icon: User, label: 'Nome', value: name || '-', colSpan: 'col-span-2 sm:col-span-1' },
    { icon: Calendar, label: 'Idade', value: age ? `${age} anos` : '-' },
    { icon: UserCircle, label: 'Sexo', value: getSexLabel(sex) },
    { icon: Ruler, label: 'Altura', value: height ? `${height} cm` : '-' },
    { icon: Weight, label: 'Peso', value: weight ? `${weight} kg` : '-' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {dataItems.map((item, index) => (
        <div 
          key={item.label}
          className={`flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 ${
            index === 0 ? item.colSpan : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
              {item.label}
            </p>
            <p className="font-semibold text-sm truncate">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
