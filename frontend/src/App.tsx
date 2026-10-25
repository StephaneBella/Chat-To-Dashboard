import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import LoginScreen from "./screens/LoginScreen/LoginScreen";
import AgentScreen from "./screens/AgentScreen/AgentScreen";
import DashboardScreen from "./screens/DashboardScreen/DashboardScreen";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/agent" element={<AgentScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
