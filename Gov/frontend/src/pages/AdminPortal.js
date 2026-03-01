import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminPortal = () => {
  const API_BASE_URL = 'http://localhost:5005';
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [createdOfficer, setCreatedOfficer] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    adharNumber: '',
    mobileNumber: '',
    department: 'Road',
    permissions: {
      canRead: true,
      canWrite: true,
      canDelete: false
    }
  });

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('userInfo');
    if (storedUserInfo) {
      const parsedUser = JSON.parse(storedUserInfo);
      if (parsedUser.userType !== 'admin') {
        navigate('/');
        return;
      }
      setUserInfo(parsedUser);
      fetchOfficers(parsedUser.token);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchOfficers = async (token) => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/officers`, config);
      setOfficers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching officers:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('perm_')) {
      const permKey = name.replace('perm_', '');
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          [permKey]: checked
        }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleAddOfficer = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.adharNumber.length !== 12 || !/^[0-9]{12}$/.test(formData.adharNumber)) {
      setNotification({ type: 'error', message: 'Aadhar Number must be exactly 12 digits' });
      return;
    }
    if (formData.mobileNumber.length !== 10 || !/^[0-9]{10}$/.test(formData.mobileNumber)) {
      setNotification({ type: 'error', message: 'Mobile Number must be exactly 10 digits' });
      return;
    }

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`
        }
      };
      const { data } = await axios.post(`${API_BASE_URL}/api/admin/officers`, formData, config);

      setCreatedOfficer(data); // Store created officer info including password
      setNotification({ message: `Officer ${data.name} added successfully!`, type: 'success' });
      setShowAddModal(false);
      setFormData({
        name: '',
        adharNumber: '',
        mobileNumber: '',
        department: 'Road',
        permissions: {
          canRead: true,
          canWrite: true,
          canDelete: false
        }
      });
      fetchOfficers(userInfo.token);
    } catch (error) {
      setNotification({
        message: error.response?.data?.message || 'Failed to add officer',
        type: 'error'
      });
    }
  };

  const handleEditClick = (officer) => {
    setSelectedOfficer(officer);
    setFormData({
      name: officer.name,
      adharNumber: officer.adharNumber,
      mobileNumber: officer.mobileNumber,
      department: officer.department,
      permissions: {
        canRead: officer.permissions?.canRead !== undefined ? officer.permissions.canRead : true,
        canWrite: officer.permissions?.canWrite !== undefined ? officer.permissions.canWrite : true,
        canDelete: officer.permissions?.canDelete || false
      }
    });
    setShowEditModal(true);
  };

  const handleUpdateOfficer = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.adharNumber.length !== 12 || !/^[0-9]{12}$/.test(formData.adharNumber)) {
      setNotification({ type: 'error', message: 'Aadhar Number must be exactly 12 digits' });
      return;
    }
    if (formData.mobileNumber.length !== 10 || !/^[0-9]{10}$/.test(formData.mobileNumber)) {
      setNotification({ type: 'error', message: 'Mobile Number must be exactly 10 digits' });
      return;
    }

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`
        }
      };
      await axios.put(`${API_BASE_URL}/api/admin/officers/${selectedOfficer._id}`, formData, config);

      setNotification({ message: `Officer updated successfully!`, type: 'success' });
      setShowEditModal(false);
      setSelectedOfficer(null);
      setFormData({
        name: '',
        adharNumber: '',
        mobileNumber: '',
        department: 'Road',
        permissions: {
          canRead: true,
          canWrite: true,
          canDelete: false
        }
      });
      fetchOfficers(userInfo.token);
    } catch (error) {
      setNotification({
        message: error.response?.data?.message || 'Failed to update officer',
        type: 'error'
      });
    }
  };

  const handleDeleteOfficer = async (officerId) => {
    if (!window.confirm('Are you sure you want to delete this officer? This action cannot be undone.')) {
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`
        }
      };
      await axios.delete(`${API_BASE_URL}/api/admin/officers/${officerId}`, config);

      setNotification({ message: 'Officer deleted successfully', type: 'success' });
      fetchOfficers(userInfo.token);
    } catch (error) {
      setNotification({
        message: error.response?.data?.message || 'Failed to delete officer',
        type: 'error'
      });
    }
  };

  const handleResetPassword = async (officerId) => {
    if (!window.confirm('Are you sure you want to generate a new login code for this officer?')) {
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`
        }
      };
      const { data } = await axios.put(`${API_BASE_URL}/api/admin/officers/${officerId}/reset-password`, {}, config);

      setCreatedOfficer(data); // Reuse the success modal to show new password
      setNotification({ message: `New login code generated for ${data.name}`, type: 'success' });
    } catch (error) {
      setNotification({
        message: error.response?.data?.message || 'Failed to reset code',
        type: 'error'
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  if (loading) return <div style={styles.loading}>Loading Admin Portal...</div>;

  return (
    <div style={styles.container}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          ...styles.toast,
          backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444',
        }}>
          {notification.message}
        </div>
      )}

      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navLeft}>
          <span style={styles.logoText}>CiviSmart Admin Portal</span>
          <div style={styles.navLinks}>
            <button style={styles.navLinkActive}>Officer Management</button>
            <button
              style={styles.navLink}
              onClick={() => navigate('/admin-dashboard')}
            >
              Complaints Management
            </button>
          </div>
        </div>
        <div style={styles.navRight}>
          <span style={styles.userGreeting}>Admin: {userInfo.name}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>System Management</h1>
          <button
            style={styles.addBtn}
            onClick={() => setShowAddModal(true)}
          >
            + Add New Officer
          </button>
        </header>

        <div style={styles.tableSection}>
          <h2 style={styles.sectionTitle}>Registered Officers</h2>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>Aadhar Number</th>
                  <th style={styles.th}>Mobile</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {officers.map(officer => (
                  <tr key={officer._id} style={styles.tableRow}>
                    <td style={styles.td}>{officer.name}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.deptBadge,
                        backgroundColor: getDeptColor(officer.department)
                      }}>
                        {officer.department}
                      </span>
                    </td>
                    <td style={styles.td}>{officer.adharNumber}</td>
                    <td style={styles.td}>{officer.mobileNumber}</td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          onClick={() => handleEditClick(officer)}
                          style={styles.editBtn}
                          title="Edit Officer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleResetPassword(officer._id)}
                          style={styles.resetBtn}
                          title="Reset Password Code"
                        >
                          Reset Code
                        </button>
                        <button
                          onClick={() => handleDeleteOfficer(officer._id)}
                          style={styles.deleteBtn}
                          title="Delete Officer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Officer Modal */}
      {showAddModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Add New Department Officer</h2>
            <form onSubmit={handleAddOfficer} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  style={styles.input}
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Department</label>
                <select
                  style={styles.input}
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                >
                  <option value="Road">Road Officer</option>
                  <option value="Electricity">Electricity Officer</option>
                  <option value="Sewage">Sewage Officer</option>
                  <option value="Garbage">Garbage Officer</option>
                  <option value="Water Supply">Water Supply Officer</option>
                </select>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Aadhar Number (12 digits)</label>
                <input
                  style={styles.input}
                  name="adharNumber"
                  value={formData.adharNumber}
                  onChange={handleInputChange}
                  required
                  maxLength="12"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Mobile Number (10 digits)</label>
                <input
                  style={styles.input}
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  required
                  maxLength="10"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>IAM Access Privileges</label>
                <div style={styles.checkboxGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="perm_canRead"
                      checked={formData.permissions.canRead}
                      onChange={handleInputChange}
                    />
                    Read Complaints
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="perm_canWrite"
                      checked={formData.permissions.canWrite}
                      onChange={handleInputChange}
                    />
                    Write/Update Status
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="perm_canDelete"
                      checked={formData.permissions.canDelete}
                      onChange={handleInputChange}
                    />
                    Delete Complaints
                  </label>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>Create Officer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Officer Modal */}
      {showEditModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Edit Department Officer</h2>
            <form onSubmit={handleUpdateOfficer} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  style={styles.input}
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Department</label>
                <select
                  style={styles.input}
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                >
                  <option value="Road">Road Officer</option>
                  <option value="Electricity">Electricity Officer</option>
                  <option value="Sewage">Sewage Officer</option>
                  <option value="Garbage">Garbage Officer</option>
                  <option value="Water Supply">Water Supply Officer</option>
                </select>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Aadhar Number (12 digits)</label>
                <input
                  style={styles.input}
                  name="adharNumber"
                  value={formData.adharNumber}
                  onChange={handleInputChange}
                  required
                  maxLength="12"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Mobile Number (10 digits)</label>
                <input
                  style={styles.input}
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  required
                  maxLength="10"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>IAM Access Privileges</label>
                <div style={styles.checkboxGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="perm_canRead"
                      checked={formData.permissions.canRead}
                      onChange={handleInputChange}
                    />
                    Read Complaints
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="perm_canWrite"
                      checked={formData.permissions.canWrite}
                      onChange={handleInputChange}
                    />
                    Write/Update Status
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="perm_canDelete"
                      checked={formData.permissions.canDelete}
                      onChange={handleInputChange}
                    />
                    Delete Complaints
                  </label>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedOfficer(null);
                    setFormData({
                      name: '',
                      adharNumber: '',
                      mobileNumber: '',
                      department: 'Road',
                      permissions: {
                        canRead: true,
                        canWrite: true,
                        canDelete: false
                      }
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>Update Officer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal for Created Officer */}
      {createdOfficer && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '3rem', color: '#10b981', marginBottom: '1rem' }}>✓</div>
            <h2 style={styles.modalTitle}>Officer Created!</h2>
            <p style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              Please share these login credentials with the officer.
            </p>
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              marginBottom: '2rem',
              textAlign: 'left'
            }}>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Aadhar Number (Username):</p>
              <p style={{ fontWeight: '700', fontSize: '1.125rem', marginBottom: '1rem' }}>{createdOfficer.adharNumber}</p>

              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Login Password / Code:</p>
              <p style={{
                fontWeight: '800',
                fontSize: '1.5rem',
                color: '#2563eb',
                letterSpacing: '0.1em',
                fontFamily: 'monospace'
              }}>
                {createdOfficer.generatedPassword}
              </p>
            </div>
            <button
              style={{ ...styles.submitBtn, width: '100%' }}
              onClick={() => setCreatedOfficer(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const getDeptColor = (dept) => {
  switch (dept) {
    case 'Road': return '#64748b';
    case 'Electricity': return '#eab308';
    case 'Sewage': return '#8b5cf6';
    case 'Garbage': return '#10b981';
    case 'Water Supply': return '#0ea5e9';
    default: return '#94a3b8';
  }
};

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 2rem',
    backgroundColor: '#1e293b',
    color: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    height: '70px'
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    height: '100%'
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: '700',
    letterSpacing: '-0.025em',
    marginRight: '3rem',
    color: 'white'
  },
  navLinks: {
    display: 'flex',
    gap: '1.5rem',
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
    transition: 'color 0.2s'
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
  userGreeting: { marginRight: '1.5rem', fontSize: '0.875rem', opacity: '0.9' },
  logoutBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#334155',
    border: 'none',
    color: 'white',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem'
  },
  mainContent: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' },
  headerTitle: { fontSize: '1.875rem', fontWeight: '700', color: '#0f172a' },
  addBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)'
  },
  tableSection: { backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  sectionTitle: { fontSize: '1.125rem', fontWeight: '600', color: '#334155', marginBottom: '1.5rem' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { borderBottom: '2px solid #f1f5f9' },
  th: { textAlign: 'left', padding: '1rem', color: '#64748b', fontSize: '0.875rem', fontWeight: '600' },
  tableRow: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '1rem', color: '#334155', fontSize: '0.875rem' },
  deptBadge: { padding: '0.25rem 0.75rem', borderRadius: '1rem', color: 'white', fontSize: '0.75rem', fontWeight: '600' },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: { backgroundColor: 'white', padding: '2rem', borderRadius: '1.25rem', width: '450px', maxWidth: '90%' },
  modalTitle: { fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1e293b' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.875rem', fontWeight: '600', color: '#64748b' },
  input: {
    padding: '0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '0.5rem',
    fontSize: '0.9375rem',
    outline: 'none'
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    backgroundColor: '#f8fafc',
    padding: '1rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.875rem',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: '500'
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' },
  cancelBtn: { padding: '0.75rem 1.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', backgroundColor: 'white' },
  submitBtn: { padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' },
  actionButtons: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center'
  },
  editBtn: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#fff',
    color: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: '0.4rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  resetBtn: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#fff',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    borderRadius: '0.4rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  deleteBtn: {
    padding: '0.4rem 0.8rem',
    backgroundColor: '#fff',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '0.4rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.125rem' },
  toast: {
    position: 'fixed',
    top: '2rem',
    right: '2rem',
    padding: '1rem 2rem',
    color: 'white',
    borderRadius: '0.75rem',
    zIndex: 2000,
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
  }
};

export default AdminPortal;
