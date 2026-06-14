'use client'

// ─── Prikaz alergenov za artikel ────────────────────────────────
import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ShieldAlert } from 'lucide-react'
import { EU_ALLERGENS } from './constants'

export const AllergenBadge = memo(function AllergenBadge({ allergens, compact = false }: { allergens: string; compact?: boolean }) {
  if (!allergens) return null

  const codes = allergens.split(',').map(s => s.trim()).filter(Boolean)
  if (codes.length === 0) return null

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-200 text-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 gap-0.5">
              <ShieldAlert className="h-2.5 w-2.5" />
              {codes.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-xs mb-1">Alergeni:</p>
              {codes.map(code => {
                const info = EU_ALLERGENS.find(a => a.code === code)
                return info ? (
                  <p key={code} className="text-xs">{info.icon} {info.name}</p>
                ) : (
                  <p key={code} className="text-xs">Alergen {code}</p>
                )
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex flex-wrap gap-0.5">
      {codes.map(code => {
        const info = EU_ALLERGENS.find(a => a.code === code)
        return (
          <TooltipProvider key={code}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  {code}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{info?.icon} {info?.name || `Alergen ${code}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
})
