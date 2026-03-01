import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import MapView from '../components/MapView';
import Chatbot from '../components/Chatbot';

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

const OfficerDashboard = () => {
  const API_BASE_URL = 'http://localhost:5005';
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(() => {
    const saved = localStorage.getItem('userInfo');
    return saved ? JSON.parse(saved) : null;
  });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [notification, setNotification] = useState(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedComplaintForMap, setSelectedComplaintForMap] = useState(null);
  const [resolvedImage, setResolvedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const [isCompressing, setIsCompressing] = useState(false);

  const handleImageChange = async (file) => {
    if (file && file.type.startsWith('image/')) {
      setIsCompressing(true);
      try {
        const compressed = await compressImage(file);
        setResolvedImage(compressed);
      } catch (e) {
        console.error('Compression failed', e);
        setResolvedImage(file);
      } finally {
        setIsCompressing(false);
      }
    } else if (file) {
      setResolvedImage(file);
    }
  };

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
      if (userInfo.userType !== 'officer') {
        navigate('/');
        return;
      }
      fetchComplaints(userInfo.token);
    } else {
      navigate('/login');
    }
  }, [navigate, userInfo]);

  const fetchComplaints = async (token) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const { data } = await axios.get(`${API_BASE_URL}/api/complaints/admin/all`, config);

      // Mapping between Officer Department and Complaint Category
      const deptToCategory = {
        'Road': 'Road',
        'Electricity': 'Electricity',
        'Garbage': 'Garbage',
        'Sewage': 'Sewage',
        'Water Supply': 'Water Supply'
      };

      // Filter by department if officer has one
      const filteredByDept = userInfo.department && userInfo.department !== 'None'
        ? data.filter(c => {
          const targetCategory = deptToCategory[userInfo.department];
          // Match either the direct department name or the mapped category
          return c.category === targetCategory || c.category === userInfo.department;
        })
        : data;

      setComplaints(filteredByDept);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (newStatus === 'Resolved') {
      setSelectedComplaintId(id);
      setShowResolveModal(true);
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.put(`${API_BASE_URL}/api/complaints/${id}/status`, { status: newStatus }, config);
      fetchComplaints(userInfo.token);
      setNotification({ message: 'Status updated successfully!', type: 'success' });
    } catch (error) {
      console.error('Error updating status:', error);
      setNotification({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolvedImage) {
      setNotification({ message: 'Please upload a resolution picture', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', 'Resolved');
      formData.append('resolvedImage', resolvedImage);

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      await axios.put(`${API_BASE_URL}/api/complaints/${selectedComplaintId}/status`, formData, config);

      setShowResolveModal(false);
      setSelectedComplaintId(null);
      setResolvedImage(null);
      fetchComplaints(userInfo.token);
      setNotification({ message: 'Issue resolved with evidence!', type: 'success' });
    } catch (error) {
      console.error('Error resolving complaint:', error);
      setNotification({ message: 'Failed to resolve issue', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  const filteredComplaints = complaints
    .filter(c => {
      const statusMatch = filterStatus === 'All' || c.status === filterStatus;
      const priorityMatch = filterPriority === 'All' || c.priority === filterPriority;

      // Date filter logic
      let dateMatch = true;
      if (filterDate) {
        const complaintDate = new Date(c.createdAt).toISOString().split('T')[0];
        dateMatch = complaintDate === filterDate;
      }

      return statusMatch && priorityMatch && dateMatch;
    })
    .sort((a, b) => {
      // Primary sort by date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'Pending').length,
    inProgress: complaints.filter(c => c.status === 'In Progress').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
  };

  const getCategoryStyles = (category) => {
    switch (category) {
      case 'Road': return { bg: '#eff6ff', text: '#2563eb' };
      case 'Electricity': return { bg: '#fef9c3', text: '#a16207' };
      case 'Garbage': return { bg: '#f0fdf4', text: '#16a34a' };
      case 'Sewage': return { bg: '#f5f3ff', text: '#7c3aed' };
      case 'Water Supply': return { bg: '#e0f2fe', text: '#0284c7' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        Loading Officer Dashboard...
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

  const canWrite = userInfo?.permissions?.canWrite || false;
  const canDelete = userInfo?.permissions?.canDelete || false;

  const handleDeleteComplaint = async (id) => {
    if (window.confirm('Are you sure you want to delete this complaint?')) {
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
        setNotification({
          message: error.response?.data?.message || 'Failed to delete complaint',
          type: 'error'
        });
      }
    }
  };

  return (
    <div style={styles.container}>
      {notification && (
        <div style={{
          ...styles.toast,
          backgroundColor: notification.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
        }}>
          <span style={{ fontSize: '1.25rem' }}>
            {notification.type === 'success' ? '✅' : '❌'}
          </span>
          {notification.message}
        </div>
      )}
      <nav style={styles.navbar}>
        <div style={styles.navLeft}>
          <span style={styles.logoText}>CiviSmart Officer Portal</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.userGreeting}>
            {userInfo.department && userInfo.department !== 'None' ? userInfo.department : 'Dept.'} Officer: {userInfo.name}
          </span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </nav>

      {showDetailModal && selectedComplaint && (
        <div style={styles.modalOverlay} onClick={() => setShowDetailModal(false)}>
          <div style={{ ...styles.modalContent, maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#1e293b' }}>Complaint Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>


                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Status</h3>
                    <span style={{
                      ...styles.actionBadge,
                      borderColor: selectedComplaint.status === 'Pending' ? '#f97316' :
                        selectedComplaint.status === 'In Progress' ? '#3b82f6' : '#10b981',
                      color: selectedComplaint.status === 'Pending' ? '#f97316' :
                        selectedComplaint.status === 'In Progress' ? '#3b82f6' : '#10b981',
                      display: 'inline-block',
                      width: 'auto',
                      padding: '0.4rem 1rem'
                    }}>
                      {selectedComplaint.status}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Priority</h3>
                    <span style={{
                      ...styles.priorityBadge,
                      backgroundColor: selectedComplaint.priority === 'High' ? '#fee2e2' :
                        selectedComplaint.priority === 'Medium' ? '#fef9c3' : '#f0fdf4',
                      color: selectedComplaint.priority === 'High' ? '#dc2626' :
                        selectedComplaint.priority === 'Medium' ? '#a16207' : '#16a34a',
                    }}>
                      {selectedComplaint.priority}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Verification</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedComplaint.isVerified && (
                        <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '0.75rem' }}>✅ Verified</span>
                      )}
                      {selectedComplaint.isAuthentic ? (
                        <span style={{ color: '#2563eb', fontWeight: '600', fontSize: '0.75rem' }}>🛡️ Authentic</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: '600', fontSize: '0.75rem' }}>⚠️ Unverified</span>
                      )}
                      {selectedComplaint.reRaisedFrom && (
                        <span style={{ color: '#7e22ce', fontWeight: '600', fontSize: '0.75rem' }}>🔄 Reraised</span>
                      )}
                    </div>
                  </div>
                </div>



                {Array.isArray(selectedComplaint.aiRecommendations) && selectedComplaint.aiRecommendations.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>AI Recommendations</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedComplaint.aiRecommendations.map((rec, idx) => (
                        <div key={idx} style={{
                          fontSize: '0.85rem',
                          color: '#1e293b',
                          backgroundColor: '#f0f9ff',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          borderLeft: '3px solid #3b82f6'
                        }}>
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Location</h3>
                  <div style={{ fontSize: '0.875rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem' }}>
                    <span>📍</span>
                    <span>{selectedComplaint.address}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {canWrite && selectedComplaint.status !== 'Resolved' && (
                    <React.Fragment>
                      {selectedComplaint.status === 'Pending' ? (
                        <button
                          onClick={() => {
                            handleStatusChange(selectedComplaint._id, 'In Progress');
                            setShowDetailModal(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: '#eff6ff',
                            color: '#3b82f6',
                            border: '1px solid #3b82f6',
                            borderRadius: '0.5rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Start Progress
                        </button>
                      ) : (
                        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                          <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.75rem' }}>Resolve Issue</h3>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>Upload evidence image to mark as resolved:</p>

                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              handleImageChange(e.target.files[0]);
                              setSelectedComplaintId(selectedComplaint._id);
                            }}
                            style={{ fontSize: '0.75rem', marginBottom: '1rem', width: '100%' }}
                          />

                          <button
                            onClick={() => {
                              if (!resolvedImage) {
                                setNotification({ message: 'Please select an image first', type: 'error' });
                                return;
                              }
                              handleResolveSubmit();
                              setShowDetailModal(false);
                            }}
                            disabled={isSubmitting || isCompressing || !resolvedImage}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              backgroundColor: resolvedImage ? '#10b981' : '#e2e8f0',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: '700',
                              cursor: resolvedImage ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {isSubmitting ? 'Uploading...' : 'Confirm Resolution'}
                          </button>
                        </div>
                      )}
                    </React.Fragment>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => {
                        handleDeleteComplaint(selectedComplaint._id);
                        setShowDetailModal(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#fef2f2',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '0.5rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete Complaint
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Evidence</h3>
                  {selectedComplaint.image ? (
                    <div
                      onClick={() => {
                        setPreviewImageUrl(`${API_BASE_URL}${selectedComplaint.image}`);
                        setShowImagePreview(true);
                      }}
                      style={{ cursor: 'zoom-in' }}
                    >
                      <img
                        src={`${API_BASE_URL}${selectedComplaint.image}`}
                        alt="Evidence"
                        style={{ width: '100%', borderRadius: '1rem', border: '1px solid #e2e8f0', objectFit: 'cover', maxHeight: '200px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ height: '200px', backgroundColor: '#f1f5f9', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      No image provided
                    </div>
                  )}
                </div>

                {selectedComplaint.resolvedImage && (
                  <div>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Resolution Evidence</h3>
                    <div
                      onClick={() => {
                        setPreviewImageUrl(`${API_BASE_URL}${selectedComplaint.resolvedImage}`);
                        setShowImagePreview(true);
                      }}
                      style={{ cursor: 'zoom-in' }}
                    >
                      <img
                        src={`${API_BASE_URL}${selectedComplaint.resolvedImage}`}
                        alt="Resolution"
                        style={{ width: '100%', borderRadius: '1rem', border: '2px solid #10b981', objectFit: 'cover', maxHeight: '200px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showResolveModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Resolve Complaint</h2>
            <p style={styles.modalText}>Please upload a picture as evidence that the issue has been resolved.</p>

            <div style={styles.uploadArea}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e.target.files[0])}
                style={styles.fileInput}
                id="resolve-upload"
              />
              <label htmlFor="resolve-upload" style={styles.uploadLabel}>
                {resolvedImage ? `Selected: ${resolvedImage.name}` : 'Click to select resolution image'}
              </label>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setResolvedImage(null);
                }}
                style={styles.cancelBtn}
                disabled={isSubmitting || isCompressing}
              >
                Cancel
              </button>
              <button
                onClick={handleResolveSubmit}
                style={styles.submitBtn}
                disabled={isSubmitting || isCompressing || !resolvedImage}
              >
                {isSubmitting ? 'Uploading...' : isCompressing ? 'Compressing...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.mainContent}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Assigned Complaints</h1>
          <div style={styles.statsBar}>
            <div style={{ ...styles.statCard, borderLeftColor: '#f97316' }}>
              <span style={styles.statLabel}>Pending</span>
              <span style={styles.statValue}>{stats.pending}</span>
            </div>
            <div style={{ ...styles.statCard, borderLeftColor: '#3b82f6' }}>
              <span style={styles.statLabel}>In Progress</span>
              <span style={styles.statValue}>{stats.inProgress}</span>
            </div>
            <div style={{ ...styles.statCard, borderLeftColor: '#10b981' }}>
              <span style={styles.statLabel}>Resolved</span>
              <span style={styles.statValue}>{stats.resolved}</span>
            </div>
            <div style={{ ...styles.statCard, borderLeftColor: '#1e293b' }}>
              <span style={styles.statLabel}>Total</span>
              <span style={styles.statValue}>{stats.total}</span>
            </div>
          </div>
        </header>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: '1rem' }}>Dispatch Map</h2>
          <MapView
            complaints={complaints}
            selectedComplaint={selectedComplaintForMap}
            height="350px"
          />
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
            📍 Click on any address in the table below to locate it on the map. Red markers indicate high priority issues.
          </p>
        </div>

        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Filter Status:</span>
            <div style={styles.filterButtons}>
              {['All', 'Pending', 'In Progress', 'Resolved'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
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
                <th style={styles.th}>Complaint ID</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Priority</th>
                <th style={styles.th}>Issue Details</th>
                <th style={styles.th}>Location</th>
                <th style={styles.th}>Reported Date</th>
                <th style={styles.th}>Evidence</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.length > 0 ? (
                filteredComplaints.map(complaint => (
                  <tr key={complaint._id} style={styles.tableRow}>
                    <td style={styles.td}>
                      <span style={styles.idText}>{complaint.complaintId}</span>
                      <span style={{
                        ...styles.verificationBadge,
                        color: complaint.isAuthentic ? '#2563eb' : '#dc2626'
                      }}>
                        {complaint.isAuthentic ? '🛡️ Authentic' : '⚠️ Unverified'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.categoryBadge,
                        backgroundColor: complaint.category === 'Road' ? '#eff6ff' :
                          complaint.category === 'Garbage' ? '#f0fdf4' :
                            complaint.category === 'Electricity' ? '#fffbeb' : '#f8fafc',
                        color: complaint.category === 'Road' ? '#1e40af' :
                          complaint.category === 'Garbage' ? '#166534' :
                            complaint.category === 'Electricity' ? '#92400e' : '#475569'
                      }}>
                        {complaint.category}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.priorityBadge,
                        backgroundColor: complaint.priority === 'High' ? '#fee2e2' :
                          complaint.priority === 'Medium' ? '#fef9c3' : '#f0fdf4',
                        color: complaint.priority === 'High' ? '#dc2626' :
                          complaint.priority === 'Medium' ? '#a16207' : '#16a34a'
                      }}>
                        {complaint.priority}
                      </span>
                      {complaint.reRaisedFrom && (
                        <span style={{
                          ...styles.priorityBadge,
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          marginTop: '0.5rem',
                          display: 'inline-block'
                        }}>
                          Reraised
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.descCell}>{complaint.issueDescription}</div>
                    </td>
                    <td style={styles.td}>
                      <div
                        style={{ ...styles.addressCell, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => handleAddressClick(complaint)}
                      >
                        📍 {formatAddress(complaint.address)}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.dateCell}>
                        {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {complaint.image ? (
                        <img
                          src={`${API_BASE_URL}${complaint.image}`}
                          alt="Evidence"
                          style={styles.evidenceThumb}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImageUrl(`${API_BASE_URL}${complaint.image}`);
                            setShowImagePreview(true);
                          }}
                        />
                      ) : (
                        <span style={styles.noEvidence}>No image</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => {
                          setSelectedComplaint(complaint);
                          setShowDetailModal(true);
                        }}
                        style={{
                          ...styles.actionBadge,
                          borderColor: complaint.status === 'Pending' ? '#f97316' :
                            complaint.status === 'In Progress' ? '#3b82f6' : '#10b981',
                          color: complaint.status === 'Pending' ? '#f97316' :
                            complaint.status === 'In Progress' ? '#3b82f6' : '#10b981'
                        }}
                      >
                        View & Manage
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={styles.noData}>No complaints found matching filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '2.5rem',
    borderRadius: '1rem',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '1rem',
    color: '#1e293b',
  },
  modalText: {
    color: '#64748b',
    marginBottom: '2rem',
    lineHeight: '1.5',
  },
  uploadArea: {
    border: '2px dashed #e2e8f0',
    borderRadius: '0.75rem',
    padding: '2rem',
    textAlign: 'center',
    marginBottom: '2rem',
    transition: 'all 0.2s ease',
    backgroundColor: '#f8fafc',
  },
  fileInput: {
    display: 'none',
  },
  uploadLabel: {
    cursor: 'pointer',
    color: '#2563eb',
    fontWeight: '600',
    fontSize: '0.9375rem',
  },
  modalActions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#64748b',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  submitBtn: {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: '#2563eb',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    opacity: '0.9',
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
    marginBottom: '1.5rem',
    letterSpacing: '-0.025em',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1e293b',
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
    maxWidth: '250px',
    fontSize: '0.875rem',
    color: '#475569',
    lineHeight: '1.5',
  },
  evidenceThumb: {
    width: '50px',
    height: '50px',
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
    maxWidth: '200px',
  },
  dateText: {
    color: '#64748b',
    fontWeight: '500',
    fontSize: '0.875rem',
  },
  feedbackStars: {
    color: '#fbbf24',
    fontSize: '1rem',
    display: 'flex',
  },
  feedbackText: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: '2px',
  },
  actionBadge: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: '600',
    border: '1px solid',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  evidenceThumb: {
    width: '60px',
    height: '60px',
    borderRadius: '0.5rem',
    objectFit: 'cover',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
  },
  noEvidence: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  addressCell: {
    maxWidth: '300px',
    fontSize: '0.8rem',
    lineHeight: '1.4',
  },
  dateCell: {
    whiteSpace: 'nowrap',
    color: '#64748b',
    fontWeight: '500',
  },
  toast: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '1rem 1.5rem',
    borderRadius: '0.75rem',
    color: 'white',
    fontWeight: '600',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    animation: 'slideInRight 0.3s ease-out'
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
};

export default OfficerDashboard;
