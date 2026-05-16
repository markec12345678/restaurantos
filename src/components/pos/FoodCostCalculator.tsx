'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/components/pos/PinLogin';

interface FoodCostItem {
  id: string;
  name: string;
  category: string;
  salesCategory: string;
  sellingPriceExVat: number;
  vatRate: number;
  sellingPriceInclVat: number;
  totalIngredientCost: number;
  foodCostPercent: number;
  grossProfit: number;
  grossMarginPercent: number;
  classification: string;
  suggestedPrice: number;
  priceDifference: number;
  ingredients: any[];
  hasRecipe: boolean;
  allergens: string;
}

interface FoodCostSummary {
  totalItems: number;
  itemsWithRecipes: number;
  itemsWithoutRecipes: number;
  avgFoodCost: number;
  avgGrossMargin: number;
  stars: number;
  plowhorses: number;
  puzzles: number;
  dogs: number;
  itemsOverTarget: number;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  Star: 'bg-green-100 text-green-800 border-green-300',
  Plowhorse: 'bg-blue-100 text-blue-800 border-blue-300',
  Puzzle: 'bg-purple-100 text-purple-800 border-purple-300',
  Dog: 'bg-red-100 text-red-800 border-red-300',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  Star: '⭐ Zvezda — Visoka marža, prodajna',
  Plowhorse: '🐴 Delni konj — Priljubljena, nižja marža',
  Puzzle: '🧩 Uganka — Visoka marža, manj prodajna',
  Dog: '🐕 Pes — Nizka marža, manj prodajna',
};

