// components/common/NotificationPanel.js
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";

const NotificationPanel = ({ 
  theme, 
  notifications, 
  showNotifications, 
  setNotifications 
}) => {
  if (!showNotifications) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${theme.cardBg} border-l-4 p-4 rounded-lg shadow-lg max-w-sm ${
            notification.type === "success"
              ? "border-green-500"
              : notification.type === "error"
              ? "border-red-500"
              : notification.type === "warning"
              ? "border-yellow-500"
              : "border-blue-500"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {notification.type === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {notification.type === "error" && (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {notification.type === "warning" && (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              )}
              {notification.type === "info" && (
                <Info className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <p className={`text-sm font-medium ${theme.text}`}>
                {notification.message}
              </p>
              <p className={`text-xs ${theme.textMuted} mt-1`}>
                {notification.timestamp.toLocaleTimeString("fr-FR")}
              </p>
            </div>
            <button
              onClick={() =>
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notification.id)
                )
              }
              className={`ml-3 ${theme.textMuted} hover:text-gray-900`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationPanel;