import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const { user, token } = useAuth();
  const { success, info, warning } = useNotification();

  useEffect(() => {
    // Only connect if user is authenticated
    if (user && token) {
      const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
        auth: {
          token,
        },
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
        
        // Join user's personal room
        newSocket.emit('join-user-room', user.id);
        
        // Join admin room if user is admin
        if (['admin', 'manager'].includes(user.role)) {
          newSocket.emit('join-admin-room');
        }
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
      });

      // Listen for booking notifications
      newSocket.on('booking-confirmed', (data) => {
        success(`Ваше бронирование подтверждено! Корт: ${data.courtName}`);
      });

      newSocket.on('booking-cancelled', (data) => {
        warning(`Бронирование отменено. Корт: ${data.courtName}. Причина: ${data.reason}`);
      });

      newSocket.on('booking-reminder', (data) => {
        info(`Напоминание: Ваше бронирование начнется через ${data.minutesUntil} минут`);
      });

      // Listen for system notifications
      newSocket.on('system-notification', (data) => {
        switch (data.type) {
          case 'maintenance':
            warning(`Техническое обслуживание: ${data.message}`);
            break;
          case 'weather':
            info(`Погодное уведомление: ${data.message}`);
            break;
          case 'promotional':
            info(`Акция: ${data.message}`);
            break;
          default:
            info(data.message);
        }
      });

      // Listen for real-time updates (for admin users)
      if (['admin', 'manager'].includes(user.role)) {
        newSocket.on('realtime-stats', (stats) => {
          // This would typically update a global state or dispatch to a reducer
          console.log('Real-time stats update:', stats);
        });

        newSocket.on('user-action', (action) => {
          console.log('User action:', action);
        });

        newSocket.on('new-booking', (booking) => {
          info(`Новое бронирование: ${booking.courtName} на ${new Date(booking.startTime).toLocaleString()}`);
        });
      }

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      // Disconnect if user is not authenticated
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [user, token]);

  const joinRoom = (room: string) => {
    if (socket && connected) {
      socket.emit('join-room', room);
    }
  };

  const leaveRoom = (room: string) => {
    if (socket && connected) {
      socket.emit('leave-room', room);
    }
  };

  const value: SocketContextType = {
    socket,
    connected,
    joinRoom,
    leaveRoom,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}; 