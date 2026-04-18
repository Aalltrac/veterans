import \"@/App.css\";
import { BrowserRouter, Routes, Route, Navigate } from \"react-router-dom\";
import { AuthProvider } from \"./context/AuthContext\";
import ProtectedRoute from \"./components/ProtectedRoute\";
import Layout from \"./components/Layout\";
import Login from \"./pages/Login\";
import Planning from \"./pages/Planning\";
import Availability from \"./pages/Availability\";
import EvaPass from \"./pages/EvaPass\";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path=\"/login\" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path=\"/\" element={<Navigate to=\"/planning\" replace />} />
            <Route path=\"/planning\" element={<Planning />} />
            <Route path=\"/disponibilite\" element={<Availability />} />
            <Route path=\"/eva-pass\" element={<EvaPass />} />
          </Route>
          <Route path=\"*\" element={<Navigate to=\"/\" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
