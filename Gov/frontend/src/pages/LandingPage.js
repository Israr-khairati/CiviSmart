import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const CountUp = ({ end, duration = 2000, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => {
      if (countRef.current) {
        observer.unobserve(countRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function: easeOutExpo
      const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setCount(Math.floor(easedProgress * end));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return <span ref={countRef}>{count.toLocaleString()}{suffix}</span>;
};

const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);

  const scrollToSection = (ref) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => {
      revealElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  const features = [
    {
      title: t('features_quick_reporting_title'),
      description: t('features_quick_reporting_desc'),
      icon: '⚡',
      color: '#3b82f6'
    },
    {
      title: t('features_ai_verification_title'),
      description: t('features_ai_verification_desc'),
      icon: '🤖',
      color: '#8b5cf6'
    },
    {
      title: t('features_tracking_title'),
      description: t('features_tracking_desc'),
      icon: '📍',
      color: '#f59e0b'
    },
    {
      title: t('features_resolution_title'),
      description: t('features_resolution_desc'),
      icon: '✅',
      color: '#10b981'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={styles.container}
    >
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(2deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes float-slow {
            0% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(10px, -15px) rotate(2deg); }
            66% { transform: translate(-10px, 10px) rotate(-1deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
          }
          @keyframes bg-glow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .hover-card {
            transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .hover-card:hover {
            transform: translateY(-15px) scale(1.02);
            box-shadow: 0 40px 80px -15px rgba(0, 0, 0, 0.15) !important;
            border-color: #3b82f6 !important;
          }
          .nav-btn:hover {
            background-color: #f1f5f9 !important;
            border-color: #2563eb !important;
            color: #2563eb !important;
          }
          .cta-btn {
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
            position: relative;
            overflow: hidden;
          }
          .cta-btn::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
          }
          .cta-btn:hover::after {
            width: 300px;
            height: 300px;
          }
          .cta-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 30px -5px rgba(37, 99, 235, 0.5) !important;
          }
          .glass-nav {
            transition: all 0.4s ease;
          }
          .glass-nav.scrolled {
            background: rgba(255, 255, 255, 0.85) !important;
            backdrop-filter: blur(12px) !important;
            padding: 1rem 8% !important;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
          }
          .gradient-text {
            background: linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #2563eb 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: bg-glow 5s linear infinite;
          }
          .reveal {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .reveal.visible {
            opacity: 1;
            transform: translateY(0);
          }
          .floating-icon {
            position: absolute;
            opacity: 0.1;
            animation: float-slow 10s ease-in-out infinite;
            z-index: 1;
            pointer-events: none;
          }
          .trust-logo {
            transition: all 0.3s ease;
          }
          .trust-logo:hover {
            opacity: 1 !important;
            color: #2563eb !important;
            transform: scale(1.1);
          }
          .footer-link {
            transition: all 0.3s ease;
          }
          .footer-link:hover {
            color: #2563eb !important;
            transform: translateX(8px);
          }
        `}
      </style>

      {/* Navbar */}
      <nav className={`glass-nav ${scrolled ? 'scrolled' : ''}`} style={styles.navbar}>
        <div style={styles.logo}>
          <div style={styles.logoCircle}>🌐</div>
          <span style={styles.logoText}>CiviSmart</span>
        </div>
        <div style={styles.navButtons}>
          <LanguageSelector />
          <button className="nav-btn" style={styles.loginBtn} onClick={() => navigate('/login')}>{t('nav_login')}</button>
          <button className="cta-btn" style={styles.registerBtn} onClick={() => navigate('/register')}>{t('nav_join')}</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={styles.hero}>
        {/* Floating Background Elements */}
        <div className="floating-icon" style={{ top: '15%', left: '10%', fontSize: '3rem' }}>🏙️</div>
        <div className="floating-icon" style={{ top: '25%', right: '15%', fontSize: '2.5rem', animationDelay: '-2s' }}>🏗️</div>
        <div className="floating-icon" style={{ bottom: '20%', left: '20%', fontSize: '2rem', animationDelay: '-5s' }}>🚦</div>
        <div className="floating-icon" style={{ bottom: '30%', right: '10%', fontSize: '3.5rem', animationDelay: '-7s' }}>🌳</div>

        <div style={styles.heroContent}>
          <div style={styles.badge}>
            <span style={styles.badgeDot}></span>
            Trusted by 50+ Modern Cities
          </div>
          <h1 style={styles.heroTitle}>
            {t('hero_title_prefix')} <span className="gradient-text">{t('hero_title_highlight')}</span> <br />
            {t('hero_title_suffix')}
          </h1>
          <p style={styles.heroSubtitle}>
            {t('hero_subtitle')}
          </p>
          <div style={styles.heroActions}>
            <button className="cta-btn" style={styles.ctaPrimary} onClick={() => navigate('/register')}>{t('hero_cta_primary')}</button>
            <button className="cta-btn" style={styles.ctaSecondary} onClick={() => navigate('/login')}>{t('hero_cta_secondary')}</button>
          </div>
        </div>

        <div style={styles.heroStats}>
          <div style={styles.statBox}>
            <div style={styles.statIcon}>🏢</div>
            <div>
              <div style={styles.statNumber}><CountUp end={50} suffix="+" /></div>
              <span style={styles.statLabel}>{t('hero_stat_cities')}</span>
            </div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBox}>
            <div style={styles.statIcon}>⚡</div>
            <div>
              <div style={styles.statNumber}><CountUp end={12500} suffix="+" /></div>
              <span style={styles.statLabel}>{t('hero_stat_issues')}</span>
            </div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBox}>
            <div style={styles.statIcon}>👥</div>
            <div>
              <div style={styles.statNumber}><CountUp end={1200000} suffix="+" /></div>
              <span style={styles.statLabel}>{t('hero_stat_citizens')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section style={styles.trustedBy}>
        <div className="reveal">
          <p style={styles.trustedTitle}>{t('trusted_by_title')}</p>
          <div style={styles.logoCloud}>
            <span className="trust-logo" style={styles.trustLogo}>CITY COUNCIL</span>
            <span className="trust-logo" style={styles.trustLogo}>URBAN DEV</span>
            <span className="trust-logo" style={styles.trustLogo}>METRO POLICE</span>
            <span className="trust-logo" style={styles.trustLogo}>CIVIC TECH</span>
            <span className="trust-logo" style={styles.trustLogo}>GOV HUB</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} style={styles.features}>
        <div className="reveal" style={styles.sectionHeader}>
          <div style={styles.smallHeader}>{t('features_section_header')}</div>
          <h2 style={styles.sectionTitle}>{t('features_section_title')}</h2>
          <p style={styles.sectionSubtitle}>{t('features_section_subtitle')}</p>
        </div>
        <div style={styles.featureGrid}>
          {features.map((f, i) => (
            <div key={i} className="hover-card reveal" style={{ ...styles.featureCard, transitionDelay: `${i * 100}ms` }}>
              <div style={{ ...styles.featureIconContainer, backgroundColor: `${f.color}15`, color: f.color }}>
                {f.icon}
              </div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.description}</p>
              <div style={{ ...styles.featureDecoration, backgroundColor: f.color }} />
            </div>
          ))}
        </div>
      </section>

      {/* How it Works - Modern Version */}
      <section ref={howItWorksRef} style={styles.howItWorks}>
        <div className="reveal" style={styles.howItWorksCard}>
          <h2 style={styles.sectionTitleWhite}>{t('how_it_works_title')}</h2>
          <div style={styles.steps}>
            {[
              { num: 1, title: t('step_1_title'), desc: t('step_1_desc') },
              { num: 2, title: t('step_2_title'), desc: t('step_2_desc') },
              { num: 3, title: t('step_3_title'), desc: t('step_3_desc') }
            ].map((s, i) => (
              <React.Fragment key={i}>
                <div style={styles.step}>
                  <div style={styles.stepNumberContainer}>
                    <div style={styles.stepNumber}>{s.num}</div>
                  </div>
                  <h4 style={styles.stepTitle}>{s.title}</h4>
                  <p style={styles.stepDesc}>{s.desc}</p>
                </div>
                {i < 2 && <div style={styles.stepConnector} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.finalCTA}>
        <div className="reveal">
          <h2 style={styles.ctaTitle}>{t('final_cta_title')}</h2>
          <p style={styles.ctaSubtitle}>{t('final_cta_subtitle')}</p>
          <button className="cta-btn" style={styles.ctaPrimaryLarge} onClick={() => navigate('/register')}>{t('final_cta_button')}</button>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerGrid}>
          <div style={styles.footerBrand}>
            <div style={styles.logo}>
              <div style={styles.logoCircleSmall}>🌐</div>
              <span style={styles.logoTextSmall}>CiviSmart</span>
            </div>
            <p style={styles.footerDesc}>{t('footer_desc')}</p>
          </div>
          <div style={styles.footerLinks}>
            <div style={styles.linkColumn}>
              <span style={styles.linkHeader}>{t('footer_platform')}</span>
              <span className="footer-link" style={styles.link} onClick={() => scrollToSection(howItWorksRef)}>{t('footer_how_it_works')}</span>
              <span className="footer-link" style={styles.link} onClick={() => scrollToSection(featuresRef)}>{t('footer_features')}</span>
              <span className="footer-link" style={styles.link} onClick={() => navigate('/login')}>{t('footer_dashboard')}</span>
            </div>
            <div style={styles.linkColumn}>
              <span style={styles.linkHeader}>{t('footer_support')}</span>
              <span className="footer-link" style={styles.link} onClick={() => navigate('/login')}>{t('footer_help_center')}</span>
              <span className="footer-link" style={styles.link} onClick={() => navigate('/login')}>{t('footer_contact')}</span>
              <span className="footer-link" style={styles.link} onClick={() => navigate('/login')}>{t('footer_privacy')}</span>
            </div>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <p>{t('footer_copyright')}</p>
        </div>
      </footer>
    </motion.div>
  );
};

const styles = {
  container: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#1e293b',
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    overflowX: 'hidden',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 8%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderBottom: '1px solid rgba(241, 245, 249, 0.8)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  logoCircle: {
    width: '40px',
    height: '40px',
    backgroundColor: '#2563eb',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: 'white',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
  },
  logoCircleSmall: {
    width: '32px',
    height: '32px',
    backgroundColor: '#2563eb',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    color: 'white',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.03em',
  },
  logoTextSmall: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.03em',
  },
  navButtons: {
    display: 'flex',
    gap: '1.25rem',
  },
  loginBtn: {
    padding: '0.625rem 1.5rem',
    backgroundColor: 'transparent',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  registerBtn: {
    padding: '0.625rem 1.75rem',
    backgroundColor: '#0f172a',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
  },
  hero: {
    padding: '180px 8% 140px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    background: 'radial-gradient(circle at 50% 50%, #f0f7ff 0%, #ffffff 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: '100px',
    color: '#2563eb',
    fontSize: '0.875rem',
    fontWeight: '700',
    marginBottom: '2.5rem',
    border: '1px solid rgba(37, 99, 235, 0.15)',
    animation: 'fadeIn 0.8s ease-out',
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#2563eb',
    borderRadius: '50%',
    display: 'inline-block',
    boxShadow: '0 0 10px #2563eb',
  },
  trustedBy: {
    padding: '60px 8%',
    textAlign: 'center',
    borderTop: '1px solid #f1f5f9',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#ffffff',
  },
  trustedTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.2em',
    marginBottom: '3rem',
  },
  logoCloud: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '5rem',
    flexWrap: 'wrap',
    opacity: 0.5,
  },
  trustLogo: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#475569',
    letterSpacing: '-0.02em',
    cursor: 'default',
  },
  heroContent: {
    maxWidth: '1000px',
    marginBottom: '100px',
    zIndex: 2,
    position: 'relative',
  },
  heroTitle: {
    fontSize: '5.5rem',
    fontWeight: '900',
    lineHeight: '1.1',
    color: '#0f172a',
    marginBottom: '2.5rem',
    letterSpacing: '-0.04em',
    animation: 'fadeIn 0.8s ease-out 0.2s backwards',
  },
  heroSubtitle: {
    fontSize: '1.5rem',
    color: '#64748b',
    lineHeight: '1.6',
    marginBottom: '4rem',
    maxWidth: '800px',
    margin: '0 auto 4rem',
    animation: 'fadeIn 0.8s ease-out 0.4s backwards',
  },
  heroActions: {
    display: 'flex',
    gap: '1.5rem',
    justifyContent: 'center',
    animation: 'fadeIn 0.8s ease-out 0.6s backwards',
  },
  ctaPrimary: {
    padding: '1.25rem 3.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '1.25rem',
    fontSize: '1.125rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
  },
  ctaSecondary: {
    padding: '1.25rem 3.5rem',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    borderRadius: '1.25rem',
    fontSize: '1.125rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  heroStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '2.5rem',
    padding: '3rem 4rem',
    backgroundColor: 'white',
    borderRadius: '3.5rem',
    boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.1)',
    border: '1px solid #f1f5f9',
    animation: 'float 6s ease-in-out infinite',
    zIndex: 2,
  },
  statBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    textAlign: 'left',
  },
  statIcon: {
    fontSize: '2.5rem',
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '1.25rem',
  },
  statNumber: {
    fontSize: '2.25rem',
    fontWeight: '900',
    color: '#0f172a',
    display: 'block',
    lineHeight: '1.2',
  },
  statLabel: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: '0.01em',
  },
  statDivider: {
    width: '1px',
    height: '60px',
    backgroundColor: '#f1f5f9',
  },
  features: {
    padding: '160px 8%',
    backgroundColor: '#ffffff',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '6rem',
    maxWidth: '800px',
    margin: '0 auto 6rem',
  },
  smallHeader: {
    fontSize: '0.875rem',
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: '0.15em',
    marginBottom: '1.25rem',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: '4rem',
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: '1.75rem',
    letterSpacing: '-0.04em',
    lineHeight: '1.1',
  },
  sectionSubtitle: {
    fontSize: '1.25rem',
    color: '#64748b',
    lineHeight: '1.7',
    textAlign: 'center',
    maxWidth: '650px',
  },
  featureGrid: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    overflowX: 'auto',
    padding: '2rem 1rem',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  featureCard: {
    flex: '1',
    minWidth: '280px',
    padding: '3rem 2rem',
    backgroundColor: '#ffffff',
    borderRadius: '2.5rem',
    border: '1px solid #f1f5f9',
    transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)',
  },
  featureIconContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.5rem',
    marginBottom: '2.5rem',
    boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)',
  },
  featureTitle: {
    fontSize: '1.875rem',
    fontWeight: '800',
    marginBottom: '1.25rem',
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  featureDesc: {
    color: '#64748b',
    lineHeight: '1.7',
    fontSize: '1.125rem',
  },
  featureDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '6px',
    opacity: 0.1,
  },
  howItWorks: {
    padding: '100px 8% 140px',
  },
  howItWorksCard: {
    backgroundColor: '#0f172a',
    borderRadius: '4.5rem',
    padding: '120px 8%',
    textAlign: 'center',
    color: 'white',
    boxShadow: '0 50px 100px -20px rgba(15, 23, 42, 0.35)',
    position: 'relative',
    overflow: 'hidden',
    backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.2) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(124, 58, 237, 0.2) 0%, transparent 50%)',
  },
  sectionTitleWhite: {
    fontSize: '4rem',
    fontWeight: '900',
    marginBottom: '8rem',
    color: 'white',
    letterSpacing: '-0.04em',
  },
  steps: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '3rem',
    maxWidth: '1100px',
    margin: '0 auto',
    position: 'relative',
  },
  step: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
  },
  stepNumberContainer: {
    width: '120px',
    height: '120px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 3rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.4s ease',
  },
  stepNumber: {
    width: '72px',
    height: '72px',
    backgroundColor: '#2563eb',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: '900',
    boxShadow: '0 0 40px rgba(37, 99, 235, 0.6)',
  },
  stepTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    marginBottom: '1.5rem',
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  stepDesc: {
    color: '#94a3b8',
    lineHeight: '1.8',
    fontSize: '1.125rem',
  },
  stepConnector: {
    width: '80px',
    height: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: '60px',
    flexShrink: 0,
  },
  finalCTA: {
    padding: '200px 8%',
    textAlign: 'center',
    background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaTitle: {
    fontSize: '5rem',
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: '2.5rem',
    letterSpacing: '-0.05em',
    lineHeight: '1.1',
  },
  ctaSubtitle: {
    fontSize: '1.625rem',
    color: '#64748b',
    marginBottom: '5rem',
    maxWidth: '800px',
    margin: '0 auto 5rem',
  },
  ctaPrimaryLarge: {
    padding: '1.5rem 5rem',
    backgroundColor: '#0f172a',
    color: 'white',
    border: 'none',
    borderRadius: '1.75rem',
    fontSize: '1.5rem',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  footer: {
    padding: '140px 8% 60px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #f1f5f9',
  },
  footerGrid: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '100px',
    gap: '3rem',
    flexWrap: 'wrap',
  },
  footerBrand: {
    maxWidth: '400px',
  },
  footerDesc: {
    color: '#64748b',
    marginTop: '2.5rem',
    lineHeight: '1.8',
    fontSize: '1.125rem',
  },
  footerLinks: {
    display: 'flex',
    gap: '6rem',
    flexWrap: 'wrap',
  },
  linkColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  linkHeader: {
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: '2.5rem',
    fontSize: '1.25rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
  },
  link: {
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '1.125rem',
    textDecoration: 'none',
    display: 'block',
    fontWeight: '500',
  },
  footerBottom: {
    paddingTop: '60px',
    borderTop: '1px solid #f1f5f9',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '1.125rem',
    fontWeight: '500',
  },
};

export default LandingPage;
