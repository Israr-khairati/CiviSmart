import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import MapPicker from '../components/MapPicker';
import MapView from '../components/MapView';
import { io } from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import Chatbot from '../components/Chatbot';
import LanguageSelector from '../components/LanguageSelector';

const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: file.type || 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, file.type || 'image/jpeg', quality);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const CitizenDashboard = () => {
  const API_BASE_URL = 'http://localhost:5005';
  const { t, i18n } = useTranslation();
  const HERO_ILLUSTRATION_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="760" height="460" viewBox="0 0 760 460">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#f3f7ff"/>
          <stop offset="1" stop-color="#eef6ff"/>
        </linearGradient>
      </defs>
      <rect width="760" height="460" rx="24" fill="url(#bg)"/>
      <circle cx="600" cy="120" r="70" fill="#e6f1ff"/>
      <circle cx="120" cy="90" r="45" fill="#e6f1ff"/>
      <rect x="110" y="310" width="540" height="90" rx="18" fill="#1a3a5f" opacity="0.10"/>
      <path d="M130 330 C 260 260, 500 430, 630 330" fill="none" stroke="#1a3a5f" stroke-width="14" opacity="0.35" stroke-linecap="round"/>
      <path d="M160 355 C 290 285, 470 415, 600 355" fill="none" stroke="#1a3a5f" stroke-width="10" opacity="0.35" stroke-linecap="round"/>
      <g transform="translate(250 185)">
        <rect x="0" y="0" width="260" height="130" rx="22" fill="#ffffff" opacity="0.95"/>
        <rect x="22" y="22" width="216" height="16" rx="8" fill="#e6eef8"/>
        <rect x="22" y="50" width="160" height="14" rx="7" fill="#e6eef8"/>
        <rect x="22" y="74" width="190" height="14" rx="7" fill="#e6eef8"/>
        <rect x="22" y="98" width="120" height="14" rx="7" fill="#e6eef8"/>
        <circle cx="232" cy="104" r="22" fill="#f36d38" opacity="0.18"/>
        <path d="M232 92 l10 18 h-20 z" fill="#f36d38"/>
      </g>
      <g transform="translate(145 170)">
        <circle cx="0" cy="0" r="34" fill="#f36d38" opacity="0.14"/>
        <path d="M0 -18 C 10 -18, 18 -10, 18 0 C 18 16, 0 30, 0 30 C 0 30, -18 16, -18 0 C -18 -10, -10 -18, 0 -18 Z" fill="#f36d38"/>
        <circle cx="0" cy="2" r="6" fill="#ffffff"/>
      </g>
      <text x="60" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#1a3a5f" opacity="0.75">${t('hero_svg_text')}</text>
    </svg>
  `;
  const HERO_ILLUSTRATION = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    HERO_ILLUSTRATION_SVG
  )}`;
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [publicComplaints, setPublicComplaints] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [reRaiseSourceComplaint, setReRaiseSourceComplaint] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [selectedComplaintForFeedback, setSelectedComplaintForFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('Home');
  const [lastViewedNotifications, setLastViewedNotifications] = useState(
    localStorage.getItem('lastViewedNotifications')
      ? new Date(localStorage.getItem('lastViewedNotifications'))
      : new Date(0)
  );
  const [highlightedComplaintId, setHighlightedComplaintId] = useState(null);
  const [realTimeNotifications, setRealTimeNotifications] = useState(
    JSON.parse(localStorage.getItem('realTimeNotifications') || '[]')
  );
  const [selectedComplaintForMap, setSelectedComplaintForMap] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [showComplaintDetailModal, setShowComplaintDetailModal] = useState(false);
  const [selectedComplaintForDetail, setSelectedComplaintForDetail] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', mobileNumber: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const socketRef = useRef();

  useEffect(() => {
    localStorage.setItem('realTimeNotifications', JSON.stringify(realTimeNotifications));
  }, [realTimeNotifications]);

  useEffect(() => {
    if (userInfo && userInfo._id) {
      socketRef.current = io(API_BASE_URL);

      socketRef.current.on('connect', () => {
        console.log('Connected to socket server');
        socketRef.current.emit('join', userInfo._id);
      });

      socketRef.current.on('notification', (data) => {
        console.log('Received notification:', data);
        setRealTimeNotifications(prev => [data, ...prev]);
        setNotification({
          type: 'success',
          message: data.message
        });
        // Refresh complaints to show updated status
        fetchComplaints(userInfo.token);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [userInfo]);

  useEffect(() => {
    if (activeTab === 'Notifications') {
      const now = new Date();
      setLastViewedNotifications(now);
      localStorage.setItem('lastViewedNotifications', now.toISOString());
    }
  }, [activeTab]);

  useEffect(() => {
    if (userInfo && !isEditingProfile) {
      setProfileForm({
        name: userInfo.name || '',
        mobileNumber: userInfo.mobileNumber || '',
      });
    }
  }, [userInfo, isEditingProfile]);
  const [formData, setFormData] = useState({
    address: '',
    latitude: null,
    longitude: null,
    image: null,
    isAddressManual: false,
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);

    // Check if we are in a secure context (HTTPS or localhost)
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.warn('Geolocation requested on insecure origin. Attempting IP-based fallback.');
      fetchIpBasedLocation();
      return;
    }

    if (!navigator.geolocation) {
      setNotification({ type: 'error', message: 'Geolocation is not supported by your browser' });
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        processLocation(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Unable to retrieve your location';

        if (error.code === 1) { // PERMISSION_DENIED
          errorMsg = 'Location access denied. Please enable permissions in your browser.';
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          errorMsg = 'Location information is unavailable. Trying IP fallback...';
          fetchIpBasedLocation();
          return;
        } else if (error.code === 3) { // TIMEOUT
          errorMsg = 'Location request timed out. Trying IP fallback...';
          fetchIpBasedLocation();
          return;
        }

        setNotification({ type: 'error', message: errorMsg });
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const fetchIpBasedLocation = async () => {
    try {
      // Use ipapi.co for free IP-based geolocation
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();

      if (data.latitude && data.longitude) {
        console.log('IP-based location found:', data.latitude, data.longitude);
        processLocation(data.latitude, data.longitude);
        setNotification({ type: 'info', message: 'Location estimated using IP address.' });
      } else {
        throw new Error('IP geolocation failed');
      }
    } catch (error) {
      console.error('IP-based location error:', error);
      setNotification({ type: 'error', message: 'Unable to retrieve location. Please mark it manually on the map.' });
      setIsGettingLocation(false);
    }
  };

  const processLocation = async (latitude, longitude) => {
    // Fetch human-readable address for coordinates
    let fetchedAddress = '';
    try {
      // Try multiple services for better reliability
      const fetchers = [];

      // 1. Nominatim
      fetchers.push((async () => {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: { 'User-Agent': 'CiviSmart-Gov/1.0' },
            signal: AbortSignal.timeout(2500)
          }
        );
        const data = await response.json();
        if (data.address) {
          const addr = data.address;
          const parts = [];
          if (addr.house_number) parts.push(addr.house_number);
          if (addr.road) parts.push(addr.road);
          if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
          if (addr.city_district) parts.push(addr.city_district);
          if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
          if (parts.length > 0) return parts.join(', ');
          return data.display_name;
        }
        throw new Error('Nominatim failed');
      })());

      // 2. Fallback to Google if available (though usually it's not without API key)
      if (window.google && window.google.maps) {
        fetchers.push((async () => {
          const geocoder = new window.google.maps.Geocoder();
          const latlng = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
          return new Promise((resolve, reject) => {
            geocoder.geocode({ location: latlng }, (results, status) => {
              if (status === "OK" && results[0]) resolve(results[0].formatted_address);
              else reject(new Error('Google failed'));
            });
          });
        })());
      }

      fetchedAddress = await Promise.any(fetchers);
    } catch (error) {
      console.error('Error fetching address for coordinates:', error);
      fetchedAddress = '';
    }

    setFormData(prev => ({
      ...prev,
      latitude,
      longitude,
      address: fetchedAddress || prev.address,
      isAddressManual: false
    }));
    setNotification({ type: 'success', message: 'Location captured successfully!' });
    setIsGettingLocation(false);
  };

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      const parsedUser = JSON.parse(storedUserInfo);
      if (parsedUser.userType === 'admin') {
        navigate('/admin-dashboard');
        return;
      }
      if (parsedUser.userType === 'officer') {
        navigate('/officer-dashboard');
        return;
      }
      setUserInfo(parsedUser);
      fetchComplaints(parsedUser.token);
      fetchPublicComplaints();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!userInfo || !userInfo.token) return;

    const refresh = () => {
      fetchComplaints(userInfo.token);
      fetchPublicComplaints();
    };

    const intervalId = setInterval(refresh, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [userInfo]);

  const fetchComplaints = async (token) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const { data } = await axios.get(`${API_BASE_URL}/api/complaints`, config);
      setComplaints(data);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    }
  };

  const fetchPublicComplaints = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/complaints/public`);
      setPublicComplaints(data);
    } catch (error) {
      console.error('Error fetching public complaints:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  const handleStartEditProfile = () => {
    setProfileForm({
      name: userInfo?.name || '',
      mobileNumber: userInfo?.mobileNumber || '',
    });
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setProfileForm({
      name: userInfo?.name || '',
      mobileNumber: userInfo?.mobileNumber || '',
    });
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!userInfo?.token) return;
    if (profileSaving) return;

    const name = String(profileForm.name || '').trim();
    const mobileDigits = String(profileForm.mobileNumber || '').replace(/\D/g, '');

    if (!name) {
      setNotification({ type: 'error', message: 'Name is required' });
      return;
    }
    if (mobileDigits.length !== 10) {
      setNotification({ type: 'error', message: 'Mobile Number must be exactly 10 digits' });
      return;
    }

    setProfileSaving(true);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const { data } = await axios.put(
        `${API_BASE_URL}/api/users/profile`,
        { name, mobileNumber: mobileDigits },
        config
      );

      setUserInfo(data);
      localStorage.setItem('userInfo', JSON.stringify(data));
      setIsEditingProfile(false);
      setNotification({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update profile',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleNotificationClick = (complaintId) => {
    setActiveTab('My Complaints');
    setHighlightedComplaintId(complaintId);

    setTimeout(() => {
      const element = document.getElementById(`complaint-${complaintId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => {
      setHighlightedComplaintId(null);
    }, 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value,
      };
      // Only set manual true if it's the address field and the value is being typed
      if (name === 'address') {
        newData.isAddressManual = true;
        // If user clears the address, clear coordinates too to enforce search
        if (!value) {
          newData.latitude = null;
          newData.longitude = null;
        }
      }
      return newData;
    });
  };

  const [externalSearchQuery, setExternalSearchQuery] = useState('');

  // Debounced effect to trigger MapPicker search when typing in address field
  useEffect(() => {
    if (formData.isAddressManual && formData.address.length >= 3) {
      const timer = setTimeout(() => {
        setExternalSearchQuery(formData.address);
      }, 500);
      return () => clearTimeout(timer);
    } else if (formData.isAddressManual && formData.address.length < 3) {
      setExternalSearchQuery('');
    }
  }, [formData.address, formData.isAddressManual]);

  const [isCompressing, setIsCompressing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setIsCompressing(true);
      try {
        const compressedFile = await compressImage(file);
        setFormData(prev => ({ ...prev, image: compressedFile }));
      } catch (error) {
        console.error('Image compression failed:', error);
        setFormData(prev => ({ ...prev, image: file }));
      } finally {
        setIsCompressing(false);
      }
    } else if (file) {
      setFormData(prev => ({ ...prev, image: file }));
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate that either address or map coordinates are provided
    if (!formData.address && !formData.latitude) {
      setNotification({ message: 'Please provide either an address or mark the location on the map.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const submitData = new FormData();
      submitData.append('address', formData.address);
      if (formData.latitude) submitData.append('latitude', formData.latitude);
      if (formData.longitude) submitData.append('longitude', formData.longitude);
      if (formData.image) {
        submitData.append('image', formData.image);
      }
      if (reRaiseSourceComplaint?._id) {
        submitData.append('reRaisedFrom', reRaiseSourceComplaint._id);
      }
      if (reRaiseSourceComplaint?.category) {
        submitData.append('category', reRaiseSourceComplaint.category);
      }

      await axios.post(`${API_BASE_URL}/api/complaints`, submitData, config);
      setShowModal(false);
      setFormData({ address: '', latitude: null, longitude: null, image: null, isAddressManual: false });
      setReRaiseSourceComplaint(null);
      fetchComplaints(userInfo.token);
      setNotification({ message: 'Complaint raised successfully!', type: 'success' });
    } catch (error) {
      console.error('Error raising complaint:', error);
      const message =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        'Failed to raise complaint';
      setNotification({ message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (feedbackRating === 0) {
      setNotification({ message: 'Please provide a star rating.', type: 'error' });
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      await axios.post(
        `${API_BASE_URL}/api/complaints/${selectedComplaintForFeedback._id}/feedback`,
        { rating: feedbackRating, comment: feedbackComment },
        config
      );

      setShowFeedbackModal(false);
      setNotification({ message: 'Thank you for your feedback!', type: 'success' });
      fetchComplaints(userInfo.token);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setNotification({ message: 'Failed to submit feedback', type: 'error' });
    }
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleAddressClick = (complaint) => {
    setSelectedComplaintForMap(complaint);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openComplaintDetail = (complaint) => {
    setSelectedComplaintForDetail(complaint);
    setShowComplaintDetailModal(true);
  };

  const closeComplaintDetail = () => {
    setShowComplaintDetailModal(false);
    setSelectedComplaintForDetail(null);
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return address;
  };

  const renderHome = () => (
    <>
      {/* Hero Section */}
      <div style={styles.heroSection}>
        <div style={styles.heroContent}>
          <h1 style={styles.welcomeText}>{t('welcome')}, {userInfo.name.split(' ')[0]}!</h1>
          <p style={styles.subWelcome}>{t('report_issue')}</p>

          <div className="hover-lift" style={styles.complaintCard}>
            <h3 style={styles.cardTitle}>{t('report_issue')}</h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9375rem', lineHeight: '1.6' }}>
              {t('dashboard_upload_desc')}
            </p>
            <button className="hover-scale" style={styles.raiseButton} onClick={() => {
              setReRaiseSourceComplaint(null);
              setShowModal(true);
            }}>{t('raise_complaint')}</button>
          </div>
        </div>
        <div style={styles.heroImageContainer}>
          <img
            src={HERO_ILLUSTRATION}
            alt="Road issue illustration"
            style={styles.heroImage}
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.dataset.fallbackApplied === 'true') return;
              e.currentTarget.dataset.fallbackApplied = 'true';
              e.currentTarget.src = HERO_ILLUSTRATION;
            }}
          />
        </div>
      </div>

      {/* Dashboard Grid */}
      <div style={styles.dashboardGrid}>
        {/* My Complaints Summary */}
        <div className="hover-lift" style={styles.infoCard}>
          <div style={styles.cardHeader}>
            <h3 style={styles.infoCardTitle}>{t('my_complaints')}</h3>
            <button style={styles.viewAllButton} onClick={() => setActiveTab('My Complaints')}>{t('view_all')}</button>
          </div>
          <p style={styles.activeCount}>{t('dashboard_active_complaints')}: <strong>{totalActive.toString().padStart(2, '0')}</strong></p>
          <div style={styles.statusList}>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}><span style={{ ...styles.dot, backgroundColor: '#ff9800' }}></span> {t('dashboard_status_pending')}</span>
              <span style={styles.statusCount}>{pendingCount}</span>
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}><span style={{ ...styles.dot, backgroundColor: '#2196f3' }}></span> {t('dashboard_status_inprogress')}</span>
              <span style={styles.statusCount}>{inProgressCount}</span>
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}><span style={{ ...styles.dot, backgroundColor: '#4caf50' }}></span> {t('dashboard_status_resolved')}</span>
              <span style={styles.statusCount}>{resolvedCount}</span>
            </div>
          </div>
        </div>

        {/* Complaint Status Chart */}
        <div className="hover-lift" style={styles.infoCard}>
          <h3 style={styles.infoCardTitle}>{t('dashboard_resolution_rate')}</h3>
          <div style={styles.chartContainer}>
            <div style={styles.donutWrapper}>
              <svg width="120" height="120" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="white" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.05))' }} />
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f0f4f8" strokeWidth="8" strokeLinecap="round" />
                {pendingDash > 0 && (
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#ff9800" strokeWidth="8" strokeDasharray={`${pendingDash} ${circumference}`} strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                )}
                {inProgressDash > 0 && (
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#2196f3" strokeWidth="8" strokeDasharray={`${inProgressDash} ${circumference}`} strokeDashoffset={-pendingDash} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                )}
                {resolvedDash > 0 && (
                  <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#4caf50" strokeWidth="8" strokeDasharray={`${resolvedDash} ${circumference}`} strokeDashoffset={-(pendingDash + inProgressDash)} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                )}
              </svg>
              <div style={styles.donutCenterText}>
                <span style={styles.percentageValue}>{progressPercentage}%</span>
                <span style={styles.percentageSubtext}>{t('dashboard_handled')}</span>
              </div>
            </div>
            <div style={styles.chartLegend}>
              <p style={styles.legendTitle}>{t('dashboard_analysis')}</p>
              <div style={styles.legendGrid}>
                <div style={styles.legendItem}><span style={{ ...styles.statusDot, backgroundColor: '#ff9800' }}></span><div style={styles.legendText}><span style={styles.legendLabel}>{t('dashboard_status_pending')}</span><span style={styles.legendCount}>{pendingCount}</span></div></div>
                <div style={styles.legendItem}><span style={{ ...styles.statusDot, backgroundColor: '#2196f3' }}></span><div style={styles.legendText}><span style={styles.legendLabel}>{t('dashboard_active_complaints')}</span><span style={styles.legendCount}>{inProgressCount}</span></div></div>
                <div style={styles.legendItem}><span style={{ ...styles.statusDot, backgroundColor: '#4caf50' }}></span><div style={styles.legendText}><span style={styles.legendLabel}>{t('dashboard_status_resolved')}</span><span style={styles.legendCount}>{resolvedCount}</span></div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Nearby Issues */}
        <div className="hover-lift" style={styles.infoCard}>
          <h3 style={styles.infoCardTitle}>{t('dashboard_nearby_issues')}</h3>
          <ul style={styles.issueList}>
            {publicComplaints.length > 0 ? (
              publicComplaints.slice(0, 3).map((issue, index) => (
                <li key={index} style={styles.issueItem}>
                  <span style={styles.orangeDot}>•</span> {issue.category} at {issue.address.split(',')[0]}
                </li>
              ))
            ) : (
              <li style={styles.issueItem}>{t('dashboard_no_nearby')}</li>
            )}
          </ul>
          <button className="hover-scale" style={styles.reportButton} onClick={() => {
            setReRaiseSourceComplaint(null);
            setShowModal(true);
          }}>{t('dashboard_report_issue_btn')}</button>
        </div>
      </div>
    </>
  );

  const renderMyComplaints = () => (
    <div style={styles.tabSection}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>{t('my_complaints')}</h2>
        <button style={styles.primaryButton} onClick={() => {
          setReRaiseSourceComplaint(null);
          setShowModal(true);
        }}>+ {t('raise_complaint')}</button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <MapView
          complaints={complaints}
          selectedComplaint={selectedComplaintForMap}
          height="300px"
        />
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
          📍 Click on any address below to see it on the map.
        </p>
      </div>

      <div style={styles.complaintsList}>
        {complaints.length > 0 ? (
          complaints
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((c) => (
              <div
                key={c._id}
                id={`complaint-${c._id}`}
                style={{
                  ...styles.complaintListItem,
                  animation: highlightedComplaintId === c._id ? 'blink 1.5s infinite' : 'none',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={() => openComplaintDetail(c)}
              >
                <div style={styles.complaintMain}>
                  <div style={styles.complaintHeader}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: '#1e293b',
                        backgroundColor: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}>{c.complaintId}</span>
                      <span style={styles.categoryTag}>{c.category}</span>
                      <span style={{
                        ...styles.statusTag,
                        backgroundColor: c.priority === 'High' ? '#fee2e2' : c.priority === 'Medium' ? '#fef9c3' : '#f0fdf4',
                        color: c.priority === 'High' ? '#dc2626' : c.priority === 'Medium' ? '#a16207' : '#16a34a',
                        fontWeight: 'bold'
                      }}>{c.priority || 'Medium'}</span>
                      <span style={{
                        ...styles.statusTag,
                        backgroundColor: c.status === 'Pending' ? '#fff7ed' : c.status === 'In Progress' ? '#eff6ff' : '#f0fdf4',
                        color: c.status === 'Pending' ? '#f97316' : c.status === 'In Progress' ? '#3b82f6' : '#10b981'
                      }}>{c.status}</span>
                      {c.reRaisedFrom && (
                        <span style={{
                          ...styles.statusTag,
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          border: '1px solid #d8b4fe'
                        }}>Reraised</span>
                      )}
                    </div>
                    <span style={styles.complaintMeta}>📅 {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div
                    style={{
                      ...styles.complaintFooter,
                      cursor: 'pointer',
                      color: '#2563eb',
                      textDecoration: 'underline'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddressClick(c);
                    }}
                  >
                    <span style={styles.complaintMeta}>📍 {formatAddress(c.address)}</span>
                  </div>
                  {c.status === 'Resolved' && !c.feedback?.rating && (
                    <button
                      style={{
                        marginTop: '1rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedComplaintForFeedback(c);
                        setShowFeedbackModal(true);
                        setFeedbackRating(0);
                        setFeedbackComment('');
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                    >
                      <span>⭐</span> {t('dashboard_give_feedback')}
                    </button>
                  )}
                  {c.feedback?.rating && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '0.75rem',
                      border: '1px solid #f1f5f9'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[...Array(5)].map((_, i) => (
                            <span key={i} style={{
                              color: i < c.feedback.rating ? '#fbbf24' : '#e2e8f0',
                              fontSize: '0.875rem'
                            }}>★</span>
                          ))}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>
                          {t('submitted')} {new Date(c.feedback.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {c.feedback.comment && (
                        <p style={{
                          fontSize: '0.8125rem',
                          color: '#64748b',
                          margin: 0,
                          fontStyle: 'italic'
                        }}>"{c.feedback.comment}"</p>
                      )}
                    </div>
                  )}
                  {c.status === 'Resolved' && (
                    <button
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#fff7ed',
                        color: '#f97316',
                        border: '1px solid #fed7aa',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setReRaiseSourceComplaint(c);
                        setFormData({
                          address: c.address || '',
                          latitude: c.location?.latitude ?? null,
                          longitude: c.location?.longitude ?? null,
                          image: null,
                          isAddressManual: false,
                        });
                        setShowModal(true);
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#ffedd5')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#fff7ed')}
                    >
                      ↻ {t('re_raise')}
                    </button>
                  )}
                </div>
                <div style={styles.complaintImages}>
                  {c.image && (
                    <div style={styles.imageContainer}>
                      <span style={styles.imageLabel}>{t('reported_issue')}</span>
                      <img
                        src={`${API_BASE_URL}${c.image}`}
                        alt="Evidence"
                        style={{ ...styles.complaintThumb, cursor: 'zoom-in' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageUrl(`${API_BASE_URL}${c.image}`);
                          setShowImagePreview(true);
                        }}
                      />
                    </div>
                  )}
                  {c.resolvedImage && (
                    <div style={styles.imageContainer}>
                      <span style={styles.imageLabel}>{t('resolved_evidence')}</span>
                      <img
                        src={`${API_BASE_URL}${c.resolvedImage}`}
                        alt="Resolved Evidence"
                        style={{ ...styles.complaintThumb, borderColor: '#10b981', cursor: 'zoom-in' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageUrl(`${API_BASE_URL}${c.resolvedImage}`);
                          setShowImagePreview(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
        ) : (
          <div style={styles.emptyState}>
            <p>{t('no_complaints_yet')}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div style={styles.tabSection}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>{t('real_time_alerts')}</h2>
        {realTimeNotifications.length > 0 && (
          <button
            onClick={() => setRealTimeNotifications([])}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              color: '#64748b',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {t('clear_all')}
          </button>
        )}
      </div>

      <div style={styles.notificationsList}>
        {realTimeNotifications.length > 0 ? (
          realTimeNotifications.map((notif, index) => (
            <div
              key={index}
              style={{
                ...styles.notificationItem,
                borderLeft: `4px solid ${notif.status === 'Resolved' ? '#10b981' : '#2563eb'}`,
                cursor: 'pointer'
              }}
              onClick={() => {
                setActiveTab('My Complaints');
                setHighlightedComplaintId(notif.complaintId);
                setTimeout(() => {
                  const element = document.getElementById(`complaint-${notif.complaintId}`);
                  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
            >
              <div style={{
                ...styles.notifIcon,
                backgroundColor: notif.status === 'Resolved' ? '#f0fdf4' : '#eff6ff',
                color: notif.status === 'Resolved' ? '#10b981' : '#2563eb'
              }}>
                {notif.status === 'Resolved' ? '✅' : '🏗️'}
              </div>
              <div style={styles.notifContent}>
                <div style={styles.notifHeader}>
                  <p style={{ ...styles.notifText, fontWeight: '700' }}>{notif.title}</p>
                  <span style={styles.notifTime}>
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={styles.notifText}>{notif.message}</p>
              </div>
            </div>
          ))
        ) : (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
            <p>{t('dashboard_no_notifications')}</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {t('dashboard_notification_hint')}
            </p>
          </div>
        )}

        {/* Historic status changes */}
        {complaints.filter(c => c.status !== 'Pending').length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('history')}</h3>
            {complaints
              .filter(c => c.status !== 'Pending')
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .map((c) => (
                <div
                  key={c._id}
                  style={{ ...styles.notificationItem, cursor: 'pointer', marginBottom: '0.75rem', opacity: 0.7 }}
                  onClick={() => handleNotificationClick(c._id)}
                >
                  <div style={{
                    ...styles.notifIcon,
                    backgroundColor: c.status === 'Resolved' ? '#f0fdf4' : '#fff9db',
                    color: c.status === 'Resolved' ? '#10b981' : '#fcc419',
                  }}>
                    {c.status === 'Resolved' ? '✅' : '🛠️'}
                  </div>
                  <div style={styles.notifContent}>
                    <div style={styles.notifHeader}>
                      <p style={styles.notifText}>
                        Your complaint <strong>{c.complaintId}</strong> status was updated to <strong>{c.status}</strong>.
                      </p>
                      <span style={styles.notifTime}>{new Date(c.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div style={styles.tabSection}>
      <h2 style={styles.sectionTitle}>{t('profile')}</h2>
      <div style={styles.profileCard}>
        <div style={styles.profileHeader}>
          <div style={styles.profileAvatarLarge}>
            {(isEditingProfile ? (profileForm.name || 'U') : userInfo.name).charAt(0)}
          </div>
          <div style={styles.profileInfo}>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                style={styles.profileInput}
              />
            ) : (
              <h3 style={styles.profileName}>{userInfo.name}</h3>
            )}
            <span style={styles.profileRole}>{t('verified_citizen')}</span>
          </div>
        </div>
        <div style={styles.profileDetails}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{t('citizen_id')}</span>
            <span style={styles.detailValue}>{userInfo.citizenId}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{t('aadhar_number')}</span>
            <span style={styles.detailValue}>xxxx-xxxx-{userInfo.adharNumber.slice(-4)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{t('mobile_number')}</span>
            {isEditingProfile ? (
              <div style={styles.mobileEditRow}>
                <span style={styles.mobilePrefix}>+91</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={profileForm.mobileNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setProfileForm(prev => ({ ...prev, mobileNumber: digits }));
                  }}
                  maxLength={10}
                  style={styles.mobileInput}
                />
              </div>
            ) : (
              <span style={styles.detailValue}>+91 {userInfo.mobileNumber}</span>
            )}
          </div>
        </div>
        <div style={styles.profileActionsRow}>
          {isEditingProfile ? (
            <>
              <button
                style={{ ...styles.saveProfileButton, opacity: profileSaving ? 0.7 : 1, cursor: profileSaving ? 'not-allowed' : 'pointer' }}
                onClick={handleSaveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? 'Saving...' : t('save_changes')}
              </button>
              <button style={styles.cancelProfileButton} onClick={handleCancelEditProfile} disabled={profileSaving}>
                {t('cancel')}
              </button>
            </>
          ) : (
            <button style={styles.editProfileButton} onClick={handleStartEditProfile}>
              {t('edit_profile')}
            </button>
          )}
        </div>
        <button style={styles.logoutButtonFull} onClick={handleLogout}>{t('logout')}</button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'Home': return renderHome();
      case 'My Complaints': return renderMyComplaints();
      case 'Notifications': return renderNotifications();
      case 'Profile': return renderProfile();
      default: return renderHome();
    }
  };

  if (!userInfo) {
    return <div style={styles.loading}>Loading dashboard...</div>;
  }

  const pendingCount = complaints.filter(c => c.status === 'Pending').length;
  const inProgressCount = complaints.filter(c => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'Resolved').length;
  const totalCount = complaints.length;
  const totalActive = pendingCount + inProgressCount;

  const newNotificationsCount = complaints.filter(c =>
    c.status !== 'Pending' && new Date(c.updatedAt) > lastViewedNotifications
  ).length;

  const progressPercentage = totalCount > 0 ? Math.round(((inProgressCount + resolvedCount) / totalCount) * 100) : 0;

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const pendingDash = totalCount > 0 ? (pendingCount / totalCount) * circumference : 0;
  const inProgressDash = totalCount > 0 ? (inProgressCount / totalCount) * circumference : 0;
  const resolvedDash = totalCount > 0 ? (resolvedCount / totalCount) * circumference : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={styles.dashboardContainer}
    >
      <style>
        {`
          @keyframes blink {
            0% { background-color: white; border-color: #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            50% { background-color: #f0fdf4; border-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
            100% { background-color: white; border-color: #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          }
          .hover-scale { transition: transform 0.2s; }
          .hover-scale:hover { transform: scale(1.02); }
          .hover-lift { transition: all 0.2s; }
          .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        `}
      </style>
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              ...styles.toast,
              backgroundColor: notification.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>
              {notification.type === 'success' ? '✅' : '❌'}
            </span>
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navLeft}>
          <div style={styles.logoContainer}>
            <span role="img" aria-label="logo" style={styles.logoIcon}>🌍</span>
            <span style={styles.logoText}>{t('citizen_dashboard')}</span>
          </div>
        </div>
        <div style={styles.navCenter}>
          {['Home', 'My Complaints', 'Notifications', 'Profile'].map((tab) => {
            const tabKey = tab.toLowerCase().replace(' ', '_');
            return (
              <span
                key={tab}
                style={{
                  ...styles.navItem,
                  ...(activeTab === tab ? styles.navItemActive : {}),
                  position: 'relative',
                }}
                onClick={() => setActiveTab(tab)}
              >
                {t(tabKey)}
                {tab === 'Notifications' && newNotificationsCount > 0 && (
                  <span style={styles.badge}>
                    {newNotificationsCount}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        <div style={{ ...styles.navRight, gap: '1rem' }}>
          <LanguageSelector style={{ backgroundColor: '#f8fafc', zIndex: 100 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={`https://ui-avatars.com/api/?name=${userInfo.name}&background=2563eb&color=fff`} alt="Profile" style={styles.profilePic} />
            <span style={styles.userGreeting}>{t('welcome')}, {userInfo.name.split(' ')[0]}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutSmall}>{t('logout')}</button>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={styles.mainScrollArea}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {/* Complaint Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.modalOverlay}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={styles.modalContent}
            >
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setFormData({ address: '', latitude: null, longitude: null, image: null, isAddressManual: false });
                  setReRaiseSourceComplaint(null);
                }}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s',
                  zIndex: 10
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                ✕
              </button>
              <h3 style={styles.modalTitle}>{reRaiseSourceComplaint ? 'Re-raise Issue' : t('raise_complaint')}</h3>
              <form onSubmit={handleSubmitComplaint}>
                <div style={styles.formGroup}>
                  <label style={styles.modalLabel}>
                    {t('address')} {formData.latitude ? '(Optional if marked on map)' : ''}
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      position: 'absolute',
                      left: '1rem',
                      color: '#94a3b8',
                      zIndex: 2,
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}>
                      🔍
                    </div>
                    <input
                      type="text"
                      name="address"
                      style={{
                        ...styles.modalInput,
                        paddingLeft: '2.75rem',
                        paddingRight: formData.address ? '2.5rem' : '1rem',
                        backgroundColor: '#f8fafc',
                        transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0',
                        boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.03)'
                      }}
                      value={formData.address}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                        e.target.style.backgroundColor = '#ffffff';
                        if (formData.address.length >= 3) {
                          setExternalSearchQuery(formData.address);
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0,0,0,0.03)';
                        e.target.style.backgroundColor = '#f8fafc';
                        // Delay clearing suggestions to allow onMouseDown to trigger first
                        setTimeout(() => setExternalSearchQuery(''), 200);
                      }}
                      autoComplete="off"
                      placeholder={t('address_search_placeholder') || "Search for a location..."}
                      required={!formData.latitude}
                    />

                    {formData.address && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            address: '',
                            latitude: null,
                            longitude: null,
                            isAddressManual: true
                          }));
                        }}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          fontSize: '1rem',
                          borderRadius: '50%'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        ✕
                      </button>
                    )}

                    <MapPicker
                      onLocationSelect={(lat, lng, addr) => {
                        setFormData(prev => ({
                          ...prev,
                          latitude: lat,
                          longitude: lng,
                          address: addr === null ? 'Fetching address...' : (addr || prev.address),
                          isAddressManual: false
                        }));
                      }}
                      initialLocation={formData.latitude ? { latitude: formData.latitude, longitude: formData.longitude } : null}
                      externalSearchQuery={externalSearchQuery}
                    />
                  </div>
                </div>

                <div style={styles.modalBody}>
                  {/* Left Column: Location */}
                  <div>
                    <div style={styles.formGroup}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <label style={{ ...styles.modalLabel, marginBottom: 0 }}>{t('mark_location')}</label>
                        {formData.latitude && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => {
                                const updatedData = { ...prev, latitude: null, longitude: null };
                                if (!prev.isAddressManual) {
                                  updatedData.address = '';
                                }
                                return updatedData;
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontWeight: '600'
                            }}
                          >
                            {t('clear_marker')}
                          </button>
                        )}
                      </div>

                      {/* Map only container */}
                      <div
                        id="map-only-container"
                        style={{
                          height: '280px',
                          borderRadius: '1.25rem',
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                        }}
                      >
                        {/* The actual map will be rendered here by MapPicker */}
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1.25rem' }}>
                        <button
                          type="button"
                          onClick={getCurrentLocation}
                          disabled={isGettingLocation}
                          style={{
                            ...styles.cancelButton,
                            backgroundColor: formData.latitude ? '#f0fdf4' : '#f1f5f9',
                            borderColor: formData.latitude ? '#10b981' : '#e2e8f0',
                            color: formData.latitude ? '#10b981' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            padding: '0.75rem 1.5rem',
                            fontSize: '0.875rem',
                            width: 'auto',
                            minWidth: '200px',
                            justifyContent: 'center',
                            borderRadius: '1rem'
                          }}
                        >
                          {isGettingLocation ? '🛰️ Getting Location...' : formData.latitude ? '✅ Location Captured' : `📍 ${t('use_gps')}`}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Details & Photo */}
                  <div>
                    <div style={styles.formGroup}>
                      <label style={{ ...styles.modalLabel, marginBottom: '0.75rem' }}>{t('upload_photo')}</label>
                      <div
                        className="file-upload-hover"
                        style={{
                          ...styles.fileUploadContainer,
                          padding: '1.5rem',
                          height: '280px',
                          justifyContent: 'center'
                        }}
                        onClick={() => document.getElementById('file-input').click()}
                      >
                        <input
                          id="file-input"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        <div style={{ ...styles.uploadIcon, fontSize: '2.5rem', marginBottom: '0.5rem' }}>📷</div>
                        <div style={{ ...styles.fileInfo, fontSize: '0.9375rem', fontWeight: '600' }}>
                          {formData.image ? (
                            <span style={styles.fileName}>{formData.image.name}</span>
                          ) : (
                            t('click_to_select')
                          )}
                        </div>
                        <p style={{ ...styles.fileHint, fontSize: '0.8125rem', marginTop: '0.25rem' }}>JPG, PNG up to 5MB</p>
                      </div>
                    </div>

                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button type="button" style={styles.cancelButton} onClick={() => {
                    setShowModal(false);
                    setFormData({ address: '', latitude: null, longitude: null, image: null, isAddressManual: false });
                    setReRaiseSourceComplaint(null);
                  }}>{t('cancel')}</button>
                  <button
                    type="submit"
                    style={{
                      ...styles.submitButton,
                      opacity: (submitting || isCompressing) ? 0.7 : 1,
                      cursor: (submitting || isCompressing) ? 'not-allowed' : 'pointer'
                    }}
                    disabled={submitting || isCompressing}
                  >
                    {submitting ? 'Submitting...' : isCompressing ? 'Compressing Image...' : t('submit')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComplaintDetailModal && selectedComplaintForDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.modalOverlay}
            onClick={closeComplaintDetail}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={styles.detailModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeComplaintDetail}
                style={styles.detailCloseBtn}
              >
                ✕
              </button>

              <div style={styles.detailHeader}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.detailId}>{selectedComplaintForDetail.complaintId}</div>
                  <div style={styles.detailBadges}>
                    <span style={styles.categoryTag}>{selectedComplaintForDetail.category}</span>
                    <span
                      style={{
                        ...styles.statusTag,
                        backgroundColor:
                          selectedComplaintForDetail.priority === 'High'
                            ? '#fee2e2'
                            : selectedComplaintForDetail.priority === 'Medium'
                              ? '#fef9c3'
                              : '#f0fdf4',
                        color:
                          selectedComplaintForDetail.priority === 'High'
                            ? '#dc2626'
                            : selectedComplaintForDetail.priority === 'Medium'
                              ? '#a16207'
                              : '#16a34a',
                        fontWeight: '800',
                      }}
                    >
                      {selectedComplaintForDetail.priority || 'Medium'}
                    </span>
                    <span
                      style={{
                        ...styles.statusTag,
                        backgroundColor:
                          selectedComplaintForDetail.status === 'Pending'
                            ? '#fff7ed'
                            : selectedComplaintForDetail.status === 'In Progress'
                              ? '#eff6ff'
                              : '#f0fdf4',
                        color:
                          selectedComplaintForDetail.status === 'Pending'
                            ? '#f97316'
                            : selectedComplaintForDetail.status === 'In Progress'
                              ? '#3b82f6'
                              : '#10b981',
                      }}
                    >
                      {selectedComplaintForDetail.status}
                    </span>
                    {selectedComplaintForDetail.reRaisedFrom && (
                      <span
                        style={{
                          ...styles.statusTag,
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          border: '1px solid #d8b4fe'
                        }}
                      >
                        Reraised
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  style={styles.detailMapButton}
                  onClick={() => {
                    setActiveTab('My Complaints');
                    handleAddressClick(selectedComplaintForDetail);
                    closeComplaintDetail();
                  }}
                >
                  📍 View on Map
                </button>
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailColumn}>
                  <div style={styles.detailSection}>
                    <div style={styles.detailSectionTitle}>Address</div>
                    <div style={styles.detailText}>{formatAddress(selectedComplaintForDetail.address)}</div>
                  </div>

                  <div style={styles.detailTwoCol}>
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Created</div>
                      <div style={styles.detailText}>
                        {new Date(selectedComplaintForDetail.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Last Updated</div>
                      <div style={styles.detailText}>
                        {new Date(selectedComplaintForDetail.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={styles.detailTwoCol}>
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Coordinates</div>
                      <div style={styles.detailText}>
                        {selectedComplaintForDetail.location?.latitude != null &&
                          selectedComplaintForDetail.location?.longitude != null
                          ? `${selectedComplaintForDetail.location.latitude}, ${selectedComplaintForDetail.location.longitude}`
                          : 'N/A'}
                      </div>
                    </div>
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Language</div>
                      <div style={styles.detailText}>{selectedComplaintForDetail.detectedLanguage || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={styles.detailTwoCol}>
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Verified</div>
                      <div style={styles.detailText}>
                        {selectedComplaintForDetail.isVerified ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Authentic</div>
                      <div style={styles.detailText}>
                        {selectedComplaintForDetail.isAuthentic ? 'Yes' : 'No'}
                        {typeof selectedComplaintForDetail.authenticityScore === 'number'
                          ? ` (${selectedComplaintForDetail.authenticityScore.toFixed(2)})`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {selectedComplaintForDetail.isDuplicateOf && (
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Duplicate Of</div>
                      <div style={styles.detailText}>{String(selectedComplaintForDetail.isDuplicateOf)}</div>
                    </div>
                  )}



                  {selectedComplaintForDetail.status === 'Resolved' && !selectedComplaintForDetail.feedback?.rating && (
                    <button
                      type="button"
                      style={styles.detailFeedbackButton}
                      onClick={() => {
                        setSelectedComplaintForFeedback(selectedComplaintForDetail);
                        setShowFeedbackModal(true);
                        setFeedbackRating(0);
                        setFeedbackComment('');
                        closeComplaintDetail();
                      }}
                    >
                      ⭐ Give Feedback
                    </button>
                  )}

                  {selectedComplaintForDetail.feedback?.rating && (
                    <div style={styles.detailSection}>
                      <div style={styles.detailSectionTitle}>Feedback</div>
                      <div style={styles.detailText}>
                        {selectedComplaintForDetail.feedback.rating} / 5
                        {selectedComplaintForDetail.feedback.submittedAt
                          ? ` • ${new Date(selectedComplaintForDetail.feedback.submittedAt).toLocaleDateString()}`
                          : ''}
                      </div>
                      {selectedComplaintForDetail.feedback.comment && (
                        <div style={{ ...styles.detailText, marginTop: '0.5rem', fontStyle: 'italic' }}>
                          "{selectedComplaintForDetail.feedback.comment}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={styles.detailColumn}>
                  <div style={styles.detailSection}>
                    <div style={styles.detailSectionTitle}>Images</div>
                    <div style={styles.detailImagesGrid}>
                      {selectedComplaintForDetail.image ? (
                        <div style={styles.detailImageCard}>
                          <div style={styles.detailImageLabel}>Reported</div>
                          <img
                            src={`${API_BASE_URL}${selectedComplaintForDetail.image}`}
                            alt="Reported Issue"
                            style={styles.detailImage}
                            onClick={() => {
                              setPreviewImageUrl(`${API_BASE_URL}${selectedComplaintForDetail.image}`);
                              setShowImagePreview(true);
                            }}
                          />
                        </div>
                      ) : (
                        <div style={styles.detailEmptyImage}>No reported image</div>
                      )}

                      {selectedComplaintForDetail.resolvedImage ? (
                        <div style={styles.detailImageCard}>
                          <div style={styles.detailImageLabel}>Resolved</div>
                          <img
                            src={`${API_BASE_URL}${selectedComplaintForDetail.resolvedImage}`}
                            alt="Resolved Evidence"
                            style={{ ...styles.detailImage, borderColor: '#10b981' }}
                            onClick={() => {
                              setPreviewImageUrl(`${API_BASE_URL}${selectedComplaintForDetail.resolvedImage}`);
                              setShowImagePreview(true);
                            }}
                          />
                        </div>
                      ) : (
                        <div style={styles.detailEmptyImage}>No resolution image</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.imagePreviewOverlay}
            onClick={() => setShowImagePreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={styles.imagePreviewContent}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowImagePreview(false)}
                style={styles.closePreviewBtn}
              >
                ✕
              </button>
              <img
                src={previewImageUrl}
                alt="Full Resolution"
                style={styles.fullImage}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.modalOverlay}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ ...styles.modalContent, maxWidth: '450px' }}
            >
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: '1.25rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                ✕
              </button>
              <h3 style={styles.modalTitle}>Rate Resolution</h3>
              <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9375rem' }}>
                How satisfied are you with the resolution of complaint #{selectedComplaintForFeedback?.complaintId}?
              </p>

              <form onSubmit={handleFeedbackSubmit}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '2.5rem',
                        cursor: 'pointer',
                        color: star <= feedbackRating ? '#fbbf24' : '#e2e8f0',
                        transition: 'transform 0.1s ease',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.modalLabel}>Comments (Optional)</label>
                  <textarea
                    style={{ ...styles.textarea, minHeight: '100px' }}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Share your experience..."
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.cancelButton}
                    onClick={() => setShowFeedbackModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      ...styles.primaryButton,
                      backgroundColor: feedbackRating > 0 ? '#2563eb' : '#cbd5e1',
                      cursor: feedbackRating > 0 ? 'pointer' : 'not-allowed'
                    }}
                    disabled={feedbackRating === 0}
                  >
                    Submit Feedback
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Chatbot />
    </motion.div>
  );
};

const styles = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '20px',
    color: '#64748b',
    backgroundColor: '#f8fafc',
  },
  dashboardContainer: {
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#1e293b',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 2.5rem',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoIcon: {
    fontSize: '1.5rem',
  },
  mainScrollArea: {
    flex: 1,
    padding: '0',
    overflowY: 'auto',
    maxWidth: '1600px',
    margin: '0 auto',
    width: '100%',
  },
  tabSection: {
    padding: '2rem 5rem',
    animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.025em',
  },
  primaryButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  },
  complaintsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  complaintListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '1.25rem',
    border: '1px solid #f1f5f9',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  complaintMain: {
    flex: 1,
  },
  complaintHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  categoryTag: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    borderRadius: '2rem',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  statusTag: {
    padding: '0.25rem 0.75rem',
    borderRadius: '2rem',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  complaintDesc: {
    fontSize: '1rem',
    color: '#475569',
    marginBottom: '1rem',
    lineHeight: '1.5',
  },
  complaintFooter: {
    display: 'flex',
    gap: '1.5rem',
  },
  complaintMeta: {
    fontSize: '0.8125rem',
    color: '#64748b',
    fontWeight: '500',
  },
  complaintThumb: {
    width: '100px',
    height: '100px',
    borderRadius: '0.75rem',
    objectFit: 'cover',
    border: '1px solid #e2e8f0',
  },
  complaintImages: {
    display: 'flex',
    gap: '1rem',
    marginLeft: '1.5rem',
  },
  imageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  imageLabel: {
    fontSize: '0.625rem',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
  },
  emptyState: {
    padding: '4rem',
    textAlign: 'center',
    backgroundColor: 'white',
    borderRadius: '1.25rem',
    color: '#64748b',
    border: '1px dashed #e2e8f0',
  },
  notificationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: 'white',
    padding: '1.25rem',
    borderRadius: '1rem',
    border: '1px solid #f1f5f9',
  },
  notifIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  notifText: {
    fontSize: '0.9375rem',
    color: '#1e293b',
    margin: 0,
    flex: 1,
  },
  notifTime: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  imagePreviewOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000,
    padding: '2rem',
    cursor: 'zoom-out',
  },
  imagePreviewContent: {
    position: 'relative',
    maxWidth: '90%',
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  fullImage: {
    maxWidth: '100%',
    maxHeight: '80vh',
    borderRadius: '1rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    objectFit: 'contain',
  },
  closePreviewBtn: {
    position: 'absolute',
    top: '-3rem',
    right: '-3rem',
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '2rem',
    cursor: 'pointer',
    padding: '1rem',
  },
  profileCard: {
    backgroundColor: 'white',
    padding: '2.5rem',
    borderRadius: '1.5rem',
    border: '1px solid #f1f5f9',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
    maxWidth: '600px',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '2.5rem',
  },
  profileAvatarLarge: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: '800',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  profileName: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#0f172a',
  },
  profileRole: {
    fontSize: '0.875rem',
    color: '#2563eb',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  profileDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    marginBottom: '2.5rem',
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid #f1f5f9',
  },
  detailLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailValue: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#1e293b',
  },
  profileInput: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#0f172a',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '100%',
    maxWidth: '320px',
    backgroundColor: '#ffffff',
  },
  mobileEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  mobilePrefix: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.75rem',
  },
  mobileInput: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#1e293b',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '180px',
    backgroundColor: '#ffffff',
  },
  profileActionsRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  editProfileButton: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  saveProfileButton: {
    flex: 1,
    padding: '1rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: '1px solid #1d4ed8',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cancelProfileButton: {
    padding: '1rem',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '140px',
  },
  logoutButtonFull: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fee2e2',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.025em',
    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  navCenter: {
    display: 'flex',
    gap: '2rem',
  },
  navItem: {
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    color: '#64748b',
    transition: 'all 0.2s ease',
    padding: '0.5rem 0',
    borderBottom: '2px solid transparent',
  },
  navItemActive: {
    color: '#2563eb',
    borderBottom: '2px solid #2563eb',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-12px',
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: '0.625rem',
    fontWeight: '800',
    padding: '2px 5px',
    borderRadius: '10px',
    minWidth: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #ffffff',
    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  profilePic: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid #f1f5f9',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  userGreeting: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#475569',
  },
  logoutSmall: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fee2e2',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    padding: '3rem 5rem',
    gap: '4rem',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
  },
  heroContent: {
    maxWidth: '600px',
  },
  welcomeText: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: '0.75rem',
    letterSpacing: '-0.025em',
    lineHeight: '1.2',
  },
  subWelcome: {
    color: '#64748b',
    fontSize: '1.125rem',
    marginBottom: '2.5rem',
    fontWeight: '500',
  },
  complaintCard: {
    backgroundColor: '#ffffff',
    padding: '2rem',
    borderRadius: '1.25rem',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
  },
  cardTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '1.5rem',
  },
  raiseButton: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  },
  heroImageContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 'auto',
    borderRadius: '1.5rem',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
    padding: '2.5rem 5rem',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: '1.25rem',
    padding: '1.75rem',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
  },
  infoCardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '1.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  activeCount: {
    fontSize: '0.875rem',
    color: '#64748b',
    marginBottom: '1.5rem',
  },
  statusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: '#f8fafc',
    borderRadius: '0.75rem',
  },
  statusLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#475569',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusCount: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  viewAllButton: {
    marginTop: 'auto',
    padding: '0.75rem',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  chartContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  donutWrapper: {
    position: 'relative',
    width: '120px',
    height: '120px',
  },
  donutCenterText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    lineHeight: '1.1',
  },
  percentageValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#0f172a',
  },
  percentageSubtext: {
    fontSize: '0.625rem',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    display: 'block',
  },
  chartLegend: {
    flex: 1,
  },
  legendTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748b',
    marginBottom: '1rem',
    textTransform: 'uppercase',
  },
  legendGrid: {
    display: 'grid',
    gap: '0.5rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  legendText: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    marginLeft: '0.5rem',
  },
  legendLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b',
  },
  legendCount: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#0f172a',
  },
  issueList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  issueItem: {
    fontSize: '0.875rem',
    color: '#475569',
    padding: '0.75rem 1rem',
    backgroundColor: '#f8fafc',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  orangeDot: { color: '#f97316', fontWeight: 'bold' },
  reportButton: {
    marginTop: '1.5rem',
    padding: '0.75rem',
    backgroundColor: '#f8fafc',
    color: '#2563eb',
    border: '1px solid #dbeafe',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  updateList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  updateItem: {
    fontSize: '0.875rem',
    color: '#475569',
    lineHeight: '1.5',
  },
  redDot: { color: '#ef4444', marginRight: '0.5rem' },
  tipsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  tipItem: {
    fontSize: '0.875rem',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  greenDot: { color: '#10b981' },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  formGroup: {
    marginBottom: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    width: '95%',
    maxWidth: '1100px',
    maxHeight: '95vh',
    overflowY: 'hidden',
    padding: '1.5rem 2.5rem',
    borderRadius: '2rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
  },
  detailModalContent: {
    backgroundColor: '#ffffff',
    width: '95%',
    maxWidth: '1100px',
    maxHeight: '95vh',
    overflowY: 'auto',
    padding: '1.5rem 2.5rem',
    borderRadius: '2rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    position: 'relative',
  },
  detailCloseBtn: {
    position: 'absolute',
    top: '1.25rem',
    right: '1.25rem',
    background: '#f1f5f9',
    border: 'none',
    fontSize: '1.25rem',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.5rem',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    zIndex: 10,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    paddingRight: '2.5rem',
    marginBottom: '1.25rem',
  },
  detailId: {
    fontSize: '1.5rem',
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: '-0.02em',
    marginBottom: '0.5rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  detailBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
  },
  detailMapButton: {
    padding: '0.75rem 1rem',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 1fr',
    gap: '1.25rem',
  },
  detailColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
  },
  detailSection: {
    padding: '1rem',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '1rem',
  },
  detailSectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.5rem',
  },
  detailText: {
    fontSize: '0.95rem',
    color: '#0f172a',
    fontWeight: '600',
    lineHeight: '1.6',
    wordBreak: 'break-word',
  },
  detailTwoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  detailChip: {
    padding: '0.6rem 0.75rem',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    fontSize: '0.9rem',
    color: '#1e293b',
    fontWeight: '600',
  },
  detailFeedbackButton: {
    padding: '0.9rem 1rem',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
    borderRadius: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: '800',
    cursor: 'pointer',
  },
  detailImagesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
  },
  detailImageCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '1rem',
    padding: '0.75rem',
  },
  detailImageLabel: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.5rem',
  },
  detailImage: {
    width: '100%',
    height: '260px',
    objectFit: 'cover',
    borderRadius: '0.9rem',
    border: '2px solid #dbeafe',
    cursor: 'zoom-in',
  },
  detailEmptyImage: {
    padding: '1rem',
    backgroundColor: '#ffffff',
    border: '1px dashed #cbd5e1',
    borderRadius: '1rem',
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBody: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '1.5rem',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
      gap: '1.5rem',
    },
  },
  modalTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: '1rem',
    letterSpacing: '-0.025em',
    textAlign: 'left',
  },
  modalLabel: {
    display: 'block',
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: '#334155',
    marginBottom: '0.5rem',
    marginLeft: '0.25rem',
  },
  modalInput: {
    width: '100%',
    padding: '1rem 1.25rem',
    borderRadius: '1rem',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#f8fafc',
    marginBottom: '0.5rem', // Reduced to make room for suggestions
    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    color: '#1e293b',
  },
  textarea: {
    width: '100%',
    padding: '1.25rem',
    borderRadius: '1rem',
    border: '1px solid #e2e8f0',
    fontSize: '1rem',
    minHeight: '160px',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#f8fafc',
    fontFamily: 'inherit',
    resize: 'none',
    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    color: '#1e293b',
    lineHeight: '1.6',
    marginBottom: '2rem',
  },
  fileUploadContainer: {
    border: '2px dashed #e2e8f0',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  uploadIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  fileInput: {
    display: 'none',
  },
  fileInfo: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#475569',
  },
  fileName: {
    color: '#2563eb',
  },
  fileHint: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: '0.25rem',
  },
  modalActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '1.25rem',
    marginTop: '1.5rem',
  },
  cancelButton: {
    padding: '1rem',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '1rem',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  submitButton: {
    padding: '1rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '1rem',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    padding: '12px 20px',
    color: 'white',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    zIndex: 3000,
    fontWeight: '600',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.1)',
    animation: 'toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  }
};

const styleSheet = document.createElement("style");
styleSheet.innerText = `
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
    @keyframes toastSlideIn {
      from { transform: translateX(100%) translateY(-20px); opacity: 0; }
      to { transform: translateX(0) translateY(0); opacity: 1; }
    }
    @keyframes modalScaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    input:focus, textarea:focus {
      border-color: #2563eb !important;
      background-color: #ffffff !important;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1), inset 0 2px 4px 0 rgba(0, 0, 0, 0.01) !important;
    }
    .file-upload-hover:hover {
      border-color: #2563eb !important;
      background-color: #f0f7ff !important;
    }
    button:hover {
      filter: brightness(0.95);
      transform: translateY(-1px);
    }
    button:active {
      transform: translateY(0);
    }
  `;
document.head.appendChild(styleSheet);

export default CitizenDashboard;
