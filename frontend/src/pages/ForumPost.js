import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Forum.css';

const ForumPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [myVotes, setMyVotes] = useState({ post_vote: null, comment_votes: {} });
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { fetchPost(); }, [id]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const [postRes, votesRes] = await Promise.all([
        api.get(`/forum/posts/${id}`),
        api.get(`/forum/my-votes?post_id=${id}`).catch(() => ({ data: {} }))
      ]);
      setPost(postRes.data.post);
      setComments(postRes.data.comments || []);
      setMyVotes(votesRes.data || { post_vote: null, comment_votes: {} });
    } catch (err) {
      console.error(err);
      alert('Post topilmadi');
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (type, postId, commentId) => {
    try {
      const body = { vote_type: type };
      if (postId) body.post_id = postId;
      if (commentId) body.comment_id = commentId;

      await api.post('/forum/vote', body);
      fetchPost();
    } catch (err) {
      alert(err.response?.data?.error || 'Ovoz berishda xatolik');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/forum/posts/${id}/comments`, { content: newComment });
      setNewComment('');
      fetchPost();
    } catch (err) {
      alert(err.response?.data?.error || 'Javob yozishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAIAnswer = async () => {
    try {
      setAiLoading(true);
      await api.post(`/forum/posts/${id}/ai-answer`);
      fetchPost();
    } catch (err) {
      alert(err.response?.data?.error || 'AI javob berishda xatolik');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBestAnswer = async (commentId) => {
    try {
      await api.patch(`/forum/comments/${commentId}/best`);
      fetchPost();
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Bu mavzuni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/forum/posts/${id}`);
      navigate('/forum');
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik');
    }
  };

  const handlePin = async () => {
    try {
      await api.patch(`/forum/posts/${id}/pin`);
      fetchPost();
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik');
    }
  };

  const timeAgo = (date) => {
    const diff = Math.floor((new Date() - new Date(date)) / 1000);
    if (diff < 60) return 'hozirgina';
    if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
    return new Date(date).toLocaleDateString('uz-UZ');
  };

  // Kodni ajratib ko'rsatish (oddiy)
  const formatContent = (text) => {
    if (!text) return '';
    // Code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        return <pre key={i} className="code-block"><code>{code}</code></pre>;
      }
      // Inline code
      const inlined = part.split(/(`[^`]+`)/g).map((seg, j) => {
        if (seg.startsWith('`') && seg.endsWith('`')) {
          return <code key={j} className="inline-code">{seg.slice(1, -1)}</code>;
        }
        return <span key={j} style={{ whiteSpace: 'pre-wrap' }}>{seg}</span>;
      });
      return <span key={i}>{inlined}</span>;
    });
  };

  if (loading) return <div className="loading-container"><div className="spinner"/><p>Yuklanmoqda...</p></div>;
  if (!post) return null;

  const canModerate = user.role === 'teacher' || user.role === 'admin';
  const isOwner = post.user_id === user.id;
  const hasAI = comments.some(c => c.is_ai_answer);

  return (
    <div className="forum-post-container">
      {/* Back */}
      <Link to="/forum" className="back-link">← Forumga qaytish</Link>

      {/* Post */}
      <div className="post-detail-card">
        <div className="post-detail-left">
          {/* Voting */}
          <div className="vote-buttons">
            <button
              className={`vote-btn up ${myVotes.post_vote === 'up' ? 'active' : ''}`}
              onClick={() => handleVote('up', post.id, null)}
            >▲</button>
            <span className="vote-count">{post.score}</span>
            <button
              className={`vote-btn down ${myVotes.post_vote === 'down' ? 'active' : ''}`}
              onClick={() => handleVote('down', post.id, null)}
            >▼</button>
          </div>
        </div>

        <div className="post-detail-right">
          {/* Header */}
          <div className="post-detail-header">
            <div className="post-badges">
              {post.pinned && <span className="badge-pin">📌 Mahkamlangan</span>}
              {post.has_best_answer > 0 && <span className="badge-solved">✅ Yechildi</span>}
              <span className="badge-category">{post.category_icon} {post.category_name}</span>
            </div>
            <h1>{post.title}</h1>
            <div className="post-author-row">
              <span className="author-badge">
                {post.author_role === 'teacher' ? '👨‍🏫' : post.author_role === 'admin' ? '⚙️' : '👤'}
                {post.author_name}
              </span>
              <span className="post-date">{timeAgo(post.created_at)}</span>
              <span className="post-views">👁 {post.views}</span>
            </div>
          </div>

          {/* Content */}
          <div className="post-body">
            {formatContent(post.content)}
          </div>

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="post-tags-detail">
              {post.tags.map((t, i) => <span key={i} className="tag">#{t}</span>)}
            </div>
          )}

          {/* Actions */}
          <div className="post-actions-bar">
            {canModerate && !post.is_approved && (
              <button className="action-btn" onClick={async () => {
                try {
                  await api.patch(`/forum/posts/${post.id}/approve`);
                  setPost(p => ({ ...p, is_approved: true }));
                  alert('✅ Post tasdiqlandi (+1 ball)');
                } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
              }} style={{ color: '#16a34a' }}>
                ✓ Tasdiqlash
              </button>
            )}
            {post.is_approved && (
              <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, padding: '0.3rem 0.6rem' }}>✅ Tasdiqlangan</span>
            )}
            {canModerate && (
              <button className="action-btn" onClick={handlePin}>
                {post.pinned ? '📌 Unpin' : '📌 Pin'}
              </button>
            )}
            {(isOwner || canModerate) && (
              <button className="action-btn delete-btn" onClick={handleDelete}>🗑️ O'chirish</button>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="comments-section">
        <h2>💬 Javoblar ({comments.length})</h2>

        {comments.length === 0 && (
          <div className="no-comments">
            <p>Hali javob yo'q. Birinchi bo'lib javob bering!</p>
          </div>
        )}

        {comments.map(comment => (
          <div key={comment.id}
            className={`comment-card ${comment.is_best_answer ? 'best-answer' : ''} ${comment.is_ai_answer ? 'ai-answer' : ''}`}>
            <div className="comment-left">
              <button
                className={`vote-btn up ${myVotes.comment_votes?.[comment.id] === 'up' ? 'active' : ''}`}
                onClick={() => handleVote('up', null, comment.id)}
              >▲</button>
              <span className="vote-count">{comment.score || 0}</span>
              <button
                className={`vote-btn down ${myVotes.comment_votes?.[comment.id] === 'down' ? 'active' : ''}`}
                onClick={() => handleVote('down', null, comment.id)}
              >▼</button>
            </div>

            <div className="comment-right">
              {comment.is_best_answer && (
                <div className="best-answer-badge">✅ Eng yaxshi javob</div>
              )}
              {comment.is_ai_answer && (
                <div className="ai-answer-badge">🤖 AI Yordamchi javobi</div>
              )}

              <div className="comment-body">
                {formatContent(comment.content)}
              </div>

              <div className="comment-footer">
                <span className="comment-author">
                  {comment.is_ai_answer ? '🤖' : comment.author_role === 'teacher' ? '👨‍🏫' : '👤'}
                  {comment.author_name}
                  {comment.author_role === 'teacher' && <span className="role-tag">O'qituvchi</span>}
                </span>
                <span className="comment-date">{timeAgo(comment.created_at)}</span>
                {canModerate && !comment.is_approved && !comment.is_ai_answer && (
                  <button className="best-btn" onClick={async () => {
                    try {
                      await api.patch(`/forum/comments/${comment.id}/approve`);
                      setComments(cs => cs.map(c => c.id === comment.id ? { ...c, is_approved: true } : c));
                      alert('✅ Javob tasdiqlandi (+2 ball)');
                    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
                  }} style={{ color: '#16a34a' }}>
                    ✓ Tasdiqlash
                  </button>
                )}
                {comment.is_approved && (
                  <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>✅</span>
                )}
                {(isOwner || canModerate) && !comment.is_best_answer && (
                  <button className="best-btn" onClick={() => handleBestAnswer(comment.id)}>
                    ✅ Eng yaxshi
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Comment Form */}
      {!post.closed && (
        <div className="new-comment-section">
          <h3>✍️ Javob yozish</h3>
          <form onSubmit={handleComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Javobingizni yozing... (kod uchun ``` ishlatishingiz mumkin)"
              rows={5}
              required
              disabled={submitting}
            />
            <div className="comment-form-footer">
              <span className="hint">💡 Kod yozish: ``` va ``` orasiga joylashtiring</span>
              <button type="submit" className="btn btn-primary" disabled={submitting || !newComment.trim()}>
                {submitting ? '⏳ Yuborilmoqda...' : '📤 Javob yuborish (+2 ball)'}
              </button>
            </div>
          </form>
        </div>
      )}

      {post.closed && (
        <div className="closed-notice">
          🔒 Bu mavzu yopilgan. Yangi javob yozish mumkin emas.
        </div>
      )}
    </div>
  );
};

export default ForumPost;
