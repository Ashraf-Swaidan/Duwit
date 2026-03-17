import { createContext, useContext, useState, type ReactNode } from "react"

export const AVAILABLE_MODELS = [
  { id: "gemma-3-27b-it", name: "Gemma 3 27B", description: "Default · Free tier" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast & capable" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Balanced performance" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Most powerful" },
] as const

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"]

const DEFAULT_MODEL: ModelId = "gemma-3-27b-it"
const STORAGE_KEY = "duwit_selected_model"

interface ModelContextValue {
  selectedModel: ModelId
  setSelectedModel: (model: ModelId) => void
}

const ModelContext = createContext<ModelContextValue>({
  selectedModel: DEFAULT_MODEL,
  setSelectedModel: () => {},
})

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModel, setSelectedModelState] = useState<ModelId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const valid = AVAILABLE_MODELS.map((m) => m.id) as string[]
      return (valid.includes(stored ?? "") ? stored : DEFAULT_MODEL) as ModelId
    } catch {
      return DEFAULT_MODEL
    }
  })

  function setSelectedModel(model: ModelId) {
    setSelectedModelState(model)
    try {
      localStorage.setItem(STORAGE_KEY, model)
    } catch {}
  }

  return (
    <ModelContext.Provider value={{ selectedModel, setSelectedModel }}>
      {children}
    </ModelContext.Provider>
  )
}

export function useModel() {
  return useContext(ModelContext)
}
