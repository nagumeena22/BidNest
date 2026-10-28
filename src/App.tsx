import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { PortalView } from './components/dashboard/PortalView';
import logo from "./assets/bidnest-logo.png";
const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      <div>
        <Navbar />
        <main>
          <PortalView />
        </main>
      </div>

      {/* Modern Campus Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="BidNest Logo" width="48" />
            <span className="font-bold text-slate-300">BidNest</span>
            <span>&bull;</span>
            <span>Fair Campus Auctions & Seamless Handover Network</span>
          </div>
          <div className="text-slate-400">
            Exam Week Senior Clearance &bull; 100% In-Person Quad Settlement
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
