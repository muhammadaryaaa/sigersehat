import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { AuthProvider } from "./lib/auth";
export default function App() {
  return (<ErrorBoundary><AuthProvider><RouterProvider router={router} /></AuthProvider></ErrorBoundary>);
}
