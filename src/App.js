import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";
import Shifts from "./pages/Roster";
import ShiftHandover from "./pages/ShiftHandover";
import KnowledgeBase from "./pages/KnowledgeBase";
import OperationRunbook from "./pages/OperationRunbook";
import AdvisorySystem from "./pages/AdvisorySystem";
// import EscalationMatrixPage from "./pages/EscalationMatrixPage";

// Function to check authentication
const isAuthenticated = () => {
  return localStorage.getItem("authToken") !== null; // Check if user is logged in
};

// Protected Route Component
const ProtectedRoute = ({ element }) => {
  return isAuthenticated() ? element : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
        <Route path="/roster" element={<ProtectedRoute element={<Shifts />} />} />
        <Route path="/shift_handover" element={<ProtectedRoute element={<ShiftHandover />} />} />
        <Route path="/knowledge_base" element={<ProtectedRoute element={<KnowledgeBase />} />} />
        <Route path="/operation_runbook" element={<ProtectedRoute element={<OperationRunbook />} />} />
        <Route path="/advisory_system" element={<ProtectedRoute element={<AdvisorySystem />} />} />
        {/* <Route path="/escalation_matrix" element={<ProtectedRoute element={<EscalationMatrixPage />} />} /> */}

        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}

export default App;
