import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import Layout from "./components/Layout";
import StudyPage from "./pages/StudyPage";
import WordsPage from "./pages/WordsPage";
import StatsPage from "./pages/StatsPage";

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/study" element={<StudyPage />} />
            <Route path="/words" element={<WordsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/study" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthGate>
  );
}
