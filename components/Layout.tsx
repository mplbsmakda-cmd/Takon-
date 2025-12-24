
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
                <i className="fas fa-comments text-white text-xl"></i>
              </div>
              <Link to="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight">
                TanyaPintar
              </Link>
            </div>
            <div className="flex gap-4">
              {isAdmin ? (
                <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors flex items-center gap-2">
                  <i className="fas fa-globe"></i> <span className="hidden sm:inline">Portal Publik</span>
                </Link>
              ) : (
                <Link to="/admin" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-2">
                  <i className="fas fa-user-shield"></i> <span className="hidden sm:inline">Panel Admin</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} TanyaPintar Platform. Keamanan Terjamin.</p>
          <div className="flex gap-6">
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Kebijakan Privasi</span>
            <span className="hover:text-indigo-600 cursor-pointer transition-colors">Bantuan</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
