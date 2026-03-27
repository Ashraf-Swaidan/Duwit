import { createContext, useContext, useState, type ReactNode } from "react"

export const MODEL_GROUPS = [
  {
    label: "Gemini",
    models: [
      { id: "gemini-3-flash-preview",      name: "Gemini 3 Flash",       description: "Most powerful · Frontier tier" },
      { id: "gemini-3.1-flash-lite-preview",name: "Gemini 3.1 Flash Lite", description: "Ultra-fast · Gemini 3 series" },
      { id: "gemini-2.5-flash",            name: "Gemini 2.5 Flash",      description: "Very powerful · Stable" },
      { id: "gemini-2.5-flash-lite",       name: "Gemini 2.5 Flash Lite", description: "Fast & light · Stable" },
    ],
  },
  {
    label: "Gemma",
    models: [
      { id: "gemma-3-27b-it", name: "Gemma 3 27B", description: "Default · Free tier" },
    ],
  },
] as const

export const AVAILABLE_MODELS = MODEL_GROUPS.flatMap((g) => g.models)

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"]

const DEFAULT_MODEL: ModelId = "gemma-3-27b-it"
const STORAGE_KEY = "duwit_selected_model"
const SEARCH_MODEL_STORAGE_KEY = "duwit_search_model"

interface ModelContextValue {
  selectedModel: ModelId
  setSelectedModel: (model: ModelId) => void
  /** Null means: use selectedModel for search calls too. */
  selectedSearchModel: ModelId | null
  setSelectedSearchModel: (model: ModelId | null) => void
}

const ModelContext = createContext<ModelContextValue>({
  selectedModel: DEFAULT_MODEL,
  setSelectedModel: () => {},
  selectedSearchModel: null,
  setSelectedSearchModel: () => {},
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
  const [selectedSearchModel, setSelectedSearchModelState] = useState<ModelId | null>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_MODEL_STORAGE_KEY)
      if (!stored || stored === "__same__") return null
      const valid = AVAILABLE_MODELS.map((m) => m.id) as string[]
      return (valid.includes(stored) ? stored : null) as ModelId | null
    } catch {
      return null
    }
  })

  function setSelectedModel(model: ModelId) {
    setSelectedModelState(model)
    try {
      localStorage.setItem(STORAGE_KEY, model)
    } catch {}
  }

  function setSelectedSearchModel(model: ModelId | null) {
    setSelectedSearchModelState(model)
    try {
      localStorage.setItem(SEARCH_MODEL_STORAGE_KEY, model ?? "__same__")
    } catch {}
  }

  return (
    <ModelContext.Provider
      value={{ selectedModel, setSelectedModel, selectedSearchModel, setSelectedSearchModel }}
    >
      {children}
    </ModelContext.Provider>
  )
}

export function useModel() {
  return useContext(ModelContext)
}
