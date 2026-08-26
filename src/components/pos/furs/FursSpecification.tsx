'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FursSpecificationProps } from './constants'

// ============================================
// SPECIFIKACIJA FURS OVERJANJA — Informacije o standardu
// ============================================

export const FursSpecification = memo(function FursSpecification(_props: FursSpecificationProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Specifikacija FURS overjanja</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2 text-muted-foreground">
        <p>RestaurantOS implementira FURS davčno potrjevanje po specifikaciji ZDDV-1:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>ZOI</strong> (Zaščitni Oznak Izdajatelja) — RSA-SHA256 podpis podatkov računa</li>
          <li><strong>EOR</strong> (Enotna Oznaka Računa) — potrditev FURS strežnika</li>
          <li><strong>OAuth2</strong> avtentikacija z JWT Bearer (RS256)</li>
          <li><strong>PKCS12</strong> certifikat — podpora za OpenSSL + Node.js crypto fallback</li>
          <li><strong>QR koda</strong> za preverjanje na <a href="https://blagajne.fu.gov.si/validation" target="_blank" className="underline">blagajne.fu.gov.si</a></li>
          <li><strong>DDV stopnje</strong>: 22% (standardna), 9.5% (znižana), 0% (oproščeno)</li>
          <li><strong>FURS kode</strong>: S = Standardna, R = Znižana, Z = Oproščeno</li>
        </ul>
      </CardContent>
    </Card>
  )
})
