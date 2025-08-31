// components/layout/Header.js
import { Bell, Moon, Shield, Sun } from "lucide-react";

const Header = ({ 
  theme, 
  notifications, 
  showNotifications, 
  setShowNotifications, 
  darkMode, 
  setDarkMode 
}) => {
  return (
    <header className={`${theme.cardBg} shadow-sm ${theme.border} border-b sticky top-0 z-40`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className={`text-2xl font-bold ${theme.text}`}>Security Scanner</h1>
              <p className={`text-sm ${theme.textMuted}`}>Analyse de sécurité des dépôts GitHub</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
              <div className="w-2 h-2 rounded-full mr-2 bg-green-500"></div>
              Connecté
            </div>

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 ${theme.cardBg} ${theme.border} border rounded-lg hover:bg-gray-50 transition-colors`}
            >
              <Bell className={`w-5 h-5 ${theme.text}`} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 ${theme.cardBg} ${theme.border} border rounded-lg hover:bg-gray-50 transition-colors`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;