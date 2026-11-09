import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, Link } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: () => <div className="p-10"><h1>Page not found</h1><Link to="/home">Go to workspace</Link></div>,
  errorComponent: ({ error, reset }) => <div className="p-10"><h1>Something went wrong</h1><p>{error instanceof Error ? error.message : "Please try again."}</p><button onClick={reset}>Try again</button></div>,
});
function Root() {
  const { queryClient } = Route.useRouteContext();
  const [theme] = useTheme();
  return <QueryClientProvider client={queryClient}><div className="app-backdrop" aria-hidden="true" /><Outlet /><Toaster theme={theme} position="top-right" richColors /></QueryClientProvider>;
}
