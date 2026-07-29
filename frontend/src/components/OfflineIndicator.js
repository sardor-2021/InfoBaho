import React, { useState, useEffect } from 'react';
import { syncOfflineSubmissions, getOfflineCount } from '../utils/offlineStorage';
import api from '../services/api';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);

      // Internet qaytdi — offline javoblarni yuborish
      const count = await getOfflineCount();
      if (count > 0) {
        setSyncing(true);
        const result = await syncOfflineSubmissions(api);
        setSyncing(false);
        if (result.synced > 0) {
          setNotification(`✅ ${result.synced} ta offline javob yuborildi!`);
          setTimeout(() => setNotification(''), 5000);
        }
        setOfflineCount(0);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    // SW bildirishnomalari
    const handleSWNotification = (event) => {
      setNotification(event.detail.message);
      setTimeout(() => setNotification(''), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sw-notification', handleSWNotification);

    // Boshlang'ich tekshiruv
    getOfflineCount().then(setOfflineCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw-notification', handleSWNotification);
    };
  }, []);

  // Offline count ni vaqti-vaqti bilan yangilash
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await getOfflineCount();
      setOfflineCount(count);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: '70px',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ fontSize: '1.1rem' }}>📡</span>
          Internet aloqasi yo'q — Offline rejimdasiz
          {offlineCount > 0 && (
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '0.2rem 0.6rem',
              borderRadius: '12px',
              fontSize: '0.8rem'
            }}>
              💾 {offlineCount} ta javob saqlangan
            </span>
          )}
        </div>
      )}

      {/* Online qaytdi banner */}
      {isOnline && showBanner && (
        <div style={{
          position: 'fixed',
          top: '70px',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ fontSize: '1.1rem' }}>✅</span>
          Internet qaytdi!
          {syncing && <span>🔄 Javoblar yuborilmoqda...</span>}
        </div>
      )}

      {/* Sync notification toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 9999,
          background: 'var(--bg-secondary, #1e293b)',
          color: 'var(--text-primary, #f1f5f9)',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(6, 182, 212, 0.1)',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'toastIn 0.3s ease'
        }}>
          {notification}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes toastIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default OfflineIndicator;
