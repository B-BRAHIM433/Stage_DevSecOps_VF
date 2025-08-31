// components/hooks/useNotifications.js
import { useCallback, useRef, useState } from "react";

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const isMountedRef = useRef(true);

  const addNotification = useCallback((message, type = "info", persistent = false) => {
    if (!isMountedRef.current) return;
    
    const id = Date.now() + Math.random(); // Ensure unique IDs
    const notification = {
      id,
      message,
      type,
      timestamp: new Date(),
      persistent,
    };

    setNotifications((prev) => [notification, ...prev.slice(0, 9)]);

    if (!persistent && (type === "success" || type === "info")) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }
      }, 5000);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notifications,
    showNotifications,
    setShowNotifications,
    addNotification,
    clearNotifications,
    removeNotification,
    setNotifications,
  };
};