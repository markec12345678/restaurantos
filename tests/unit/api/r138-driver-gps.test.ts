// R138 — driver GPS: čisti helperji iz src/app/driver/useDriverLocation.ts
// (throttle + izbira aktivnih dostav). Geolocation/browser API ni testiran
// v unit okolju (živa verifikacija prek agent-browser set geo) — tu sta
// SAMO čisti funkciji, ki ju hook uporablja za odločanje.
import { describe, expect, it } from 'vitest'
import {
  GPS_SEND_INTERVAL_MS,
  pickActiveDeliveryIds,
  shouldSendGps,
} from '@/app/driver/useDriverLocation'

describe('shouldSendGps — 30 s throttle + vidnost', () => {
  it('prvi pošilja (lastSentAt null) je dovoljen ko je stran vidna', () => {
    expect(shouldSendGps(1_000, null, true)).toBe(true)
  })

  it('prvi pošilja NI dovoljen ko stran NI vidna (baterija)', () => {
    expect(shouldSendGps(1_000, null, false)).toBe(false)
  })

  it('tik po pošiljanju je blokiran (throttle)', () => {
    const now = 10_000
    expect(shouldSendGps(now + 1, now, true)).toBe(false)
    expect(shouldSendGps(now + GPS_SEND_INTERVAL_MS - 1, now, true)).toBe(false)
  })

  it('ob meji 30 s je spet dovoljen', () => {
    const now = 10_000
    expect(shouldSendGps(now + GPS_SEND_INTERVAL_MS, now, true)).toBe(true)
    expect(shouldSendGps(now + GPS_SEND_INTERVAL_MS + 5_000, now, true)).toBe(true)
  })

  it('vidnost prevlada: po 30 s nevidna stran NE pošilja', () => {
    const now = 10_000
    expect(shouldSendGps(now + GPS_SEND_INTERVAL_MS * 3, now, false)).toBe(false)
  })
})

describe('pickActiveDeliveryIds — samo aktivni statusi, defenzivno', () => {
  it('prazen seznam → prazno', () => {
    expect(pickActiveDeliveryIds([])).toEqual([])
  })

  it('vse aktivne dostave → deliveryInfoId-ji v vrstnem redu', () => {
    const mine = [
      { deliveryInfoId: 'a', status: 'assigned' },
      { deliveryInfoId: 'b', status: 'picked_up' },
      { deliveryInfoId: 'c', status: 'on_the_way' },
      { deliveryInfoId: 'd', status: 'arriving' },
    ]
    expect(pickActiveDeliveryIds(mine)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('delivered/failed so izključeni (terminalna stanja ne nosijo GPS)', () => {
    const mine = [
      { deliveryInfoId: 'active-1', status: 'on_the_way' },
      { deliveryInfoId: 'done-1', status: 'delivered' },
      { deliveryInfoId: 'fail-1', status: 'failed' },
    ]
    expect(pickActiveDeliveryIds(mine)).toEqual(['active-1'])
  })

  it('neznani statusi in prazni id-ji odpadejo (normalizacija na meji)', () => {
    const mine = [
      { deliveryInfoId: 'ok-1', status: 'picked_up' },
      { deliveryInfoId: 'x', status: 'hacked' },
      { deliveryInfoId: '', status: 'assigned' },
    ]
    expect(pickActiveDeliveryIds(mine)).toEqual(['ok-1'])
  })
})
