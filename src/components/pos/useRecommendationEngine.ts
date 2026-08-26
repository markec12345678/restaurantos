'use client'

import { useMemo } from 'react'
import type { MenuItemData, Recommendation } from './ai-recommendations/constants'

export function useRecommendationEngine(menuItems: MenuItemData[] | undefined) {
  const recommendations = useMemo(() => {
    const items = (menuItems || []) as MenuItemData[]
    if (!items.length) return []

    const now = new Date()
    const hour = now.getHours()
    const month = now.getMonth()
    const dayOfWeek = now.getDay()

    const recs: Recommendation[] = []

    for (const item of items) {
      let score = 0
      const reasons: string[] = []
      let category: Recommendation['category'] = 'popular'

      // 1. Popularnost
      const totalOrders = item.orderItems?.length || 0
      const popularityScore = Math.min(totalOrders / 50, 1) * 30
      score += popularityScore
      if (totalOrders > 20) reasons.push(`Popularno (${totalOrders}x naročeno)`)
      if (totalOrders > 50) reasons.push('Top prodajalec')

      // 2. Profitabilnost
      const profitScore = Math.min(item.price / 20, 1) * 25
      score += profitScore
      if (item.price >= 15) {
        reasons.push(`Visoka marža (€${item.price.toFixed(2)})`)
        if (category === 'popular') category = 'profitable'
      }

      // 3. Čas dneva
      const categoryName = item.category?.name?.toLowerCase() || ''
      const menuName = item.category?.menu?.name?.toLowerCase() || ''

      if (hour >= 6 && hour <= 10) {
        if (categoryName.includes('zajtrk') || categoryName.includes('kava') || menuName.includes('zajtrk')) {
          score += 20; reasons.push('Ustrezno za jutranji meni')
          if (category === 'popular') category = 'seasonal'
        }
      }
      if (hour >= 11 && hour <= 14) {
        if (categoryName.includes('kosilo') || categoryName.includes('dnevna') || categoryName.includes('business')) {
          score += 20; reasons.push('Priljubljeno ob kosilu')
          if (category === 'popular') category = 'seasonal'
        }
      }
      if (hour >= 18 && hour <= 22) {
        if (categoryName.includes('večer') || categoryName.includes('glavne') || categoryName.includes('steak')) {
          score += 15; reasons.push('Priljubljeno za večerjo')
          if (category === 'popular') category = 'seasonal'
        }
      }

      // 4. Sezona
      if (month >= 5 && month <= 8) {
        if (categoryName.includes('solat') || categoryName.includes('hladn') || categoryName.includes('sladice')) {
          score += 15; reasons.push('Poletni hit')
          if (category === 'popular') category = 'seasonal'
        }
      }
      if (month >= 11 || month <= 1) {
        if (categoryName.includes('juh') || categoryName.includes('tople') || categoryName.includes('vroč')) {
          score += 15; reasons.push('Zimski hit')
          if (category === 'popular') category = 'seasonal'
        }
      }

      // 5. Trending
      const recentOrders = (item.orderItems || []).filter(oi => {
        const d = new Date(oi.createdAt)
        return now.getTime() - d.getTime() < 7 * 86400000
      })
      const olderOrders = (item.orderItems || []).filter(oi => {
        const d = new Date(oi.createdAt)
        const diff = now.getTime() - d.getTime()
        return diff >= 7 * 86400000 && diff < 14 * 86400000
      })
      if (recentOrders.length > olderOrders.length * 1.3 && recentOrders.length >= 3) {
        score += 20
        reasons.push(`Rastoča prodaja (+${Math.round(((recentOrders.length / Math.max(olderOrders.length, 1)) - 1) * 100)}%)`)
        if (category === 'popular') category = 'trending'
      }

      // 6. Upsell
      if (item.price >= 8 && item.price <= 15 && totalOrders > 10) {
        score += 10; reasons.push('Odlična upsell priložnost')
        if (category === 'popular') category = 'upsell'
      }

      // Vikend bonus
      if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        if (categoryName.includes('sladice') || categoryName.includes('palačinke') || categoryName.includes('desert')) {
          score += 10; reasons.push('Vikendski priljubljenec')
        }
      }

      if (reasons.length > 0 && score > 15) {
        recs.push({ item, score: Math.round(score), reasons, category })
      }
    }

    return recs.sort((a, b) => b.score - a.score).slice(0, 30)
  }, [menuItems])

  return recommendations
}
