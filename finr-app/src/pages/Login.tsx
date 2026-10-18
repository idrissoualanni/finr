import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { FlaskConical, Loader, Brain, Zap, Target } from 'lucide-react';
import LoginAnimation from '../components/LoginAnimation';

type Mode = 'login' | 'register';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', specialty: '', password: '', password_confirmation: '', role: 'engineer' as 'engineer' | 'researcher' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // L'API renvoie TOUJOURS 200 sur /me/current-session, avec id=null quand
  // aucune session n'est assignee (voir AuthController::currentSession).
  // Le 404 d'avant était une erreur de contrat : il s'affichait dans la console
  // et confondait "pas de session" avec une vraie panne.
  const NO_SESSION_MESSAGE: Record<string, string> = {
    no_profile: "Votre profil ingénieur n'a pas été créé. Reconnectez-vous pour le générer.",
    no_session: "Aucune session en cours ne vous a été assignée. Contactez votre chercheur référent.",
    not_an_engineer: "Ce compte n'est pas un compte ingénieur.",
  };

  const redirectEngineer = async () => {
    try {
      const { data } = await api.get('/me/current-session');
      if (data?.id) {
        navigate(`/workspace/${data.id}`);
        return;
      }
      setError(NO_SESSION_MESSAGE[data?.reason] ?? NO_SESSION_MESSAGE.no_session);
    } catch {
      setError("Impossible de vérifier vos sessions. Réessayez dans un instant.");
    }
    setSubmitting(false);
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === 'engineer') {
        redirectEngineer();
      } else {
        navigate('/dashboard');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      const stored = localStorage.getItem('finr_user');
      const u = stored ? JSON.parse(stored) : null;
      if (u?.role === 'engineer') {
        await redirectEngineer();
      } else {
        navigate('/dashboard');
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password_confirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        password_confirmation: form.password_confirmation,
        role: form.role,
      });
      localStorage.setItem('finr_token', data.token);
      localStorage.setItem('finr_user', JSON.stringify(data.user));
      if (form.role === 'engineer') {
        await api.post('/engineers/profile', { specialty: form.specialty || 'Non spécifiée' });
        setError("Compte créé ! Votre chercheur référent doit maintenant vous assigner une session.");
      } else {
        setError("Compte créé ! Vous pouvez maintenant vous connecter et accéder au tableau de bord.");
      }
      setSubmitting(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors
        ? Object.values(err.response?.data?.errors || {}).flat().join(' ')
        : 'Erreur lors de la création du compte.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10, color: 'var(--dark)', fontSize: 14, outline: 'none',
    transition: 'all 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8,
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2B55 50%, #1A1A2E 100%)',
      display: 'flex', position: 'relative', overflow: 'hidden',
    }}>
      {/* Orbes de fond animées */}
      <div style={{ position: 'absolute', top: -200, right: -150, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(83,74,183,0.25) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127,119,221,0.20) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(83,74,183,0.08) 0%, transparent 60%)' }} />

      {/* Panneau gauche - Animation + Illustration */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, position: 'relative', zIndex: 1,
      }}>
        <div style={{ marginBottom: 20 }}>
          <LoginAnimation />
        </div>

        <div style={{ fontSize: 72, fontWeight: 900, color: 'white', letterSpacing: -2, textAlign: 'center', lineHeight: 1, marginBottom: 16, textShadow: '0 4px 20px rgba(83,74,183,0.5)' }}>
          FIN<span style={{ color: 'var(--purple-light)' }}>-R</span>
        </div>
        <p style={{ fontSize: 16, color: '#B0AECF', textAlign: 'center', maxWidth: 400, lineHeight: 1.6, marginBottom: 40 }}>
          Plateforme d'analyse du raisonnement en STEAM
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'white' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(83,74,183,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Brain size={20} color="var(--purple-light)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Analyse cognitive</div>
              <div style={{ fontSize: 12, color: '#B0AECF' }}>Détection du raisonnement en temps réel</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'white' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={20} color="var(--green-mid)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Événements cognitifs</div>
              <div style={{ fontSize: 12, color: '#B0AECF' }}>Identification des moments clés</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'white' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,159,39,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Target size={20} color="var(--amber-mid)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Score de créativité</div>
              <div style={{ fontSize: 12, color: '#B0AECF' }}>Évaluation automatique par IA</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 48, textAlign: 'center', color: '#B0AECF', fontSize: 12 }}>
          <p>ISFAD - RDI</p>
          <p style={{ marginTop: 4, fontSize: 11 }}>Plateforme d'analyse du raisonnement en STEAM</p>
        </div>
      </div>

      {/* Panneau droit - Formulaire */}
      <div style={{
        width: 520, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, position: 'relative', zIndex: 2,
        boxShadow: '-10px 0 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlaskConical size={22} color="white" />
              </div>
              <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--dark)', letterSpacing: -1 }}>
                FIN<span style={{ color: 'var(--purple-mid)' }}>-R</span>
              </span>
            </div>
            <p style={{ color: 'var(--gray)', fontSize: 13 }}>Analyse du raisonnement en STEAM</p>
          </div>

          {/* Form */}
          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            style={{
              background: 'white',
              borderRadius: 24, padding: 36,
              display: 'flex', flexDirection: 'column', gap: 20,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(83,74,183,0.1)',
              border: '1px solid rgba(83,74,183,0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative top bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: 'linear-gradient(90deg, var(--purple) 0%, var(--purple-mid) 50%, var(--purple) 100%)',
            }} />
            {mode === 'register' && (
              <>
                <div>
                  <label style={labelStyle}>Nom complet *</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Prénom Nom"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Rôle *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as 'engineer' | 'researcher' }))}
                    style={{
                      ...inputStyle,
                      background: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="engineer">Ingénieur</option>
                    <option value="researcher">Chercheur</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Spécialité</label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                    placeholder="Ex: Génie informatique"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ ...labelStyle, color: 'var(--purple-dark)', fontSize: 14, marginBottom: 10 }}>Email *</label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="vous@esp.sn"
                style={{
                  ...inputStyle,
                  background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                  border: '2px solid #E2E8F0',
                  padding: '15px 18px',
                  borderRadius: 14,
                  fontSize: 15,
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--purple)';
                  e.target.style.background = 'white';
                  e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.1), inset 0 1px 2px rgba(0,0,0,0.04)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.background = 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)';
                }}
              />
            </div>

            <div>
              <label style={{ ...labelStyle, color: 'var(--purple-dark)', fontSize: 14, marginBottom: 10 }}>Mot de passe *</label>
              <input
                type="password" required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                style={{
                  ...inputStyle,
                  background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                  border: '2px solid #E2E8F0',
                  padding: '15px 18px',
                  borderRadius: 14,
                  fontSize: 15,
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--purple)';
                  e.target.style.background = 'white';
                  e.target.style.boxShadow = '0 0 0 3px rgba(83,74,183,0.1), inset 0 1px 2px rgba(0,0,0,0.04)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.background = 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.04)';
                }}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={labelStyle}>Confirmer le mot de passe *</label>
                <input
                  type="password" required
                  value={form.password_confirmation}
                  onChange={e => setForm(f => ({ ...f, password_confirmation: e.target.value }))}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                />
              </div>
            )}

            {error && (
              <div style={{
                background: error.includes('Compte créé') ? 'var(--green-bg)' : 'var(--red-bg)',
                border: `1px solid ${error.includes('Compte créé') ? 'rgba(29,158,117,0.3)' : 'rgba(220,38,38,0.3)'}`,
                borderRadius: 10, padding: '12px 14px', fontSize: 13,
                color: error.includes('Compte créé') ? 'var(--green)' : 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--purple) 0%, var(--purple-dark) 100%)',
                color: 'white', fontWeight: 700, fontSize: 16,
                opacity: submitting ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginTop: 12, boxShadow: '0 8px 20px rgba(83,74,183,0.35)',
                transition: 'all 0.2s',
                letterSpacing: 0.3,
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(83,74,183,0.45)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(83,74,183,0.35)';
              }}
            >
              {submitting
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> {mode === 'login' ? 'Connexion...' : 'Création...'}</>
                : mode === 'login' ? 'Se connecter' : 'Créer mon compte'
              }
            </button>
          </form>

          {/* Mode switcher - en bas du formulaire */}
          <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--light-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 12, textAlign: 'center' }}>
              {mode === 'login' ? "Vous n'avez pas de compte ?" : 'Vous avez déjà un compte ?'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {mode === 'login' ? (
                <button
                  onClick={() => { setMode('register'); setError(''); }}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'white', color: 'var(--purple)',
                    border: '2px solid var(--purple)',
                    transition: 'all 0.2s',
                  }}
                >
                  Créer un compte
                </button>
              ) : (
                <button
                  onClick={() => { setMode('login'); setError(''); }}
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'white', color: 'var(--purple)',
                    border: '2px solid var(--purple)',
                    transition: 'all 0.2s',
                  }}
                >
                  Se connecter
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #94A3B8; }
        input:focus { border-color: var(--purple) !important; }
      `}</style>
    </div>
  );
};

export default Login;