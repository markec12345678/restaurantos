'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { applyPinDigit, hapticFeedback } from './pin-digit'
import { PIN_MIN_LENGTH, authEmployeesQueryKey } from './constants'
import type { PinLoginProps, LoginStep, EmployeesResponse, SelectedEmployee } from './constants'
import type { LoginResult } from './login-request'
import { setCurrentUser, setAuthToken } from '../PinLogin'
import { cacheOfflineSession, getOfflineSessionHint } from './offline-auth'
import { performLogin } from './login-request'
import { readDeviceLocation, persistDeviceLocation } from './resolveDeviceLocation'
import { getDeviceId } from '@/lib/offline-orders'
import { logger } from '@/lib/logger'

// NOVO (QA 2026-09-17, runda 25 — UI/UX primerjava z najboljšimi POS):
// Square/Clover na fizičnih tipkovnicah POS terminalov dovoljujeta vpis PIN-a
// s števkami + Backspace/Enter. Prej je bila tipkovnica MRTVA koda
// (_handleKeyDown ni bil nikoli povezan) — zdaj window listener.
// Čisti helperji (applyPinDigit, hapticFeedback) živijo v ./pin-digit,
// čista oddaja prijave (performLogin) pa v ./login-request (testabilnost).

// R95-b: DVOSTOPENJSKA PRIJAVA (izbira zaposlenega → PIN, Toast/Square
// standard). Tok je aktiven SAMO, ko naprava ve svojo lokacijo
// (URL ?locationId= ALI localStorage 'restaurantos-pos-device-location' —
// resolucija v ./resolveDeviceLocation). Sicer 'single' = STOTAKO kot danes
// (E2E /?PIN prijava ostane PIN-only, body brez employeeId).
// Offline pot je NESPREMJENA (PIN-only, glej login-request.ts).

// ============================================
// HOOK: PIN prijava
// Združuje stanje, poizvedbe in mutacije za PIN login
// ============================================

/** staleTime za seznam zaposlenih — med korakoma 1↔2 brez refetch ping-ponga */
const EMPLOYEES_STALE_TIME_MS = 5 * 60 * 1000

/**
 * R128: registracija naprave v DeviceRegistry — fire-and-forget ob uspešni
 * ONLINE prijavi (offline seja nima žetona → preskočena). Tiha napaka:
 * strežnik napravo vseeno avtomatsko registrira ob prvem syncu. Namerno
 * NE uporablja authFetch (401 iz /api/devices NE sme počistiti sveže seje)
 * in NE blokira ne zakasni prijave.
 */
async function registerDeviceAfterLogin(token: string): Promise<void> {
  const deviceId = getDeviceId()
  try {
    await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        deviceId,
        name: `POS-${deviceId.slice(0, 8)}`,
        type: 'pos',
        appVersion: '',
      }),
    })
  } catch (err) {
    logger.warn('PinLogin', `R128: registracija naprave ni uspela (strežnik jo opravi ob prvem syncu): ${String(err)}`)
  }
}

