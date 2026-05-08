import { useState } from 'react'
import { PROFILES } from '../constants/profiles'

const KEY = 'prospect_profile_overrides'

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function useProfiles() {
  const [overrides, setOverrides] = useState(loadOverrides)

  function save(next) {
    setOverrides(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }

  function updateGiros(key, giros) {
    save({ ...loadOverrides(), [key]: giros })
  }

  function resetProfile(key) {
    const next = { ...loadOverrides() }
    delete next[key]
    save(next)
  }

  const allProfiles = PROFILES.map(p => ({
    ...p,
    giros:    overrides[p.key] ?? p.giros,
    modified: !!overrides[p.key],
  }))

  return { allProfiles, updateGiros, resetProfile }
}
