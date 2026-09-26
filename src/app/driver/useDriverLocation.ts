'use client'

import { useEffect, useRef, useState } from 'react'
import { authPostJson } from './driver-context'
import type { MineDelivery } from './useDriverAssignments'

// =====================================================================
// useDriverLocation — GPS pošiljanje med aktivno dostavo (R138, epic
// #115 P1-13 dopolnitev). Server pot obstaja od R112 (POST
// /api/delivery-tracking { deliveryInfoId, latitude, longitude } —
// handleLocationUpdate s scope guardom); UI je do zdaj NAMENOMO molčal
// (privolitev + baterija).
//
// Zasebnost / baterija (kanon):
//  - permission prompt ŠELE ob prvi aktivni dostavi (voznik brez
//    dostave ne izdaja lokacije — prompt nikoli ob odprtju zaslona)
//  - watchPosition teče samo med aktivno dostavo; cleanup takoj, ko
//    mine[] izprazni (delivered/failed odpadeta ob naslednjem pollu)
//  - POST samo ko je zaslon VIDEN (document.visibilityState) — v ozadju
//    brez omrežja; throttle največ 1 POST / 30 s (GPS_SEND_INTERVAL_MS)
//  - ob prevzemu (prazno → ne-prazno) TAKOJ pošlji svežo pozicijo —
//    dispečer takoj vidi, kje je voznik
//  - napake TIHE (console.warn) — nikoli ne motijo voznikovega toka;
//    401 puščamo useDriverAssignments (authFetch počisti žeton, poll
//    preklopi na prijavo)
// Dispatcher vidi pozicijo prek obstoječega DeliveryTracker modula
// (GET /api/delivery-tracking vrača currentLat/currentLng/lastUpdateAt).
// =====================================================================

/** Najmanjši razmik med GPS POST-i (baterija + rate limit) */
export const GPS_SEND_INTERVAL_MS = 30_000
/** Interval notranje kontrole "ali pošlji" (throttle to evalvira) */
const GPS_TICK_MS = 5_000

export type GpsState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'

/** Ali sme ta tick poslati GPS (30 s throttle + samo vidna stran) */
export function shouldSendGps(
  now: number,
  lastSentAt: number | null,
  visible: boolean,
): boolean {
  if (!visible) return false
  if (lastSentAt === null) return true
  return now - lastSentAt >= GPS_SEND_INTERVAL_MS
}

/** deliveryInfoId-ji aktivnih dostav (defenzivno: samo znani aktivni statusi) */
export function pickActiveDeliveryIds(
  mine: readonly { deliveryInfoId: string; status: string }[],
): string[] {
  const ACTIVE: readonly string[] = ['assigned', 'picked_up', 'on_the_way', 'arriving']
  return mine
    .filter((m) => ACTIVE.includes(m.status))
    .map((m) => m.deliveryInfoId)
    .filter((id) => id !== '')
}

function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export interface DriverLocationState {
  /** idle (brez aktivnih) | requesting | granted | denied | unavailable */
  gpsState: GpsState
}

export function useDriverLocation(
  mine: MineDelivery[],
  enabled: boolean,
): DriverLocationState {
  const [gpsState, setGpsState] = useState<GpsState>('idle')

  const activeIdsRef = useRef<string[]>([])
  const activeSignatureRef = useRef('')
  const watchIdRef = useRef<number | null>(null)
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastSentAtRef = useRef<number | null>(null)
  const visibleRef = useRef(true)
  const gpsStateRef = useRef<GpsState>('idle')

  const setGps = (state: GpsState): void => {
    gpsStateRef.current = state
    setGpsState(state)
  }
  // set-state-in-effect kanon (page.tsx vzor): setState v effect telesu
  // vedno prek defer — sinkroni setState v effect telesu sicer sproži
  // cascading renders (eslint react-hooks pravilo). Callbacki zunanjih
  // sistemov (watchPosition, interval) smejo setState direktno.
  const deferSetGps = (state: GpsState): void => {
    setTimeout(() => setGps(state), 0)
  }

  // --- vidnost: POST samo ko je zaslon viden (baterija) ---
  useEffect(() => {
    if (!enabled) return
    visibleRef.current = document.visibilityState === 'visible'
    const onVisibility = (): void => {
      visibleRef.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])

  // --- watch lifecycle glede na aktivne dostave ---
  useEffect(() => {
    if (!enabled) return
    const ids = pickActiveDeliveryIds(mine)
    activeIdsRef.current = ids
    const signature = ids.join(',')
    const wasEmpty = activeSignatureRef.current === ''
    const nowActive = signature !== ''
    activeSignatureRef.current = signature

    if (ids.length === 0) {
      if (gpsStateRef.current !== 'denied' && gpsStateRef.current !== 'unavailable') {
        deferSetGps('idle')
      }
      if (watchIdRef.current !== null && isGeolocationAvailable()) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    if (!isGeolocationAvailable()) {
      deferSetGps('unavailable')
      return
    }

    if (watchIdRef.current === null) {
      deferSetGps('requesting')
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos: GeolocationPosition) => {
          lastPositionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          if (gpsStateRef.current !== 'granted') setGps('granted')
        },
        (err: GeolocationPositionError) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGps('denied')
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current)
              watchIdRef.current = null
            }
            return
          }
          // POSITION_UNAVAILABLE / TIMEOUT — obdrži watch, še vedno 'requesting'
        },
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 15_000 },
      )
    }

    // Ob novem claimu (prazno → ne-prazno) takojšen prvi POST: reset
    // throttle-a, tako da tick pošlje takoj, ne čaka 30 s
    if (wasEmpty && nowActive) lastSentAtRef.current = null
  }, [mine, enabled])

  // --- tick: evalviraj shouldSendGps + POST za vse aktivne dostave ---
  useEffect(() => {
    if (!enabled) return
    const send = (): void => {
      const ids = activeIdsRef.current
      if (ids.length === 0) return
      const pos = lastPositionRef.current
      if (!pos) return
      if (!shouldSendGps(Date.now(), lastSentAtRef.current, visibleRef.current)) return
      lastSentAtRef.current = Date.now()
      for (const deliveryInfoId of ids) {
        authPostJson('/api/delivery-tracking', {
          deliveryInfoId,
          latitude: pos.lat,
          longitude: pos.lng,
        })
          .then((res: Response) => {
            // ne-ok odgovor (404 tuj scope / 409 stale) — TIHO (hišno pravilo:
            // brez console v client hookih); indikator + naslednji tick
            // pošljeta znova, useDriverAssignments ob 401 preklopi na prijavo
            void res
          })
          .catch(() => {
            // mrežna napaka — tiho (stale-while-error kanon); naslednji tick
          })
      }
    }
    const tick = setInterval(send, GPS_TICK_MS)
    return () => clearInterval(tick)
  }, [enabled])

  return { gpsState }
}
