import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import MapView from '../components/MapView';
import Chatbot from '../components/Chatbot';

const AdminDashboard = () => {
  const API_BASE_URL = 'http://localhost:5005';
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(() => {
    const saved = localStorage.getItem('userInfo');
    return saved ? JSON.parse(saved) : null;
  });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [notification, setNotification] = useState(null);
  const [selectedComplaintForMap, setSelectedComplaintForMap] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Complaints');
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (userInfo) {
      if (userInfo.userType !== 'admin') {
        navigate('/');
        return;
      }
      fetchComplaints(userInfo.token);
      fetchAnalytics(userInfo.token);
    } else {
      navigate('/login');
    }
  }, [navigate, userInfo]);

  const fetchAnalytics = async (token) => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/analytics`, config);
      setAnalytics(data);
      setAnalyticsLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsLoading(false);
    }
  };

  const fetchComplaints = async (token) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const { data } = await axios.get(`${API_BASE_URL}/api/complaints/admin/all`, config);
      setComplaints(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setLoading(false);
    }
  };



  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this complaint? This action cannot be undone.')) {
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.delete(`${API_BASE_URL}/api/complaints/${id}`, config);
      fetchComplaints(userInfo.token);
      setNotification({ message: 'Complaint deleted successfully!', type: 'success' });
    } catch (error) {
      console.error('Error deleting complaint:', error);
      setNotification({ message: 'Failed to delete complaint', type: 'error' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  const filteredComplaints = complaints
    .filter(c => {
      const statusMatch = filterStatus === 'All' || c.status === filterStatus;
      const categoryMatch = filterCategory === 'All' || c.category === filterCategory;
      const priorityMatch = filterPriority === 'All' || c.priority === filterPriority;

      let dateMatch = true;
      if (filterDate) {
        const complaintDate = new Date(c.createdAt).toISOString().split('T')[0];
        dateMatch = complaintDate === filterDate;
      }

      return statusMatch && categoryMatch && priorityMatch && dateMatch;
    })
    .sort((a, b) => {
      // Primary sort by date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const categories = ['All', 'Road', 'Electricity', 'Garbage', 'Sewage', ...new Set(complaints.filter(c => !['Road', 'Electricity', 'Garbage', 'Sewage'].includes(c.category)).map(c => c.category))];

  const categoryFilteredComplaints = filterCategory === 'All'
    ? complaints
    : complaints.filter(c => c.category === filterCategory);

  const stats = {
    total: categoryFilteredComplaints.length,
    pending: categoryFilteredComplaints.filter(c => c.status === 'Pending').length,
    inProgress: categoryFilteredComplaints.filter(c => c.status === 'In Progress').length,
    resolved: categoryFilteredComplaints.filter(c => c.status === 'Resolved').length,
  };

  const getCategoryStyles = (category) => {
    switch (category) {
      case 'Road': return { bg: '#eff6ff', text: '#2563eb' };
      case 'Electricity': return { bg: '#fef9c3', text: '#a16207' };
      case 'Garbage': return { bg: '#f0fdf4', text: '#16a34a' };
      case 'Sewage': return { bg: '#f5f3ff', text: '#7c3aed' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        Loading System Admin Dashboard...
      </div>
    );
  }

  const handleAddressClick = (complaint) => {
    setSelectedComplaintForMap(complaint);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return address;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={styles.container}
    >
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          .hover-scale { transition: transform 0.2s ease; }
          .hover-scale:hover { transform: scale(1.02); }
          .hover-lift { transition: all 0.2s ease; }
          .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        `}
      </style>
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
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
          <span style={styles.logoText}>CiviSmart Admin Portal</span>
          <div style={styles.navLinks}>
            <button
              className="hover-scale"
              style={styles.navLink}
              onClick={() => navigate('/admin-portal')}
            >
              Officer Management
            </button>
            <button style={styles.navLinkActive}>
              Complaints Management
            </button>
          </div>
        </div>
        <div style={styles.navRight}>
          <span style={styles.userGreeting}>
            System Admin: {userInfo.name}
          </span>
          <button onClick={handleLogout} style={styles.logoutBtn} className="hover-scale">Logout</button>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>System Intelligence Dashboard</h1>

          <div style={styles.tabsContainer}>
            {['Complaints', 'Analytics', 'Geospatial View'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="hover-scale"
                style={{
                  ...styles.tab,
                  ...(activeTab === tab ? styles.activeTab : {})
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'Analytics' && !analyticsLoading && analytics && (
              <div style={styles.analyticsGrid}>
                {/* Category Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="hover-lift"
                  style={styles.chartCard}
                >
                  <h3 style={styles.cardTitle}>Category Distribution</h3>
                  <div style={styles.chartContent}>
                    {analytics.categoryStats.map((stat, idx) => (
                      <motion.div
                        key={stat._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        style={styles.chartRow}
                      >
                        <div style={styles.chartLabel}>
                          <span>{stat._id}</span>
                          <span>{stat.count}</span>
                        </div>
                        <div style={styles.progressBarBg}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(stat.count / analytics.summary.total) * 100}%` }}
                            transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                            style={{
                              ...styles.progressBarFill,
                              backgroundColor: getCategoryStyles(stat._id).text
                            }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Efficiency Score */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="hover-lift"
                  style={styles.chartCard}
                >
                  <h3 style={styles.cardTitle}>Resolution Efficiency</h3>
                  <div style={styles.efficiencyContent}>
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 100, delay: 0.4 }}
                      style={styles.efficiencyValue}
                    >
                      {analytics.summary.total > 0
                        ? Math.round((analytics.summary.resolved / analytics.summary.total) * 100)
                        : 0}%
                    </motion.div>
                    <div style={styles.efficiencyLabel}>Overall Resolve Rate</div>
                    <div style={styles.efficiencySubtext}>
                      {analytics.summary.resolved} of {analytics.summary.total} issues addressed
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {activeTab === 'Geospatial View' && (
              <>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.subTitle}>Complaints Geospatial View</h2>
                  <div style={styles.liveIndicator}>
                    <span style={styles.pulseDot} />
                    Interactive Heatmap
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  style={{ marginBottom: '2rem' }}
                >
                  <MapView
                    complaints={complaints}
                    selectedComplaint={selectedComplaintForMap}
                    height="600px"
                  />
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
                    📍 Click on any address in the complaints repository to locate it on the map.
                  </p>
                </motion.div>
              </>
            )}

            {activeTab === 'Complaints' && (
              <>
                {!analyticsLoading && analytics && (
                  <div style={{ ...styles.summarySection, marginBottom: '2rem' }}>
                    {[
                      { label: 'Pending Issues', value: analytics.summary.pending, color: '#f97316' },
                      { label: 'Active (In Progress)', value: analytics.summary.inProgress, color: '#3b82f6' },
                      { label: 'Resolved Success', value: analytics.summary.resolved, color: '#10b981' },
                      { label: 'High Priority', value: analytics.summary.highPriority, color: '#dc2626' }
                    ].map((stat, idx) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="hover-lift"
                        style={{ ...styles.statCard, borderLeftColor: stat.color }}
                      >
                        <span style={styles.statLabel}>{stat.label}</span>
                        <span style={styles.statValue}>{stat.value}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div style={styles.sectionHeader}>
                  <h2 style={styles.subTitle}>Complaints Repository</h2>
                  <div style={styles.liveIndicator}>
                    <span style={styles.pulseDot} />
                    Live Data Stream
                  </div>
                </div>

                <div style={styles.filterBar}>
                  {/* Filter sections with hover effects */}
                  <div style={styles.filterGroup}>
                    <span style={styles.filterLabel}>Filter Status:</span>
                    <div style={styles.filterButtons}>
                      {['All', 'Pending', 'In Progress', 'Resolved'].map(status => (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(status)}
                          className="hover-scale"
                          style={{
                            ...styles.filterBtn,
                            backgroundColor: filterStatus === status ? '#1e293b' : '#ffffff',
                            color: filterStatus === status ? '#ffffff' : '#64748b',
                            borderColor: filterStatus === status ? '#1e293b' : '#e2e8f0'
                          }}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={styles.filterGroup}>
                    <span style={styles.filterLabel}>Priority:</span>
                    <div style={styles.filterButtons}>
                      {['All', 'High', 'Medium', 'Low'].map(prio => (
                        <button
                          key={prio}
                          onClick={() => setFilterPriority(prio)}
                          className="hover-scale"
                          style={{
                            ...styles.filterBtn,
                            backgroundColor: filterPriority === prio ? '#1e293b' : '#ffffff',
                            color: filterPriority === prio ? '#ffffff' : '#64748b',
                            borderColor: filterPriority === prio ? '#1e293b' : '#e2e8f0'
                          }}
                        >
                          {prio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={styles.filterGroup}>
                    <span style={styles.filterLabel}>Filter Category:</span>
                    <div style={styles.filterButtons}>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilterCategory(cat)}
                          className="hover-scale"
                          style={{
                            ...styles.filterBtn,
                            backgroundColor: filterCategory === cat ? '#1e293b' : '#ffffff',
                            color: filterCategory === cat ? '#ffffff' : '#64748b',
                            borderColor: filterCategory === cat ? '#1e293b' : '#e2e8f0'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={styles.filterGroup}>
                    <span style={styles.filterLabel}>Filter by Date:</span>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      style={{
                        ...styles.filterBtn,
                        padding: '0.4rem 0.75rem',
                        cursor: 'text',
                        backgroundColor: filterDate ? '#1e293b' : '#ffffff',
                        color: filterDate ? '#ffffff' : '#64748b',
                        borderColor: filterDate ? '#1e293b' : '#e2e8f0',
                        outline: 'none'
                      }}
                    />
                    {filterDate && (
                      <button
                        onClick={() => setFilterDate('')}
                        style={{
                          ...styles.filterBtn,
                          padding: '0.4rem 0.75rem',
                          marginLeft: '0.5rem',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          borderColor: '#e2e8f0'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeader}>
                        <th style={styles.th}>ID</th>
                        <th style={styles.th}>Priority</th>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredComplaints.map((complaint, idx) => (
                          <motion.tr
                            key={complaint._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                            style={{ ...styles.tableRow, cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedComplaint(complaint);
                              setShowModal(true);
                            }}
                          >
                            <td style={styles.td}>
                              <span style={styles.idText}>
                                {complaint.complaintId || 'N/A'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.priorityBadge,
                                backgroundColor: complaint.priority === 'High' ? '#fee2e2' :
                                  complaint.priority === 'Medium' ? '#fef9c3' : '#f0fdf4',
                                color: complaint.priority === 'High' ? '#dc2626' :
                                  complaint.priority === 'Medium' ? '#a16207' : '#16a34a',
                              }}>
                                {complaint.priority || 'Medium'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.categoryBadge,
                                backgroundColor: getCategoryStyles(complaint.category).bg,
                                color: getCategoryStyles(complaint.category).text
                              }}>
                                {complaint.category}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.actionBadge,
                                backgroundColor: complaint.status === 'Pending' ? '#fff7ed' :
                                  complaint.status === 'In Progress' ? '#eff6ff' : '#f0fdf4',
                                color: complaint.status === 'Pending' ? '#f97316' :
                                  complaint.status === 'In Progress' ? '#3b82f6' : '#10b981',
                                border: `1px solid ${complaint.status === 'Pending' ? '#fdba74' :
                                  complaint.status === 'In Progress' ? '#93c5fd' : '#86efac'}`
                              }}>
                                {complaint.status}
                              </span>
                              {complaint.reRaisedFrom && (
                                <span style={{
                                  ...styles.actionBadge,
                                  backgroundColor: '#f3e8ff',
                                  color: '#7e22ce',
                                  border: '1px solid #d8b4fe',
                                  marginLeft: '0.5rem'
                                }}>
                                  Reraised
                                </span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                  {filteredComplaints.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={styles.noData}
                    >
                      No complaints found for this status.
                    </motion.div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Complaint Detail Modal */}
      <AnimatePresence>
        {showModal && selectedComplaint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.modalOverlay}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={styles.modalContent}
              onClick={e => e.stopPropagation()}
            >
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Complaint Details</h2>
                <button style={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
              </div>

              <div style={styles.modalBody}>
                {/* Top Grid: Complaint & Citizen Info */}
                <div style={styles.detailGrid}>
                  {/* Left Column: Complaint Details */}
                  <div style={styles.detailSection}>
                    <h3 style={styles.detailHeading}>Complaint Information</h3>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Complaint ID:</span>
                      <span style={styles.detailValue}>{selectedComplaint.complaintId}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Category:</span>
                      <span style={{
                        ...styles.categoryBadge,
                        backgroundColor: getCategoryStyles(selectedComplaint.category).bg,
                        color: getCategoryStyles(selectedComplaint.category).text
                      }}>{selectedComplaint.category}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Priority:</span>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: selectedComplaint.priority === 'High' ? '#fee2e2' :
                          selectedComplaint.priority === 'Medium' ? '#fef9c3' : '#f0fdf4',
                        color: selectedComplaint.priority === 'High' ? '#dc2626' :
                          selectedComplaint.priority === 'Medium' ? '#a16207' : '#16a34a',
                        fontWeight: 'bold'
                      }}>{selectedComplaint.priority}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Status:</span>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: selectedComplaint.status === 'Pending' ? '#fff7ed' :
                          selectedComplaint.status === 'In Progress' ? '#eff6ff' : '#f0fdf4',
                        color: selectedComplaint.status === 'Pending' ? '#f97316' :
                          selectedComplaint.status === 'In Progress' ? '#3b82f6' : '#10b981'
                      }}>{selectedComplaint.status}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Reported On:</span>
                      <span style={styles.detailValue}>
                        {new Date(selectedComplaint.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {selectedComplaint.reRaisedFrom && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Flag:</span>
                        <span style={{
                          ...styles.statusBadge,
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          fontWeight: 'bold'
                        }}>Reraised Issue</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Citizen & Location */}
                  <div style={styles.detailSection}>
                    <h3 style={styles.detailHeading}>Citizen & Location</h3>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Name:</span>
                      <span style={styles.detailValue}>{selectedComplaint.user?.name || 'Anonymous'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Citizen ID:</span>
                      <span style={styles.detailValue}>{selectedComplaint.user?.citizenId || 'N/A'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Mobile:</span>
                      <span style={styles.detailValue}>{selectedComplaint.user?.mobileNumber || 'N/A'}</span>
                    </div>

                    <div style={{ padding: '0.5rem 0', borderTop: '1px dashed #e2e8f0', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={styles.detailLabel}>Address:</span>
                        <div style={{ textAlign: 'right', maxWidth: '60%' }}>
                          <p style={{ ...styles.detailValue, margin: 0, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => {
                              handleAddressClick(selectedComplaint);
                              setShowModal(false);
                            }}>
                            📍 {formatAddress(selectedComplaint.address)}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            {selectedComplaint.isVerified && (
                              <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '0.7rem' }}>✅ Verified</span>
                            )}
                            {selectedComplaint.isAuthentic ? (
                              <span style={{ color: '#2563eb', fontWeight: '600', fontSize: '0.7rem' }}>🛡️ Authentic</span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: '600', fontSize: '0.7rem' }}>⚠️ Unverified</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Intelligence Section - Full Width */}
                {Array.isArray(selectedComplaint.aiRecommendations) && selectedComplaint.aiRecommendations.length > 0 && (
                  <div style={{ ...styles.detailSection, marginTop: '2rem' }}>
                    <h3 style={styles.detailHeading}>🤖 AI Intelligence Report</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>

                      <div>
                        <span style={{ ...styles.detailLabel, display: 'block', marginBottom: '0.5rem' }}>Strategic Recommendations:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedComplaint.aiRecommendations.map((rec, idx) => (
                            <div key={idx} style={{
                              fontSize: '0.8rem',
                              color: '#1e293b',
                              backgroundColor: '#f0f9ff',
                              padding: '0.6rem 0.8rem',
                              borderRadius: '0.5rem',
                              borderLeft: '3px solid #3b82f6'
                            }}>
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Evidence Section - Full Width */}
                <div style={{ ...styles.detailSection, marginTop: '2rem' }}>
                  <h3 style={styles.detailHeading}>📷 Evidence & Resolution</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <span style={{ ...styles.detailLabel, display: 'block', marginBottom: '0.5rem' }}>Original Evidence:</span>
                      {selectedComplaint.image ? (
                        <div
                          onClick={() => {
                            setPreviewImageUrl(`${API_BASE_URL}${selectedComplaint.image}`);
                            setShowImagePreview(true);
                          }}
                          style={{ cursor: 'zoom-in', position: 'relative', overflow: 'hidden', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}
                        >
                          <img src={`${API_BASE_URL}${selectedComplaint.image}`} alt="Original" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                        </div>
                      ) : <span style={styles.noEvidence}>No image provided</span>}
                    </div>
                    <div>
                      <span style={{ ...styles.detailLabel, display: 'block', marginBottom: '0.5rem' }}>Resolution Proof:</span>
                      {selectedComplaint.resolvedImage ? (
                        <div
                          onClick={() => {
                            setPreviewImageUrl(`${API_BASE_URL}${selectedComplaint.resolvedImage}`);
                            setShowImagePreview(true);
                          }}
                          style={{ cursor: 'zoom-in', position: 'relative', overflow: 'hidden', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}
                        >
                          <img src={`${API_BASE_URL}${selectedComplaint.resolvedImage}`} alt="Resolved" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                        </div>
                      ) : <span style={{ ...styles.noEvidence, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>No resolution image yet</span>}
                    </div>
                  </div>
                </div>

                {/* Feedback Section */}
                {selectedComplaint.feedback && (
                  <div style={{ ...styles.detailSection, marginTop: '2rem', backgroundColor: '#fffbeb', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #fcd34d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 style={{ ...styles.detailHeading, color: '#92400e', marginBottom: 0, borderBottom: 'none' }}>Citizen Feedback</h3>
                      <div style={{ display: 'flex', color: '#fbbf24', fontSize: '1.25rem' }}>
                        {[...Array(5)].map((_, i) => (
                          <span key={i}>{i < selectedComplaint.feedback.rating ? '★' : '☆'}</span>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontStyle: 'italic', color: '#92400e', margin: 0, lineHeight: '1.6' }}>
                      "{selectedComplaint.feedback.comment || 'No comment provided'}"
                    </p>
                  </div>
                )}
              </div>

              <div style={styles.modalFooter}>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => {
                      handleDelete(selectedComplaint._id);
                      setShowModal(false);
                    }}
                    style={{ ...styles.deleteBtn, padding: '0.6rem 1.2rem', fontSize: '0.875rem' }}
                  >
                    Delete Permanently
                  </button>
                  <button style={styles.closeModalBtn} onClick={() => setShowModal(false)}>Close</button>
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
  container: {
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#1e293b',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 2.5rem',
    backgroundColor: '#1e293b',
    color: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    height: '70px'
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    gap: '0.75rem',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '700',
    letterSpacing: '-0.025em',
    color: 'white',
    marginRight: '2rem'
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  navLinks: {
    display: 'flex',
    gap: '1.5rem',
    marginLeft: '1rem',
    height: '100%',
    alignItems: 'center'
  },
  navLink: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: '500',
    padding: '1.5rem 0',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  navLinkActive: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'default',
    fontSize: '0.9375rem',
    fontWeight: '600',
    padding: '1.5rem 0',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '3px solid #2563eb'
  },
  userGreeting: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  logoutBtn: {
    backgroundColor: '#334155',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    padding: '0.4rem 0.8rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
  },
  mainContent: {
    padding: '2.5rem 5rem',
    maxWidth: '1600px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '2.5rem',
  },
  headerTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: '1rem',
    letterSpacing: '-0.025em',
  },
  tabsContainer: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.5rem',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.75rem',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    backgroundColor: 'transparent',
    color: '#64748b',
  },
  activeTab: {
    backgroundColor: '#1e293b',
    color: 'white',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  summarySection: {
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '1.25rem',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '1.25rem',
  },
  chartContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  chartRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  chartLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#64748b',
  },
  progressBarBg: {
    height: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 1s ease-in-out',
  },
  efficiencyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '1rem 0',
  },
  efficiencyValue: {
    fontSize: '3.5rem',
    fontWeight: '800',
    color: '#2563eb',
    lineHeight: 1,
  },
  efficiencyLabel: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#1e293b',
    marginTop: '0.5rem',
  },
  efficiencySubtext: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.25rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  subTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1e293b',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: '#f0fdf4',
    padding: '0.4rem 0.8rem',
    borderRadius: '2rem',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)',
    animation: 'pulse 2s infinite',
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.5rem',
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '1.25rem',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
    borderLeftWidth: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#0f172a',
  },
  filterBar: {
    marginBottom: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  filterButtons: {
    display: 'flex',
    gap: '0.75rem',
    overflowX: 'auto',
    paddingBottom: '0.5rem',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  filterLabel: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#475569',
    minWidth: '120px',
  },
  filterBtn: {
    flex: '0 0 auto',
    padding: '0.5rem 1.25rem',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '1.25rem',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    textAlign: 'left',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  th: {
    padding: '1.25rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    textAlign: 'left',
  },
  td: {
    padding: '1.5rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '0.875rem',
    verticalAlign: 'middle',
  },
  tableRow: {
    transition: 'background-color 0.2s ease',
    backgroundColor: '#ffffff',
  },
  idText: {
    fontWeight: '700',
    color: '#1e293b',
    fontSize: '0.85rem',
    display: 'block',
    lineHeight: '1.2',
  },
  priorityBadge: {
    padding: '0.4rem 0.8rem',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    display: 'inline-block',
  },
  categoryBadge: {
    padding: '0.375rem 0.75rem',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    display: 'inline-block',
  },
  verificationBadge: {
    fontSize: '0.65rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
  },
  issueDetails: {
    maxWidth: '200px',
    fontSize: '0.875rem',
    color: '#475569',
    lineHeight: '1.5',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  evidenceThumb: {
    width: '45px',
    height: '45px',
    borderRadius: '0.5rem',
    objectFit: 'cover',
    border: '1px solid #e2e8f0',
  },
  locationLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '4px',
    lineHeight: '1.4',
    maxWidth: '150px',
  },
  dateText: {
    color: '#64748b',
    fontWeight: '500',
    fontSize: '0.875rem',
  },
  feedbackStars: {
    color: '#fbbf24',
    fontSize: '0.875rem',
    display: 'flex',
  },
  feedbackText: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: '2px',
  },
  actionBadge: {
    padding: '0.4rem 0.8rem',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    display: 'inline-block',
    textAlign: 'center',
    minWidth: '90px',
  },
  citizenInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  citizenName: {
    fontWeight: '600',
    color: '#1e293b',
    fontSize: '0.875rem',
  },

  noData: {
    padding: '4rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '1rem',
    fontWeight: '500',
  },
  descCell: {
    maxWidth: '300px',
    lineHeight: '1.5',
    color: '#475569',
  },
  addressCell: {
    maxWidth: '300px',
    color: '#64748b',
    fontSize: '0.8125rem',
  },
  dateCell: {
    color: '#64748b',
    fontSize: '0.8125rem',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  evidenceThumb: {
    width: '60px',
    height: '60px',
    borderRadius: '0.5rem',
    objectFit: 'cover',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'scale(1.1)',
      borderColor: '#2563eb',
    }
  },
  noEvidence: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontStyle: 'italic',
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '1.5rem',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    padding: '1.5rem 2rem',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    backgroundColor: 'white',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    border: 'none',
    fontSize: '1.5rem',
    color: '#64748b',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  modalBody: {
    padding: '2rem',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  detailHeading: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.5rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9375rem',
  },
  detailLabel: {
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    color: '#1e293b',
    fontWeight: '700',
  },
  detailDescription: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#475569',
    backgroundColor: '#f8fafc',
    padding: '1.25rem',
    borderRadius: '0.75rem',
    border: '1px solid #f1f5f9',
    margin: 0,
  },
  modalImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s',
  },
  modalFooter: {
    padding: '1.5rem 2rem',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'sticky',
    bottom: 0,
    backgroundColor: 'white',
  },
  closeModalBtn: {
    padding: '0.6rem 1.5rem',
    backgroundColor: '#1e293b',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

// Add keyframes to the document
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes toastSlideIn {
    from { transform: translateX(100%) translateY(-20px); opacity: 0; }
    to { transform: translateX(0) translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(styleSheet);

export default AdminDashboard;
