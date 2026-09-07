'use client'

import { memo, type ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ============================================
// EMPTY STATE — Reusable component for empty lists/states
// ============================================
// Navdih: Square (clean empty states z ikonami)
//
// Uporaba:
//   <EmptyState
//     icon={ShoppingCart}
//     title="Ni naročil"
//     description="Trenutno ni aktivnih naročil."
//     action={{ label: "Novo naročilo", onClick: () => ... }}
//   />
// ============================================

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  iconClassName?: string
  iconColor?: string
}

export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconClassName,
  iconColor = 'text-muted-foreground',
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in-up',
      className
    )}>
      <div className={cn(
        'w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4',
        iconClassName
      )}>
        <Icon className={cn('w-10 h-10 opacity-50', iconColor)} />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-4 btn-press"
          size="sm"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
})
