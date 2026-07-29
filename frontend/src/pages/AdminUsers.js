import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users', { params: roleFilter ? { role: roleFilter } : {} });
      setUsers(res.data.users || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const handleBlock = async (userId, fullName, isBlocked) => {
    if (!window.confirm(`${fullName} ni ${isBlocked ? 'blokdan chiqarish' : 'BLOKLASH'}ni tasdiqlaysizmi?`)) return;
    try {
      await api.patch(`/users/${userId}/block`);
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
  };

  const handleDelete = async (userId, fullName) => {
    if (!window.confirm(`⚠️ ${fullName} ni o'chirishni tasdiqlaysizmi?\n\nBu qaytarib bo'lmaydi!`)) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      alert('Parol kamida 4 belgidan iborat bo\'lishi kerak');
      return;
    }
    try {
      await api.patch(`/users/${resetModal.id}/reset-password`, { new_password: newPassword });
      alert(`✅ ${resetModal.full_name} paroli yangilandi`);
      setResetModal(null);
      setNewPassword('');
    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
  };

  if (user?.role !== 'admin') {
    return <div className="page-container" style={{ paddingTop: '100px', textAlign: 'center' }}><h2>🔒 Faqat administrator</h2></div>;
  }

  const filteredUsers = users.filter(u =>
    (!search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    ) &&
    (!districtFilter || u.district === districtFilter) &&
    (!schoolFilter || u.school_number === schoolFilter) &&
    (!classFilter || u.class_name === classFilter)
  );

  // Unique qiymatlar (filter uchun)
  const availableDistricts = [...new Set(users.map(u => u.district).filter(Boolean))].sort();
  const availableSchools = [...new Set(users.filter(u => !districtFilter || u.district === districtFilter).map(u => u.school_number).filter(Boolean))].sort();
  const availableClasses = [...new Set(users.filter(u => (!districtFilter || u.district === districtFilter) && (!schoolFilter || u.school_number === schoolFilter)).map(u => u.class_name).filter(Boolean))].sort();

  const getRoleBadge = (role) => {
    const styles = {
      admin: { bg: 'rgba(244,63,94,0.12)', color: '#fb7185', label: 'Admin' },
      teacher: { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', label: "O'qituvchi" },
      student: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: "O'quvchi" }
    };
    const s = styles[role] || styles.student;
    return <span style={{ background: s.bg, color: s.color, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>{s.label}</span>;
  };

  if (loading) return <div className="loading-container"><div className="spinner"/><p>Yuklanmoqda...</p></div>;

  return (
    <div className="page-container" style={{ paddingTop: '90px', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>
            👥 Foydalanuvchilar
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Jami: {users.length} ta foydalanuvchi</p>
        </div>
        <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          📊 Excel'dan import
          <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const formData = new FormData();
              formData.append('file', file);
              try {
                const res = await api.post('/users/upload-excel', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert(`✅ ${res.data.imported} ta foydalanuvchi import qilindi!${res.data.errors ? '\n\n⚠️ Xatoliklar:\n' + res.data.errors.join('\n') : ''}`);
                fetchUsers();
              } catch (err) {
                alert('❌ ' + (err.response?.data?.error || err.message) + (err.response?.data?.hint ? '\n\n💡 ' + err.response?.data?.hint : ''));
              }
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Filtrlar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Ism, login yoki email qidirish..."
          style={{ flex: 1, minWidth: '250px', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
        >
          <option value="">Barcha rollar</option>
          <option value="student">O'quvchilar</option>
          <option value="teacher">O'qituvchilar</option>
          <option value="admin">Adminlar</option>
        </select>
        {availableDistricts.length > 1 && (
          <select
            value={districtFilter}
            onChange={(e) => { setDistrictFilter(e.target.value); setSchoolFilter(''); setClassFilter(''); }}
            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          >
            <option value="">Barcha tumanlar</option>
            {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {availableSchools.length > 1 && (
          <select
            value={schoolFilter}
            onChange={(e) => { setSchoolFilter(e.target.value); setClassFilter(''); }}
            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          >
            <option value="">Barcha maktablar</option>
            {availableSchools.map(s => <option key={s} value={s}>{s}-maktab</option>)}
          </select>
        )}
        {availableClasses.length > 1 && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          >
            <option value="">Barcha sinflar</option>
            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
          Ko'rsatilmoqda: {filteredUsers.length}
        </span>
      </div>

      {/* Jadval */}
      <div style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ism / Login</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Rol</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Maktab / Sinf</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Holat</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', opacity: u.is_blocked ? 0.5 : 1 }}>
                  <td style={{ padding: '0.65rem 1rem', color: 'var(--text-light)' }}>{i + 1}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontFamily: 'monospace' }}>@{u.username}</div>
                  </td>
                  <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{u.email}</td>
                  <td style={{ padding: '0.65rem 1rem' }}>{getRoleBadge(u.role)}</td>
                  <td style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {u.school_number ? `${u.school_number}-maktab` : '—'}{u.class_name ? ` / ${u.class_name}` : ''}
                  </td>
                  <td style={{ padding: '0.65rem 1rem' }}>
                    {u.is_blocked
                      ? <span style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700 }}>🔒 Bloklangan</span>
                      : <span style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700 }}>✅ Faol</span>
                    }
                  </td>
                  <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                    {u.id !== user.id && (
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { setResetModal(u); setNewPassword(''); }}
                          title="Parolni o'zgartirish"
                          style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#22d3ee' }}
                        >🔑</button>
                        <button
                          onClick={() => handleBlock(u.id, u.full_name, u.is_blocked)}
                          title={u.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
                          style={{ background: u.is_blocked ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${u.is_blocked ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: u.is_blocked ? '#34d399' : '#fbbf24' }}
                        >{u.is_blocked ? '🔓' : '🔒'}</button>
                        <button
                          onClick={() => handleDelete(u.id, u.full_name)}
                          title="O'chirish"
                          style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#fb7185' }}
                        >🗑️</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parol reset modal */}
      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>🔑 Parolni o'zgartirish</h2>
              <button className="close-btn" onClick={() => setResetModal(null)}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                <strong>{resetModal.full_name}</strong> (@{resetModal.username}) uchun yangi parol:
              </p>
              <div className="form-group">
                <label>Yangi parol</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Yangi parolni kiriting"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setResetModal(null)}>Bekor</button>
                <button className="btn btn-primary" onClick={handleResetPassword}>💾 Saqlash</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
