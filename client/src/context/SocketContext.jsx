import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// Derive socket server URL from VITE_API_URL (strip /api suffix)
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

export function SocketProvider({ children }) {
    const { user, loading } = useAuth();
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);
    const currentAuthKeyRef = useRef(null);

    useEffect(() => {
        // Wait until auth state finishes initial hydration
        if (loading) return;

        const token = localStorage.getItem('centrio_token');
        const guestName = sessionStorage.getItem('guestName');
        const guestEmail = sessionStorage.getItem('guestEmail');

        // Determine unique auth signature for this session
        const authKey = user && token 
            ? `auth_${token.slice(-10)}` 
            : guestName 
                ? `guest_${guestName}_${guestEmail || ''}` 
                : null;

        // If auth state hasn't changed and socket is already connected, don't recreate
        if (authKey && currentAuthKeyRef.current === authKey && socketRef.current?.connected) {
            return;
        }

        // Clean up previous socket if auth changed
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.close();
            socketRef.current = null;
        }

        currentAuthKeyRef.current = authKey;

        if (!authKey) {
            setSocket(null);
            return;
        }

        const authPayload = user && token 
            ? { token } 
            : { guestName, guestEmail };

        const newSocket = io(SOCKET_URL, {
            auth: authPayload,
            transports: ['polling', 'websocket'],
            upgrade: true,
            reconnection: true,
            reconnectionAttempts: 15,
            reconnectionDelay: 1000,
            timeout: 20000,
        });

        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            console.log(`Socket connected (${user ? 'auth' : 'guest'}):`, newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            // Log as debug rather than console error during brief reconnects
            console.debug('Socket reconnecting:', err.message);
        });

        setSocket(newSocket);

        return () => {
            if (socketRef.current === newSocket) {
                newSocket.removeAllListeners();
                newSocket.close();
                socketRef.current = null;
                currentAuthKeyRef.current = null;
            }
        };
    }, [user, loading]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}
