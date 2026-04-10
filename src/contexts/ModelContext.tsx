import { createContext, useContext, useState, type ReactNode } from "react"

type ModelDefinition = {
  id: string
  name: string
  description: string
}

type ModelGroup = {
  label: string
  models: readonly ModelDefinition[]
}

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
  {
    label: "Pollinations",
    models: [
      {
        id: "pollinations-text:nova-fast",
        name: "Amazon Nova Micro",
        description: "Ultra fast & cheap — Pollinations id: nova-fast",
      },
    ],
  },
] as const satisfies readonly ModelGroup[]

export const AVAILABLE_MODELS = MODEL_GROUPS.reduce<ModelDefinition[]>(
  (acc, group) => [...acc, ...group.models],
  [],
)
export const IMAGE_MODELS = [
  { id: "pollinations:flux", name: "Pollinations Flux", description: "General purpose image model" },
  { id: "pollinations:zimage", name: "Z-Image Turbo", description: "Low-cost fast generation" },
] as const

export type ModelId = (typeof MODEL_GROUPS)[number]["models"][number]["id"]
export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"]

/** Old ids → current id (persisted in localStorage). */
const LEGACY_TEXT_MODEL_IDS: Record<string, ModelId> = {
  "pollinations-text:qwen3guard-8b": "pollinations-text:nova-fast",
  "pollinations-text:qwen-safety": "pollinations-text:nova-fast",
}

const DEFAULT_MODEL: ModelId = "gemma-3-27b-it"
const DEFAULT_IMAGE_MODEL: ImageModelId = "pollinations:flux"
const STORAGE_KEY = "duwit_selected_model"
const SEARCH_MODEL_STORAGE_KEY = "duwit_search_model"
const IMAGE_MODEL_STORAGE_KEY = "duwit_image_model"

interface ModelContextValue {
  selectedModel: ModelId
  setSelectedModel: (model: ModelId) => void
  /** Null means: use selectedModel for search calls too. */
  selectedSearchModel: ModelId | null
  setSelectedSearchModel: (model: ModelId | null) => void
  selectedImageModel: ImageModelId
  setSelectedImageModel: (model: ImageModelId) => void
}

const ModelContext = createContext<ModelContextValue>({
  selectedModel: DEFAULT_MODEL,
  setSelectedModel: () => {},
  selectedSearchModel: null,
  setSelectedSearchModel: () => {},
  selectedImageModel: DEFAULT_IMAGE_MODEL,
  setSelectedImageModel: () => {},
})

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModel, setSelectedModelState] = useState<ModelId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const normalized = LEGACY_TEXT_MODEL_IDS[stored ?? ""] ?? stored
      const valid = AVAILABLE_MODELS.map((m) => m.id) as string[]
      return (valid.includes(normalized ?? "") ? normalized : DEFAULT_MODEL) as ModelId
    } catch {
      return DEFAULT_MODEL
    }
  })
  const [selectedSearchModel, setSelectedSearchModelState] = useState<ModelId | null>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_MODEL_STORAGE_KEY)
      if (!stored || stored === "__same__") return null
      const normalized = LEGACY_TEXT_MODEL_IDS[stored] ?? stored
      const valid = AVAILABLE_MODELS.map((m) => m.id) as string[]
      return (valid.includes(normalized) ? normalized : null) as ModelId | null
    } catch {
      return null
    }
  })
  const [selectedImageModel, setSelectedImageModelState] = useState<ImageModelId>(() => {
    try {
      const stored = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY)
      const valid = IMAGE_MODELS.map((m) => m.id) as string[]
      return (valid.includes(stored ?? "") ? stored : DEFAULT_IMAGE_MODEL) as ImageModelId
    } catch {
      return DEFAULT_IMAGE_MODEL
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
  function setSelectedImageModel(model: ImageModelId) {
    setSelectedImageModelState(model)
    try {
      localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, model)
    } catch {}
  }

  return (
    <ModelContext.Provider
      value={{
        selectedModel,
        setSelectedModel,
        selectedSearchModel,
        setSelectedSearchModel,
        selectedImageModel,
        setSelectedImageModel,
      }}
    >
      {children}
    </ModelContext.Provider>
  )
}

export function useModel() {
  return useContext(ModelContext)
}
