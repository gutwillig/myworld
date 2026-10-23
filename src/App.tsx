import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import WorldPage from "./app/WorldPage";
import FlatBuildingPage from "./flat/FlatBuildingPage";
import NotFound from "./pages/NotFound";

const KitPage = lazy(() => import("./app/KitPage"));

const App = () => (
  <>
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          fontFamily: "var(--font-ui)",
          borderRadius: 18,
          background: "rgba(251,251,244,0.95)",
          color: "var(--ink)",
          border: "1px solid rgba(255,255,255,0.8)",
        },
      }}
    />
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<WorldPage />}>
          <Route index element={null} />
          <Route path="w/:world" element={null} />
        </Route>
        <Route path="/w/:world/:building" element={<FlatBuildingPage />} />
        <Route
          path="/kit"
          element={
            <Suspense fallback={null}>
              <KitPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </>
);

export default App;
