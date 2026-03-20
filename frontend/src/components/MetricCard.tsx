import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  value: number;
  subtitle: string;
  color?: 'default' | 'destructive' | 'warning' | 'primary';
  icon: React.ElementType;
}

const colorMap = {
  default: 'text-foreground',
  destructive: 'text-destructive',
  warning: 'text-warning',
  primary: 'text-primary',
};

export function MetricCard({ title, value, subtitle, color = 'default', icon: Icon }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <motion.p
            className={cn('text-3xl font-bold mt-1', colorMap[color])}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {value}
          </motion.p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className={cn('p-2.5 rounded-xl bg-muted', color !== 'default' && `bg-${color === 'destructive' ? 'destructive' : color === 'warning' ? 'warning' : 'primary'}/10`)}>
          <Icon className={cn('w-5 h-5', colorMap[color])} />
        </div>
      </div>
    </motion.div>
  );
}
