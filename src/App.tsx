import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { ModelProvider } from "@/contexts/ModelContext"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Create the query client
const queryClient = new QueryClient()

// Create the router instance
const router = createRouter({ routeTree })

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
          <RouterProvider router={router} />
        </ModelProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
