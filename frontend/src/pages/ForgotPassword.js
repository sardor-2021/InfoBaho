import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email, 2: kod, 3: yangi parol
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1-qadam: Email yuborish
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSuccess(res.data.message);
      // Agar kod qaytarilsa (test rejim) — avtomatik to'ldirish
      if (res.data.reset_code) {
        setCode(res.data.reset_code);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  // 2-qadam: Kodni tekshirish
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/verify-reset-code', { email, code });
      setResetToken(res.data.reset_token);
      setSuccess('Kod tasdiqlandi! Yangi parol kiriting.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Noto\'g\'ri kod');
    } finally {
      setLoading(false);
    }
  };

  // 3-qadam: Yangi parol o'rnatish
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Parol kamida 6 belgidan iborat bo\'lishi kerak');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Parollar mos kelmadi');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        email,
        reset_token: resetToken,
        new_password: newPassword
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🔐 Parolni tiklash</h1>
          <p>
            {step === 1 && 'Emailingizni kiriting — tiklash kodi yuboramiz'}
            {step === 2 && 'Emailingizga yuborilgan 6 xonali kodni kiriting'}
            {step === 3 && 'Yangi parolingizni kiriting'}
          </p>
        </div>

        {/* Progress indicator */}
        <div style={{
          display: 'flex', gap: '0.5rem', justifyContent: 'center',
          marginBottom: '2rem'
        }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: '40px', height: '4px', borderRadius: '2px',
              background: s <= step
                ? 'var(--gradient-primary, linear-gradient(135deg, #06b6d4, #8b5cf6))'
                : 'var(--border-color, #e5e7eb)',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Step 1: Email */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ro'yxatdan o'tgan emailingiz"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? '⏳ Yuborilmoqda...' : '📧 Kod yuborish'}
            </button>
          </form>
        )}

        {/* Step 2: Kod kiritish */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="auth-form">
            <div className="form-group">
              <label htmlFor="code">Tiklash kodi (6 xonali)</label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                disabled={loading}
                maxLength={6}
                style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '8px', fontWeight: 700 }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1rem' }}>
              📧 <strong>{email}</strong> ga kod yuborildi. 15 daqiqa ichida kiriting.
            </p>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || code.length !== 6}>
              {loading ? '⏳ Tekshirilmoqda...' : '✅ Tasdiqlash'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => { setStep(1); setError(''); setSuccess(''); }}
              style={{ marginTop: '0.75rem' }}
            >
              ← Qaytadan yuborish
            </button>
          </form>
        )}

        {/* Step 3: Yangi parol */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label htmlFor="newPassword">Yangi parol</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kamida 6 belgi"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Parolni tasdiqlash</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Parolni qayta kiriting"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? '⏳ Saqlanmoqda...' : '🔒 Parolni yangilash'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            Parolingiz esda bormi? <Link to="/login">Kirish</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
