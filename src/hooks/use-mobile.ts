import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      // FIX: Uporabi mql.matches namesto window.innerWidth — pravilna MediaQueryList vrednost
      setIsMobile(mql.matches)
    }
    mql.addEventListener("change", onChange)
    // FIX: Uporabi mql.matches za začetno vrednost
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
