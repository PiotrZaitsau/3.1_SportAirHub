import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  autoHideDuration?: number;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, autoHideDuration?: number) => void;
  hideNotification: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const showNotification = (
    type: NotificationType,
    message: string,
    autoHideDuration: number = 6000
  ) => {
    const id = generateId();
    const notification: Notification = {
      id,
      type,
      message,
      autoHideDuration,
    };

    setNotifications((prev) => [...prev, notification]);

    // Auto-hide notification
    if (autoHideDuration > 0) {
      setTimeout(() => {
        hideNotification(id);
      }, autoHideDuration);
    }
  };

  const hideNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  const success = (message: string) => showNotification('success', message);
  const error = (message: string) => showNotification('error', message, 8000);
  const warning = (message: string) => showNotification('warning', message, 7000);
  const info = (message: string) => showNotification('info', message);

  const value: NotificationContextType = {
    showNotification,
    hideNotification,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Render notifications */}
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          style={{
            top: `${80 + index * 70}px`, // Stack notifications
          }}
        >
          <Alert
            severity={notification.type}
            onClose={() => hideNotification(notification.id)}
            variant="filled"
            sx={{
              minWidth: 300,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
}; 