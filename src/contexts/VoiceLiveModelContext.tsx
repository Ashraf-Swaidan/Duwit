import { createContext, useContext, useState, type ReactNode } from "react"
import type { VoiceLiveModelChoice } from "@/config/geminiMedia"

const STORAGE_KEY = "duwit_voice_live_model"
const DEFAULT_CHOICE: VoiceLiveModelChoice = "gemini31FlashLive"

interface VoiceLiveModelContextValue {
  voiceLiveModel: VoiceLiveModelChoice
  setVoiceLiveModel: (choice: VoiceLiveModelChoice) => void
}

const VoiceLiveModelContext = createContext<VoiceLiveModelContextValue>({
  voiceLiveModel: DEFAULT_CHOICE,
  setVoiceLiveModel: () => {},
})

function readStoredChoice(): VoiceLiveModelChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "gemini25NativeAudio" || stored === "gemini31FlashLive") {
      return stored
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CHOICE
}

export function VoiceLiveModelProvider({ children }: { children: ReactNode }) {
  const [voiceLiveModel, setVoiceLiveModelState] = useState<VoiceLiveModelChoice>(readStoredChoice)

  function setVoiceLiveModel(choice: VoiceLiveModelChoice) {
    setVoiceLiveModelState(choice)
    try {
      localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      /* ignore */
    }
  }

  return (
    <VoiceLiveModelContext.Provider value={{ voiceLiveModel, setVoiceLiveModel }}>
      {children}
    </VoiceLiveModelContext.Provider>
  )
}

export function useVoiceLiveModel() {
  return useContext(VoiceLiveModelContext)
}
