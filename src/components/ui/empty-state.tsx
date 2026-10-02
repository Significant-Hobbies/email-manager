import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md border-dashed bg-[var(--bg-card)]/60 text-center shadow-none">
        <CardHeader className="items-center pb-2">
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-pretty">{description}</CardDescription>
        </CardHeader>
        {action || children ? (
          <div className="flex flex-col items-center gap-3 px-6 pb-6">
            {action ? (
              <Button type="button" onClick={action.onClick} disabled={action.disabled}>
                {action.label}
              </Button>
            ) : null}
            {children}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
