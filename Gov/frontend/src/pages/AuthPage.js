import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, ArrowRight, Home, ShieldCheck, AlertCircle,
  ShieldPlus, CreditCard, Phone, Key, CheckCircle2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const AuthPage = () => {
  const { t } = useTranslation();
  const API_BASE_URL = 'http://localhost:5005';
  const navigate = useNavigate();
  const location = useLocation();
  const isRegisterPage = location.pathname === '/register';

  // --- Login State ---
  const [loginData, setLoginData] = useState({ adharNumber: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- Register State ---
  const [regData, setRegData] = useState({
    name: '', adharNumber: '', mobileNumber: '', password: '', otp: ''
  });
  const [otpSent, setOtpSent] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // --- Login Logic ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const isNumeric = /^\d+$/.test(loginData.adharNumber);
    if (isNumeric && loginData.adharNumber.length !== 12) {
      setLoginError(t('auth_error_aadhar_length'));
      setLoginLoading(false);
      return;
    }

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/users/login`, loginData);
      localStorage.setItem('userInfo', JSON.stringify(data));
      if (data.userType === 'admin') navigate('/admin-dashboard');
      else if (data.userType === 'officer') navigate('/officer-dashboard');
      else navigate('/dashboard');
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // --- Register Logic ---
  const handleRegChange = (e) => {
    setRegData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (regError) setRegError('');
  };

  const onSendOtp = async () => {
    if (regData.mobileNumber.length !== 10) {
      setRegError(t('auth_error_mobile_length'));
      return;
    }
    setRegLoading(true);
    setRegError('');
    try {
      await axios.post(`${API_BASE_URL}/api/users/send-otp`, { mobileNumber: regData.mobileNumber });
      setOtpSent(true);
      setRegSuccess(t('auth_success_otp_sent'));
      setTimeout(() => setRegSuccess(''), 3000);
    } catch (err) {
      setRegError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setRegLoading(false);
    }
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    if (!otpSent) {
      setRegError(t('auth_error_send_otp_first'));
      return;
    }
    setRegLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/users/verify-otp`, {
        mobileNumber: regData.mobileNumber,
        otp: regData.otp
      });
      const { data } = await axios.post(`${API_BASE_URL}/api/users`, {
        ...regData, userType: 'citizen'
      });
      localStorage.setItem('userInfo', JSON.stringify(data));
      setRegSuccess(t('auth_success_register'));
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setRegError(err.response?.data?.message || 'Verification or Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          .back-home-hover:hover {
            background-color: #ffffff !important;
            color: #2563eb !important;
            transform: translateX(-5px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
            border-color: #2563eb !important;
          }

          @keyframes float {
            0% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
            100% { transform: translateY(0) rotate(0deg); }
          }

          .floating-shape {
            animation: float 6s ease-in-out infinite;
          }
        `}
      </style>

      {/* Background Decorations */}
      <div style={styles.overlay} />
      <div style={styles.meshGradient} />
      <div style={{ ...styles.floatingShape, top: '15%', left: '10%', width: '150px', height: '150px', background: 'rgba(37, 99, 235, 0.15)', borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', animationDelay: '0s' }} className="floating-shape" />
      <div style={{ ...styles.floatingShape, bottom: '20%', right: '15%', width: '200px', height: '200px', background: 'rgba(124, 58, 237, 0.15)', borderRadius: '50% 50% 20% 80% / 25% 80% 20% 75%', animationDelay: '-2s' }} className="floating-shape" />
      <div style={{ ...styles.floatingShape, top: '40%', right: '10%', width: '80px', height: '80px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%', animationDelay: '-4s' }} className="floating-shape" />

      <Link to="/" style={styles.backHomeButton} className="back-home-hover">
        <Home size={18} />
        <span>{t('auth_back_home')}</span>
      </Link>

      <LanguageSelector style={{ position: 'fixed', top: '30px', right: '30px', zIndex: 100, backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderRadius: '10px' }} />

      <div style={styles.bgDecoration1} />
      <div style={styles.bgDecoration2} />

      <div style={styles.perspectiveContainer}>
        <motion.div
          animate={{ rotateY: isRegisterPage ? 180 : 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 260, damping: 20 }}
          style={styles.flipCard}
        >
          {/* Front Side - Login */}
          <div style={{ ...styles.cardSide, ...styles.cardFront }}>
            <div style={styles.header}>
              <div style={styles.logoContainer}>
                <ShieldCheck size={32} color="#2563eb" />
              </div>
              <h2 style={styles.heading}>Welcome Back</h2>
              <p style={styles.subHeading}>Login to your secure Gov portal</p>
            </div>

            <form onSubmit={handleLoginSubmit} style={styles.form}>
              <AnimatePresence>
                {loginError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={styles.errorContainer}>
                    <AlertCircle size={18} />
                    <span>{loginError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={styles.inputWrapper}>
                <label style={styles.label}>{t('auth_label_aadhar_username')}</label>
                <div style={styles.inputContainer}>
                  <User size={20} style={styles.inputIcon} />
                  <input
                    type="text"
                    value={loginData.adharNumber}
                    onChange={(e) => setLoginData({ ...loginData, adharNumber: e.target.value })}
                    placeholder={t('auth_placeholder_aadhar_username')}
                    maxLength="12"
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.inputWrapper}>
                <label style={styles.label}>{t('auth_label_password')}</label>
                <div style={styles.inputContainer}>
                  <Lock size={20} style={styles.inputIcon} />
                  <input
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder={t('auth_placeholder_password')}
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loginLoading} style={{ ...styles.button, opacity: loginLoading ? 0.7 : 1 }}>
                {loginLoading ? t('auth_btn_authenticating') : <><ArrowRight size={20} style={{ marginRight: '8px' }} /> {t('auth_btn_login')}</>}
              </motion.button>
            </form>

            <div style={styles.footer}>
              <p style={styles.footerText}>
                {t('auth_footer_no_account')} <Link to="/register" style={styles.link}>{t('auth_footer_register_now')}</Link>
              </p>
            </div>
          </div>

          {/* Back Side - Register */}
          <div style={{ ...styles.cardSide, ...styles.cardBack }}>
            <div style={styles.header}>
              <div style={styles.logoContainer}>
                <ShieldPlus size={32} color="#2563eb" />
              </div>
              <h2 style={styles.heading}>{t('auth_create_account')}</h2>
              <p style={styles.subHeading}>{t('auth_register_subtitle')}</p>
            </div>

            <form onSubmit={handleRegSubmit} style={styles.form}>
              <AnimatePresence mode="wait">
                {regError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={styles.errorContainer}>
                    <AlertCircle size={18} />
                    <span>{regError}</span>
                  </motion.div>
                )}
                {regSuccess && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={styles.successContainer}>
                    <CheckCircle2 size={18} />
                    <span>{regSuccess}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={styles.inputWrapper}>
                <label style={styles.label}>{t('auth_label_fullname')}</label>
                <div style={styles.inputContainer}>
                  <User size={18} style={styles.inputIcon} />
                  <input type="text" name="name" value={regData.name} onChange={handleRegChange} placeholder={t('auth_placeholder_fullname')} required style={styles.input} />
                </div>
              </div>

              <div style={styles.inputWrapper}>
                <label style={styles.label}>{t('auth_label_aadhar')}</label>
                <div style={styles.inputContainer}>
                  <CreditCard size={18} style={styles.inputIcon} />
                  <input type="text" name="adharNumber" value={regData.adharNumber} onChange={handleRegChange} placeholder={t('auth_placeholder_aadhar')} minLength="12" maxLength="12" pattern="[0-9]{12}" required style={styles.input} />
                </div>
              </div>

              <div style={styles.inputWrapper}>
                <label style={styles.label}>{t('auth_label_mobile')}</label>
                <div style={{ ...styles.inputContainer, gap: '12px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Phone size={18} style={styles.inputIcon} />
                    <input type="text" name="mobileNumber" value={regData.mobileNumber} onChange={handleRegChange} placeholder={t('auth_placeholder_mobile')} minLength="10" maxLength="10" pattern="[0-9]{10}" required style={styles.input} />
                  </div>
                  {!otpSent && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={onSendOtp} disabled={regLoading} style={styles.otpButton}>
                      {t('auth_btn_send_otp')}
                    </motion.button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={styles.inputWrapper}>
                    <label style={styles.label}>{t('auth_label_otp')}</label>
                    <div style={styles.inputContainer}>
                      <Key size={18} style={styles.inputIcon} />
                      <input type="text" name="otp" value={regData.otp} onChange={handleRegChange} placeholder={t('auth_placeholder_otp')} required style={styles.input} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={styles.inputWrapper}>
                <label style={styles.label}>{t('auth_label_password')}</label>
                <div style={styles.inputContainer}>
                  <Lock size={18} style={styles.inputIcon} />
                  <input type="password" name="password" value={regData.password} onChange={handleRegChange} placeholder={t('auth_placeholder_create_password')} required style={styles.input} />
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={regLoading || (otpSent && !regData.otp)} style={{ ...styles.submitButton, opacity: regLoading ? 0.7 : 1 }}>
                {regLoading ? t('auth_btn_processing') : <><CheckCircle2 size={20} style={{ marginRight: '8px' }} /> {t('auth_btn_register')}</>}
              </motion.button>
            </form>

            <div style={styles.footer}>
              <p style={styles.footerText}>
                {t('auth_footer_has_account')} <Link to="/login" style={styles.link}>{t('auth_footer_login_instead')}</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    padding: '40px 20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundImage: 'url("https://images.unsplash.com/photo-1599839619722-39751411883e?q=80&w=2000&auto=format&fit=crop")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
    zIndex: 0,
  },
  meshGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.1) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(124, 58, 237, 0.1) 0px, transparent 50%)
    `,
    zIndex: 1,
    pointerEvents: 'none',
  },
  floatingShape: {
    position: 'absolute',
    zIndex: 1,
    pointerEvents: 'none',
    filter: 'blur(80px)',
    opacity: 0.4,
  },
  backHomeButton: {
    position: 'fixed',
    top: '30px',
    left: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(10px)',
    color: '#ffffff',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 100,
    cursor: 'pointer',
  },
  perspectiveContainer: {
    perspective: '1500px',
    width: '480px',
    maxWidth: '100%',
    zIndex: 1,
  },
  flipCard: {
    position: 'relative',
    width: '100%',
    transformStyle: 'preserve-3d',
    height: 'auto',
    minHeight: '720px',
  },
  cardSide: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    backfaceVisibility: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
  },
  cardFront: {
    zIndex: 2,
  },
  cardBack: {
    transform: 'rotateY(180deg)',
    zIndex: 1,
  },
  bgDecoration1: {
    position: 'absolute',
    top: '-10%',
    right: '-5%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0) 70%)',
    zIndex: 0,
  },
  bgDecoration2: {
    position: 'absolute',
    bottom: '-10%',
    left: '-5%',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0) 70%)',
    zIndex: 0,
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logoContainer: {
    width: '56px',
    height: '56px',
    backgroundColor: '#eff6ff',
    borderRadius: '14px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 16px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '6px',
  },
  subHeading: {
    fontSize: '15px',
    color: '#64748b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #fee2e2',
  },
  successContainer: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #dcfce7',
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    marginLeft: '4px',
  },
  inputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    backgroundColor: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '15px',
    color: '#1e293b',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  otpButton: {
    padding: '0 20px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    height: '42.5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  button: {
    padding: '14px 24px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    marginTop: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  },
  submitButton: {
    padding: '14px 24px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    marginTop: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  footerText: {
    fontSize: '13px',
    color: '#64748b',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600',
  },
};

export default AuthPage;
