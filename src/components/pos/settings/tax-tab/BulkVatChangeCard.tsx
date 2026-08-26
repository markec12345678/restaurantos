'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import type { TaxTabProps } from '../constants'

// --- Masovna sprememba DDV Card ---

export const BulkVatChangeCard = memo(function BulkVatChangeCard({
  bulkVatFrom,
  bulkVatTo,
  setBulkVatFrom,
  setBulkVatTo,
  onBulkVatChange,
  bulkVatPending,
}: Pick<TaxTabProps, 'bulkVatFrom' | 'bulkVatTo' | 'setBulkVatFrom' | 'setBulkVatTo' | 'onBulkVatChange' | 'bulkVatPending'>) {
  return (
    <Card className="border-amber-200 dark:border-amber-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          Masovna sprememba DDV stopnje
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Če se DDV stopnja spremeni po zakonu, lahko tukaj posodobite vse artikle v jedilniku hkrati.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Sedanja stopnja</Label>
            <Select value={bulkVatFrom} onValueChange={setBulkVatFrom}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="22">22%</SelectItem>
                <SelectItem value="9.5">9.5%</SelectItem>
                <SelectItem value="0">0%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="pb-2 text-lg">→</span>
          <div className="space-y-1">
            <Label className="text-xs">Nova stopnja</Label>
            <Select value={bulkVatTo} onValueChange={setBulkVatTo}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="22">22%</SelectItem>
                <SelectItem value="9.5">9.5%</SelectItem>
                <SelectItem value="0">0%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400" onClick={onBulkVatChange} disabled={bulkVatPending}>
            {bulkVatPending ? 'Posodabljam...' : 'Uporabi na vse artikle'}
          </Button>
        </div>
        <p className="text-xs text-amber-600 mt-2">⚠️ Ta operacija bo spremenila DDV stopnjo za VSE artikle s sedanjim DDV na nov DDV. Te spremembe ni mogoče razveljaviti.</p>
      </CardContent>
    </Card>
  )
})