export function usePinLogin(_props: PinLoginProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const firstDigitRef = useRef<HTMLButtonElement>(null)
  // NOVA FUNKCIONALNOST (runda 6): namig "offline prijava na voljo" na prijavnem
  // ekranu — natakar takoj ve, da brez mreže NE ostane na zunanji strani.
  // useEffect (ne med renderjem): localStorage je client-only + izognemo se
  // SSR hydration mismatchu.
  // R95-b stanja dvostopenjskega toka. Korak ('step') je IZPELJAN spodaj (ne
  // mirror-state — react "you might not need an effect"): deviceLocationId je
  // resolvan odloženo (post-hidracija), selectedEmployee/pinOnlyPreference sta
  // uporabniški akciji, fallback pa izpeljan iz employeesQuery stanja.
  const [deviceLocationId, setDeviceLocationId] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<SelectedEmployee | null>(null)
  // "Prijava samo s PIN-om" — izrecen uporabnikov izklop dvostopenjskega toka
  // (super-admini / NULL-lokacijski zaposleni, ki niso v gridu).
  const [pinOnlyPreference, setPinOnlyPreference] = useState(false)

  // Resolucija device lokacije: URL param > localStorage > null (čisti helper
  // v resolveDeviceLocation.ts — testabilen brez react-query).
  // Odmik prek setTimeout(0): branje window/localStorage je client-only in se
  // MORA zgoditi šele po hidraciji (SSR hydration mismatch) — odložen init je
  // tudi vzorec, ki ga zahteva react-hooks v7 (set-state-in-effect: neposreden
  // sinhroni setState v mount-only efektu = cascading render opozorilo).
  useEffect(() => {
    const timer = setTimeout(() => setDeviceLocationId(readDeviceLocation()), 0)
    return () => clearTimeout(timer)
  }, [])

  const [offlineHint, setOfflineHint] = useState<{ name: string; expiresInMs: number } | null>(null)
  useEffect(() => {
    // Enak odložen vzorec kot device lokacija zgoraj (post-hidracijsko branje
    // localStorage; runda 6 funkcionalnost, semantika nespremenjena).
    const timer = setTimeout(() => setOfflineHint(getOfflineSessionHint()), 0)
    return () => clearTimeout(timer)
  }, [])

  // Preveri ali so PIN-i na voljo (NESPREMJENO)
  const { data: authStatus } = useQuery({
    queryKey: queryKeys.auth.status,
    queryFn: async () => {
      const res = await fetch('/api/auth')
      if (!res.ok) return { authEnabled: false, employeesWithPin: 0 }
      return res.json()
    },
  })

  // R95-b: seznam zaposlenih na device lokaciji (korak 1).
  // LOKALNA hierarhična tipka (authEmployeesQueryKey v constants.ts) —
  // globalnega query-keys fajla namenoma NE urejamo (lastninska lista).
  // retry: false + fail-open fallback = 404/429 ne sme obesiti prijave.
  // enabled: poteka samo med dvostopenjskim tokom (korak 1/2, brez izrecnega
  // pin-only preklopa) — po uspešni prijavi je uporabnik že onstran tega ekrana.
  const employeesQuery = useQuery({
    queryKey: authEmployeesQueryKey(deviceLocationId),
    queryFn: async (): Promise<EmployeesResponse> => {
      const res = await fetch(`/api/auth/employees?locationId=${encodeURIComponent(deviceLocationId ?? '')}`)
      if (!res.ok) throw new Error(`Employees list failed (${res.status})`)
      return res.json()
    },
    enabled: !!deviceLocationId && !selectedEmployee && !pinOnlyPreference,
    staleTime: EMPLOYEES_STALE_TIME_MS,
    retry: false,
  })

  // Fail-open (izpeljan, brez efekta/extra stanja): employees endpoint 404/429/
  // omreža ALI potrjen prazen seznam → avtomatsko single-step PIN UI + notice.
  // NIKOLI ne blokiraj prijave (binding je optional — fail-open je na UX, NE na
  // varnost). Med korakom 2 (selectedEmployee) napaka ne pere izbire.
  const employeesBroken = !!employeesQuery.isError ||
    (!!employeesQuery.data && employeesQuery.data.employees.length === 0)
  const employeesUnavailable = !!deviceLocationId && !pinOnlyPreference && !selectedEmployee && employeesBroken

  // Izpeljan korak toka:
  //   'pin'    = izbran zaposleni (korak 2; napačen PIN OSTANE tu — onError
  //              namenoma ne počisti selectedEmployee),
  //   'select' = device lokacija znana, dvostopenjski tok aktiven, endpoint zdrav,
  //   'single' = legacy PIN-only (privzeto brez lokacije / izrecen pin-only /
  //              fail-open fallback — E2E /?PIN prijava ostane točno kot danes).
  const step: LoginStep = selectedEmployee
    ? 'pin'
    : deviceLocationId && !pinOnlyPreference && !employeesBroken ? 'select' : 'single'

  // A11y: Samodejno premakni fokus na prvo stevko ob prikazu PIN UI-ja
  // (v koraku 1 'select' fokus vodi EmployeeSelectStep na prvi gumb grida).
  useEffect(() => {
    if (step === 'select') return
    const timer = setTimeout(() => firstDigitRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [step])

  const loginMutation = useMutation({
    mutationFn: async ({ pinCode, employeeId }: { pinCode: string; employeeId?: string }): Promise<LoginResult> =>
      // Čista oddaja (login-request.ts): employeeId PODAN samo v
      // dvostopenjskem toku (strog binding), sicer PIN-only kontrakt.
      performLogin(pinCode, employeeId),
    onSuccess: (data, variables, _context) => {
      setCurrentUser(data.employee)
      if (data.offline) {
        // Offline seja NIMA žetona — vse API poizvedbe ne bodo uspele,
        // ampak offline naročila se vrstijo lokalno in gredo ob povezavi.
        setAuthToken(null)
        toast.warning('OFFLINE način — naročila se bodo samodejno poslala ob vrnitvi povezave', { duration: 8000 })
      } else {
        setAuthToken(data.token ?? null)
        // Shrani sejo za prihodnje offline prijave (tiho — ne sme pokvariti online toka)
        void cacheOfflineSession(data.employee, variables.pinCode)
        // R128: registracija naprave — fire-and-forget (ne blokira ne zakasni prijave)
        if (data.token) void registerDeviceAfterLogin(data.token)
        // R95-b ODLOČITEV: device lokacijo OBNOVIMO/potrdimo SAMO, če je bil
        // dvostopenjski tok aktiven (deviceLocationId je že resolvan iz
        // URL/localStorage virov). NAMERNO NE beremo data.employee.locationId —
        // frozen API kontrakt (R95-a) tega polja v odgovoru NE jamči.
        // Ob NEUSPEŠNI prijavi se ne shrani NIČ (onError se tega ne dotakne).
        if (deviceLocationId) persistDeviceLocation(deviceLocationId)
      }
      setPin('')
      setError('')
      toast.success(data.message)
      _props.onLogin(data.employee)
    },
    onError: (err: Error) => {
      setError(err.message)
      setPin('')
      // R95-b: NAPAČEN PIN v koraku 2 → ostani v koraku 2 (izbira zaposlenega
      // ostane) — selectedEmployee se tukaj namenoma NE počisti.
    },
  })

  const handlePinSubmit = useCallback(() => {
    if (loginMutation.isPending) return
    if (pin.length < PIN_MIN_LENGTH) {
      setError(`Vnesite vsaj ${PIN_MIN_LENGTH} stevke`)
      return
    }
    setError('')
    hapticFeedback(20)
    // employeeId SAMO, če je zaposleni izbran (dvostopenjski tok); v
    // single-step je selectedEmployee null → undefined → PIN-only body.
    loginMutation.mutate({ pinCode: pin, employeeId: selectedEmployee?.id })
  }, [pin, loginMutation, selectedEmployee])

  // FIX runda 25: prej _handleKeyDown (Enter-only) NI bil nikoli povezan —
  // fizična tipkovnica na POS terminalu NI delovala. Zdaj window listener
  // (številke + Backspace + Enter), povezan ob mountu prijavnega ekrana.
  const handleDigit = useCallback((digit: string) => {
    hapticFeedback(10)
    const { pin: next, autoSubmit } = applyPinDigit(pin, digit)
    if (next !== pin) {
      setPin(next)
      setError('')
    }
    if (autoSubmit && !loginMutation.isPending) {
      loginMutation.mutate({ pinCode: next, employeeId: selectedEmployee?.id })
    }
  }, [pin, loginMutation, selectedEmployee])

  const handleBackspace = useCallback(() => {
    hapticFeedback(15)
    setPin(prev => prev.slice(0, -1))
    setError('')
  }, [])

  useEffect(() => {
    // R95-b: v koraku 1 ('select') tipkovnica NE sme vpiševati PIN-a —
    // uporabnik izbere ime, ne tipka. Fallback UI (single) je aktiven, ko je
    // step 'single', zato tam tipkovnica deluje kot doslej.
    if (step === 'select') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
        return
      }
      if (e.key === 'Backspace') {
        // prepreči navigacijo nazaj (stari browserji) / dvojni vnos
        e.preventDefault()
        handleBackspace()
        return
      }
      if (e.key === 'Enter') {
        // preventDefault: prepreči "klik" gumba, ki ima naključno fokus
        // (sicer bi Enter sprožil submit DVAKRAT)
        e.preventDefault()
        handlePinSubmit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, handleDigit, handleBackspace, handlePinSubmit])

  // --- R95-b: prehodi med koraki (korak 'step' je izpeljan iz stanj) ---

  /** Korak 1 → 2: izbran zaposleni, PIN vpis se začne čist. */
  const selectEmployee = useCallback((employee: SelectedEmployee) => {
    hapticFeedback(10)
    setSelectedEmployee(employee)
    setPin('')
    setError('')
  }, [])

  /** Korak 2 → 1: "Spremeni" — nazaj na grid (izbira se počisti). */
  const backToEmployeeSelect = useCallback(() => {
    hapticFeedback(10)
    setSelectedEmployee(null)
    setPin('')
    setError('')
  }, [])

  /** Izklop dvostopenjskega toka: "Prijava samo s PIN-om" (single-step, brez notice). */
  const switchToSingleStep = useCallback(() => {
    setPinOnlyPreference(true)
    setSelectedEmployee(null)
    setPin('')
    setError('')
  }, [])

  return {
    pin, error, authStatus,
    firstDigitRef,
    loginMutation,
    handlePinSubmit,
    handleDigit,
    handleBackspace,
    offlineHint,
    // R95-b: dvostopenjski tok (step je izpeljan; employeesUnavailable je
    // izpeljana fail-open zastavica za notice na single-step zaslonu)
    step,
    deviceLocationId,
    selectedEmployee,
    employeesQuery,
    employeesUnavailable,
    selectEmployee,
    backToEmployeeSelect,
    switchToSingleStep,
  }
}
