'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Search, Loader2, Sparkles } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import type { ItemDialogProps } from './constants'

// ============================================
// DIALOG ZA USTVARJANJE/UREJANJE ARTIKLA
// ============================================
export const ItemDialog = memo(function ItemDialog({
  open,
  onOpenChange,
  editingItem,
  itemForm,
  onItemFormChange,
  menus,
  categories,
  modifierGroups,
  onSubmit,
}: ItemDialogProps) {
  const [searchingImage, setSearchingImage] = useState(false)
  const [imageSearchType, setImageSearchType] = useState<'name' | 'barcode'>('name')
  const [barcode, setBarcode] = useState('')

  // ═══ Auto-image lookup ═══
  const handleAutoImage = async () => {
    const query = imageSearchType === 'barcode' ? barcode : itemForm.name
    if (!query?.trim()) {
      toast.warning('Vnesi ime artikla ali EAN kodo za iskanje slike')
      return
    }

    setSearchingImage(true)
    try {
      const params = new URLSearchParams()
      if (imageSearchType === 'barcode' && barcode) {
        params.set('barcode', barcode)
      } else {
        params.set('name', itemForm.name)
      }

      const res = await authFetch(`/api/images/lookup?${params}`)
      const data = await res.json()

      if (data.imageUrl) {
        onItemFormChange({ ...itemForm, image: data.imageUrl })
        toast.success(`Slika najdena (${data.source}): ${data.name || ''}`)
      } else {
        toast.info(data.message || 'Slika ni najdena. Poskusi z drugim imenom.')
      }
    } catch {
      toast.error('Napaka pri iskanju slike')
    } finally {
      setSearchingImage(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Uredi artikel' : 'Dodaj artikel'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {itemForm.image && (
            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-muted/50">
              <Image src={itemForm.image} alt="Predogled" fill sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
            </div>
          )}
          {/* ═══ Auto-image lookup ═══ */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
              Samodejno iskanje slike
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setImageSearchType('name')}
                className={`px-3 py-1 text-xs rounded-md transition ${imageSearchType === 'name' ? 'bg-amber-500 text-gray-900 font-medium' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
              >
                Po imenu
              </button>
              <button
                type="button"
                onClick={() => setImageSearchType('barcode')}
                className={`px-3 py-1 text-xs rounded-md transition ${imageSearchType === 'barcode' ? 'bg-amber-500 text-gray-900 font-medium' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
              >
                Po EAN kodi
              </button>
            </div>
            {imageSearchType === 'barcode' && (
              <Input
                placeholder="npr. 5449000000996 (Coca-Cola)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="text-sm"
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoImage}
              disabled={searchingImage || (imageSearchType === 'name' ? !itemForm.name?.trim() : !barcode.trim())}
              className="w-full border-amber-500/50 hover:bg-amber-500/10"
            >
              {searchingImage ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iščem sliko...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Najdi sliko {imageSearchType === 'barcode' ? '(EAN)' : '(ime)'}</>
              )}
            </Button>
          </div>

          {/* ═══ Image URL input ═══ */}
          <div>
            <Label htmlFor="item-image">URL slike</Label>
            <Input id="item-image" value={itemForm.image} onChange={(e) => onItemFormChange({ ...itemForm, image: e.target.value })} placeholder="/menu-images/ime-artikla.png" aria-label="/menu-images/ime-artikla.png" autoFocus/>
          </div>
          <div>
            <Label htmlFor="item-name">Ime</Label>
            <Input id="item-name" value={itemForm.name} onChange={(e) => onItemFormChange({ ...itemForm, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="item-description">Opis</Label>
            <Textarea id="item-description" value={itemForm.description} onChange={(e) => onItemFormChange({ ...itemForm, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="item-price">Cena (€)</Label>
            <Input id="item-price" type="number" step="0.01" value={itemForm.price} onChange={(e) => onItemFormChange({ ...itemForm, price: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="item-menu">Meni</Label>
            <Select
              value={categories?.find((c) => c.id === itemForm.categoryId)?.menu?.id || ''}
              onValueChange={(menuId) => {
                const firstCatInMenu = categories?.find((c) => c.menu?.id === menuId)
                onItemFormChange({ ...itemForm, categoryId: firstCatInMenu?.id || '' })
              }}
            >
              <SelectTrigger id="item-menu"><SelectValue placeholder="Izberi meni" /></SelectTrigger>
              <SelectContent>
                {menus?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="item-category">Kategorija</Label>
            <Select value={itemForm.categoryId} onValueChange={(v) => onItemFormChange({ ...itemForm, categoryId: v })}>
              <SelectTrigger id="item-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name} {cat.menu ? `(${cat.menu.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dodatki (modifier skupine)</Label>
            <div className="space-y-1 mt-1">
              {modifierGroups?.map((mg) => (
                <label key={mg.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.modifierGroupIds.includes(mg.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onItemFormChange({ ...itemForm, modifierGroupIds: [...itemForm.modifierGroupIds, mg.id] })
                      } else {
                        onItemFormChange({ ...itemForm, modifierGroupIds: itemForm.modifierGroupIds.filter(id => id !== mg.id) })
                      }
                    }}
                    className="rounded"
                  />
                  <span>{mg.name}</span>
                  {mg.required && <Badge variant="destructive" className="text-[9px] h-3.5 px-1 ml-auto">Obvezno</Badge>}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="item-available" checked={itemForm.isAvailable} onCheckedChange={(c) => onItemFormChange({ ...itemForm, isAvailable: c })} />
            <Label htmlFor="item-available">Na voljo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!itemForm.name || !itemForm.price || !itemForm.categoryId}>
            {editingItem ? 'Posodobi' : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