export default function FoodCostCalculator() {
  const [items, setItems] = useState<FoodCostItem[]>([]);
  const [summary, setSummary] = useState<FoodCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('foodCostDesc');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => { fetchAnalysis(); }, []);

  async function fetchAnalysis() {
    try {
      const res = await authFetch('/api/food-cost');
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setSummary(data?.summary || null);
    } catch (e) {
      console.error('Error fetching food cost:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items
    .filter(item => {
      if (filter === 'all') return true;
      if (filter === 'no_recipe') return !item.hasRecipe;
      if (filter === 'over_target') return item.foodCostPercent > 30;
      return item.classification === filter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'foodCostDesc': return b.foodCostPercent - a.foodCostPercent;
        case 'foodCostAsc': return a.foodCostPercent - b.foodCostPercent;
        case 'marginDesc': return b.grossMarginPercent - a.grossMarginPercent;
        case 'marginAsc': return a.grossMarginPercent - b.grossMarginPercent;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-gray-500">Analiziram stroške hrane...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">💰 Izračun cene jedi</h2>
          <span className="text-xs text-gray-500">Food Cost Calculator</span>
        </div>
        <button
          onClick={fetchAnalysis}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          🔄 Osveži
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b bg-gray-50">
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-800">{summary.avgFoodCost}%</p>
            <p className="text-xs text-gray-500">Povpr. food cost</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{summary.avgGrossMargin}%</p>
            <p className="text-xs text-gray-500">Povpr. bruto marža</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{summary.stars} ⭐</p>
            <p className="text-xs text-gray-500">Zvezde</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-purple-600">{summary.puzzles} 🧩</p>
            <p className="text-xs text-gray-500">Uganke</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-red-600">{summary.itemsOverTarget}</p>
            <p className="text-xs text-gray-500">Nad 30% FC</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 p-3 border-b flex-wrap">
        <span className="text-xs text-gray-500">Filter:</span>
        {[
          { key: 'all', label: 'Vsi' },
          { key: 'Star', label: '⭐ Zvezde' },
          { key: 'Plowhorse', label: '🐴 Delni konji' },
          { key: 'Puzzle', label: '🧩 Uganke' },
          { key: 'Dog', label: '🐕 Psi' },
          { key: 'over_target', label: '⚠️ Nad 30%' },
          { key: 'no_recipe', label: '📝 Brez recepta' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-2 py-1 rounded-full transition ${
              filter === f.key
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-2">|</span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="foodCostDesc">Food cost ↓</option>
          <option value="foodCostAsc">Food cost ↑</option>
          <option value="marginDesc">Marža ↓</option>
          <option value="marginAsc">Marža ↑</option>
          <option value="name">Po imenu</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">
          {filteredItems.length} od {items.length} artiklov
        </span>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.map(item => (
          <div key={item.id} className="border-b">
            <div
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              {/* Classification Badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CLASSIFICATION_COLORS[item.classification]}`}>
                {item.classification === 'Star' ? '⭐' : item.classification === 'Plowhorse' ? '🐴' : item.classification === 'Puzzle' ? '🧩' : '🐕'}
              </span>

              {/* Name & Category */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.category} • {item.salesCategory}</p>
              </div>

              {/* Food Cost */}
              <div className="text-right">
                <p className={`text-sm font-bold ${
                  item.foodCostPercent > 35 ? 'text-red-600' : item.foodCostPercent > 28 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {item.hasRecipe ? `${item.foodCostPercent}%` : '—'}
                </p>
                <p className="text-[10px] text-gray-400">food cost</p>
              </div>

              {/* Price */}
              <div className="text-right w-20">
                <p className="text-sm font-medium">€{item.sellingPriceInclVat.toFixed(2)}</p>
                {item.priceDifference > 0.5 && (
                  <p className="text-[10px] text-red-500">Predlagano: €{item.suggestedPrice.toFixed(2)}</p>
                )}
              </div>

              {/* Expand indicator */}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedItem === item.id ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded Detail */}
            {expandedItem === item.id && (
              <div className="px-3 pb-3 ml-8">
                {!item.hasRecipe ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    📝 Za ta artikel ni definiranega recepta. Dodajte recept v upravljanju receptov za izračun food cost.
                  </div>
                ) : (
                  <>
                    {/* Margin Breakdown */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-gray-50 rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Prodajna cena</p>
                        <p className="font-bold text-sm">€{item.sellingPriceInclVat.toFixed(2)}</p>
                      </div>
                      <div className="bg-red-50 rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Strošek sestavin</p>
                        <p className="font-bold text-sm text-red-600">€{item.totalIngredientCost.toFixed(2)}</p>
                      </div>
                      <div className="bg-green-50 rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Bruto dobiček</p>
                        <p className="font-bold text-sm text-green-600">€{item.grossProfit.toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-50 rounded p-2 text-center">
                        <p className="text-xs text-gray-500">Bruto marža</p>
                        <p className="font-bold text-sm text-blue-600">{item.grossMarginPercent}%</p>
                      </div>
                    </div>

                    {/* Classification Explanation */}
                    <div className={`rounded-lg p-2 mb-3 text-xs ${CLASSIFICATION_COLORS[item.classification]}`}>
                      {CLASSIFICATION_LABELS[item.classification]}
                    </div>

                    {/* Ingredients Table */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="text-left py-1">Sestavina</th>
                          <th className="text-right py-1">Količina</th>
                          <th className="text-right py-1">Cena/enoto</th>
                          <th className="text-right py-1">Skupaj</th>
                          <th className="text-right py-1">Zaloga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.ingredients.map((ing: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-1">{ing.name}</td>
                            <td className="text-right">{ing.quantity} {ing.unit}</td>
                            <td className="text-right">€{ing.costPerUnit.toFixed(2)}</td>
                            <td className="text-right font-medium">€{ing.totalCost.toFixed(2)}</td>
                            <td className="text-right">
                              <span className={ing.stockLevel <= 5 ? 'text-red-500' : 'text-gray-500'}>
                                {ing.stockLevel} {ing.stockUnit}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Price Suggestion */}
                    {item.priceDifference > 0.5 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs">
                        💡 <strong>Predlagana cena:</strong> €{item.suggestedPrice.toFixed(2)} (razlika: +€{item.priceDifference.toFixed(2)})
                        — glede na ciljni food cost 28%
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
