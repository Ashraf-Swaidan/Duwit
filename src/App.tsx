import { RouterProvider, createRouter } from "@tanstack/react-router"
import { createHashHistory } from "@tanstack/history"
import { routeTree } from "./routeTree.gen"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { ModelProvider } from "@/contexts/ModelContext"
import { VoiceLiveModelProvider } from "@/contexts/VoiceLiveModelContext"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Create the query client
const queryClient = new QueryClient()
const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:"

// Create the router instance
const router = createRouter({
  routeTree,
  history: isFileProtocol ? createHashHistory() : undefined,
})

// Register the router instance for type-safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ModelProvider>
          <VoiceLiveModelProvider>
            <RouterProvider router={router} />
          </VoiceLiveModelProvider>
        </ModelProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
