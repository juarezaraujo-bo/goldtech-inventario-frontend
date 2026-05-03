import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientForm from './pages/ClientForm';
import ClientInventory from './pages/ClientInventory';
import EquipmentList from './pages/EquipmentList';
import EquipmentForm from './pages/EquipmentForm';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import UsersPage from './pages/UsersPage';
import Intranet from './pages/Intranet';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="content-container">
          {children}
        </div>
      </div>
    </div>
  ) : <Navigate to="/login" />;
};

function App() {
  return (
    <HashRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        
        {/* Clientes */}
        <Route path="/clientes" element={<PrivateRoute><ClientList /></PrivateRoute>} />
        <Route path="/clientes/novo" element={<PrivateRoute><ClientForm /></PrivateRoute>} />
        <Route path="/clientes/editar/:id" element={<PrivateRoute><ClientForm /></PrivateRoute>} />
        <Route path="/clientes/:id/inventario" element={<PrivateRoute><ClientInventory /></PrivateRoute>} />
        
        {/* Inventário Geral */}
        <Route path="/equipamentos" element={<PrivateRoute><EquipmentList /></PrivateRoute>} />
        <Route path="/novo" element={<PrivateRoute><EquipmentForm /></PrivateRoute>} />
        <Route path="/editar/:id" element={<PrivateRoute><EquipmentForm /></PrivateRoute>} />
        
        {/* Relatórios e Configurações */}
        <Route path="/intranet" element={<PrivateRoute><Intranet /></PrivateRoute>} />
        <Route path="/relatorios" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/configuracoes" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/usuarios" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
