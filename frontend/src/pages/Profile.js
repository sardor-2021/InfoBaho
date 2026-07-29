import React, { useState } from 'react';
import '../assets/css/Pages.css';
import { useAuth } from '../context/AuthContext';
import '../assets/css/Pages.css';
import api from '../services/api';
import '../assets/css/Pages.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    email: user.email
  });
  const [schoolData, setSchoolData] = useState({
    district: user.district || '',
    school_number: user.school_number || '',
    class_name: user.class_name || '',
    teaching_classes: user.teaching_classes ? user.teaching_classes.split(',') : []
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const districts = [
    'Davlatobod tumani',
    'Chortoq tumani',
    'Chust tumani',
    'Kosonsoy tumani',
    'Mingbuloq tumani',
    'Namangan tumani',
    'Norin tumani',
    'Pop tumani',
    "To'raqo'rg'on tumani",
    "Uchqo'rg'on tumani",
    'Uychi tumani',
    "Yangiqo'rg'on tumani"
  ];

  const classes = [
    '9-A', '9-B', '9-V', '9-G', '9-D',
    '10-A', '10-B', '10-V', '10-G', '10-D'
  ];

  const getLevelColor = (level) => {
    const colors = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    return colors[level - 1] || 'bronze';
  };

  const getLevelEmoji = (level) => {
    const emojis = ['🥉', '🥈', '🥇', '💎', '💠'];
    return emojis[level - 1] || '🥉';
  };

  const getLevelName = (level) => {
    const names = ['Bronza', 'Kumush', 'Oltin', 'Platina', 'Brilliant'];
    return names[level - 1] || 'Bronza';
  };

  const getRoleName = (role) => {
    const roleNames = {
      student: "O'quvchi",
      teacher: "O'qituvchi",
      admin: 'Administrator'
    };
    return roleNames[role] || role;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.put('/auth/profile', formData);
      updateUser(response.data.user);
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profil muvaffaqiyatli yangilandi!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || "Profilni yangilashda xatolik yuz berdi" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Yangi parollar mos kelmadi!' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Parol kamida 6 belgidan iborat bo\'lishi kerak!' });
      return;
    }

    setLoading(true);

    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
      setMessage({ type: 'success', text: 'Parol muvaffaqiyatli o\'zgartirildi!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || "Parolni o'zgartirishda xatolik yuz berdi" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const updateData = {
        district: schoolData.district,
        school_number: schoolData.school_number
      };

      if (user.role === 'student') {
        updateData.class_name = schoolData.class_name;
      } else if (user.role === 'teacher') {
        updateData.teaching_classes = schoolData.teaching_classes.join(',');
      }

      const response = await api.put('/auth/profile', updateData);
      updateUser(response.data.user);
      setIsEditingSchool(false);
      setMessage({ type: 'success', text: 'Maktab ma\'lumotlari muvaffaqiyatli yangilandi!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || "Ma'lumotlarni yangilashda xatolik yuz berdi" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeachingClassChange = (className) => {
    const currentClasses = schoolData.teaching_classes;
    const newClasses = currentClasses.includes(className)
      ? currentClasses.filter(c => c !== className)
      : [...currentClasses, className];
    
    setSchoolData({
      ...schoolData,
      teaching_classes: newClasses
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Profil</h1>
        <p className="subtitle">Shaxsiy ma'lumotlaringizni boshqaring</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-layout">
        <div className="profile-sidebar">
          <div className="profile-avatar-large">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <h2>{user.full_name}</h2>
          <p className="profile-role">{getRoleName(user.role)}</p>

          {user.role === 'student' && (
            <>
              <div className={`level-badge-large level-${getLevelColor(user.level)}`}>
                <div className="level-number">{getLevelEmoji(user.level)} {getLevelName(user.level)}</div>
                <div className="level-name">{user.mastery_percent || 0}%</div>
              </div>
              
              <div className="profile-stats">
                <div className="profile-stat-item">
                  <span className="stat-label">O'zlashtirish</span>
                  <span className="stat-value">📊 {user.mastery_percent || 0}%</span>
                </div>
              </div>
            </>
          )}

          <div className="profile-info-list">
            <div className="info-item">
              <span className="info-label">Login:</span>
              <span className="info-value">{user.username}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Ro'yxatdan o'tgan:</span>
              <span className="info-value">
                {new Date(user.created_at).toLocaleDateString('uz-UZ')}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-content">
          <div className="profile-section">
            <div className="section-header">
              <h3>Shaxsiy ma'lumotlar</h3>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="btn btn-outline"
                >
                  Tahrirlash
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-group">
                  <label>To'liq ism</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        full_name: user.full_name,
                        email: user.email
                      });
                    }} 
                    className="btn btn-outline"
                    disabled={loading}
                  >
                    Bekor qilish
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-display">
                <div className="info-row">
                  <span className="info-label">To'liq ism:</span>
                  <span className="info-value">{user.full_name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{user.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Login:</span>
                  <span className="info-value">{user.username}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Rol:</span>
                  <span className="info-value">{getRoleName(user.role)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="profile-section">
            <div className="section-header">
              <h3>Maktab ma'lumotlari</h3>
              {!isEditingSchool && (
                <button 
                  onClick={() => setIsEditingSchool(true)} 
                  className="btn btn-outline"
                >
                  Tahrirlash
                </button>
              )}
            </div>

            {isEditingSchool ? (
              <form onSubmit={handleSchoolUpdate} className="profile-form">
                <div className="form-group">
                  <label>Tuman *</label>
                  <select
                    value={schoolData.district}
                    onChange={(e) => setSchoolData({ ...schoolData, district: e.target.value })}
                    required
                    disabled={loading}
                  >
                    <option value="">Tumanni tanlang</option>
                    {districts.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Maktab raqami *</label>
                  <input
                    type="text"
                    value={schoolData.school_number}
                    onChange={(e) => setSchoolData({ ...schoolData, school_number: e.target.value })}
                    placeholder="Masalan: 15"
                    required
                    disabled={loading}
                  />
                </div>

                {user.role === 'student' && (
                  <div className="form-group">
                    <label>Sinf *</label>
                    <select
                      value={schoolData.class_name}
                      onChange={(e) => setSchoolData({ ...schoolData, class_name: e.target.value })}
                      required
                      disabled={loading}
                    >
                      <option value="">Sinfni tanlang</option>
                      {classes.map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                    </select>
                  </div>
                )}

                {user.role === 'teacher' && (
                  <div className="form-group">
                    <label>Dars o'tiladigan sinflar * (bir nechtasini tanlash mumkin)</label>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(5, 1fr)', 
                      gap: '0.5rem',
                      marginTop: '0.5rem'
                    }}>
                      {classes.map(className => (
                        <label 
                          key={className} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.625rem 0.5rem',
                            border: '2px solid',
                            borderColor: schoolData.teaching_classes.includes(className) 
                              ? 'var(--primary-color)' 
                              : '#E5E7EB',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: schoolData.teaching_classes.includes(className) 
                              ? 'var(--primary-color)' 
                              : 'transparent',
                            color: schoolData.teaching_classes.includes(className) 
                              ? 'white' 
                              : 'var(--text-primary)',
                            transition: 'all 0.2s',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={schoolData.teaching_classes.includes(className)}
                            onChange={() => handleTeachingClassChange(className)}
                            disabled={loading}
                            style={{ display: 'none' }}
                          />
                          {className}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsEditingSchool(false);
                      setSchoolData({
                        district: user.district || '',
                        school_number: user.school_number || '',
                        class_name: user.class_name || '',
                        teaching_classes: user.teaching_classes ? user.teaching_classes.split(',') : []
                      });
                    }} 
                    className="btn btn-outline"
                    disabled={loading}
                  >
                    Bekor qilish
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-display">
                <div className="info-row">
                  <span className="info-label">Tuman:</span>
                  <span className="info-value">{user.district || 'Kiritilmagan'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Maktab:</span>
                  <span className="info-value">№ {user.school_number || 'Kiritilmagan'}</span>
                </div>
                {user.role === 'student' && (
                  <div className="info-row">
                    <span className="info-label">Sinf:</span>
                    <span className="info-value">{user.class_name || 'Kiritilmagan'}</span>
                  </div>
                )}
                {user.role === 'teacher' && (
                  <div className="info-row">
                    <span className="info-label">Dars o'tiladigan sinflar:</span>
                    <span className="info-value">
                      {user.teaching_classes || 'Kiritilmagan'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="profile-section">
            <div className="section-header">
              <h3>Xavfsizlik</h3>
              {!showPasswordForm && (
                <button 
                  onClick={() => setShowPasswordForm(true)} 
                  className="btn btn-outline"
                >
                  Parolni o'zgartirish
                </button>
              )}
            </div>

            {showPasswordForm ? (
              <form onSubmit={handlePasswordChange} className="profile-form">
                <div className="form-group">
                  <label>Joriy parol</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Yangi parol</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Kamida 6 belgi"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Yangi parolni tasdiqlash</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Saqlanmoqda...' : 'Parolni o\'zgartirish'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                    }} 
                    className="btn btn-outline"
                    disabled={loading}
                  >
                    Bekor qilish
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-display">
                <p>Parolingizni o'zgartirish uchun yuqoridagi tugmani bosing.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
