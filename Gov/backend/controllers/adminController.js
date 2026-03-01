const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Add new officer
// @route   POST /api/admin/officers
// @access  Private/Admin
const addOfficer = asyncHandler(async (req, res) => {
  const { name, adharNumber, mobileNumber, department, permissions } = req.body;

  if (!name || !adharNumber || !mobileNumber || !department) {
    res.status(400).json({ message: 'Please enter all required fields' });
    return;
  }

  if (adharNumber.length !== 12 || !/^[0-9]{12}$/.test(adharNumber)) {
    res.status(400).json({ message: 'Aadhar Number must be exactly 12 digits' });
    return;
  }

  if (mobileNumber.length !== 10 || !/^[0-9]{10}$/.test(mobileNumber)) {
    res.status(400).json({ message: 'Mobile Number must be exactly 10 digits' });
    return;
  }

  const userExists = await User.findOne({ adharNumber });

  if (userExists) {
    res.status(400).json({ message: 'User with this Aadhar Number already exists' });
    return;
  }

  // Auto-generate a unique 8-character password/code
  const generatedPassword = Math.random().toString(36).slice(-8).toUpperCase();

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(generatedPassword, salt);

  const user = await User.create({
    name,
    adharNumber,
    mobileNumber,
    password: hashedPassword,
    userType: 'officer',
    department,
    permissions: permissions || {
      canRead: true,
      canWrite: true,
      canDelete: false
    }
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      adharNumber: user.adharNumber,
      mobileNumber: user.mobileNumber,
      userType: user.userType,
      department: user.department,
      permissions: user.permissions,
      generatedPassword: generatedPassword, // Return the plain password to the admin
    });
  } else {
    res.status(400).json({ message: 'Invalid officer data' });
  }
});

// @desc    Get all officers
// @route   GET /api/admin/officers
// @access  Private/Admin
const getOfficers = asyncHandler(async (req, res) => {
  const officers = await User.find({ userType: 'officer' }).select('-password');
  res.json(officers);
});

// @desc    Reset officer password
// @route   PUT /api/admin/officers/:id/reset-password
// @access  Private/Admin
const resetOfficerPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.userType !== 'officer') {
    res.status(404);
    throw new Error('Officer not found');
  }

  // Auto-generate a new unique 8-character password/code
  const newPassword = Math.random().toString(36).slice(-8).toUpperCase();

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  user.password = hashedPassword;
  await user.save();

  res.json({
    _id: user._id,
    name: user.name,
    adharNumber: user.adharNumber,
    generatedPassword: newPassword, // Return the new plain password to the admin
  });
});

// @desc    Update officer details
// @route   PUT /api/admin/officers/:id
// @access  Private/Admin
const updateOfficer = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.userType !== 'officer') {
    res.status(404);
    throw new Error('Officer not found');
  }

  const { name, adharNumber, mobileNumber, department, permissions } = req.body;

  if (adharNumber && (adharNumber.length !== 12 || !/^[0-9]{12}$/.test(adharNumber))) {
    res.status(400).json({ message: 'Aadhar Number must be exactly 12 digits' });
    return;
  }

  if (mobileNumber && (mobileNumber.length !== 10 || !/^[0-9]{10}$/.test(mobileNumber))) {
    res.status(400).json({ message: 'Mobile Number must be exactly 10 digits' });
    return;
  }

  // Check if adharNumber is being changed and if it's already taken
  if (adharNumber && adharNumber !== user.adharNumber) {
    const userExists = await User.findOne({ adharNumber });
    if (userExists) {
      res.status(400).json({ message: 'User with this Aadhar Number already exists' });
      return;
    }
  }

  user.name = name || user.name;
  user.adharNumber = adharNumber || user.adharNumber;
  user.mobileNumber = mobileNumber || user.mobileNumber;
  user.department = department || user.department;
  
  if (permissions) {
    user.permissions = {
      canRead: permissions.canRead !== undefined ? permissions.canRead : user.permissions.canRead,
      canWrite: permissions.canWrite !== undefined ? permissions.canWrite : user.permissions.canWrite,
      canDelete: permissions.canDelete !== undefined ? permissions.canDelete : user.permissions.canDelete,
    };
  }

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    adharNumber: updatedUser.adharNumber,
    mobileNumber: updatedUser.mobileNumber,
    department: updatedUser.department,
    permissions: updatedUser.permissions,
  });
});

// @desc    Delete officer
// @route   DELETE /api/admin/officers/:id
// @access  Private/Admin
const deleteOfficer = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.userType !== 'officer') {
    res.status(404);
    throw new Error('Officer not found');
  }

  await user.deleteOne();
  res.json({ message: 'Officer removed successfully' });
});

const Complaint = require('../models/Complaint');

// @desc    Get dashboard analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
const getAnalytics = asyncHandler(async (req, res) => {
  const totalComplaints = await Complaint.countDocuments();
  const pendingComplaints = await Complaint.countDocuments({ status: 'Pending' });
  const inProgressComplaints = await Complaint.countDocuments({ status: 'In Progress' });
  const resolvedComplaints = await Complaint.countDocuments({ status: 'Resolved' });
  const highPriorityComplaints = await Complaint.countDocuments({ priority: 'High' });

  // Group by Category
  const categoryStats = await Complaint.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  // Group by Status
  const statusStats = await Complaint.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Recent 5 complaints
  const recentComplaints = await Complaint.find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('user', 'name');

  res.json({
    summary: {
      total: totalComplaints,
      pending: pendingComplaints,
      inProgress: inProgressComplaints,
      resolved: resolvedComplaints,
      highPriority: highPriorityComplaints
    },
    categoryStats,
    statusStats,
    recentComplaints
  });
});

module.exports = {
  addOfficer,
  getOfficers,
  resetOfficerPassword,
  updateOfficer,
  deleteOfficer,
  getAnalytics,
};
