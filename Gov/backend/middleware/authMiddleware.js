const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('🔑 Token found in header');

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified, user ID:', decoded.id);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log('❌ User not found in database for ID:', decoded.id);
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      // Ensure permissions exist for older users
      if (!req.user.permissions) {
        req.user.permissions = {
          canRead: true,
          canWrite: true,
          canDelete: false
        };
      } else {
        // Handle cases where some fields might be missing within permissions
        if (req.user.permissions.canRead === undefined) req.user.permissions.canRead = true;
        if (req.user.permissions.canWrite === undefined) req.user.permissions.canWrite = true;
        if (req.user.permissions.canDelete === undefined) req.user.permissions.canDelete = false;
      }

      console.log('👤 User authenticated:', req.user.name, '| Permissions:', JSON.stringify(req.user.permissions));
      next();
    } catch (error) {
      console.error('🚫 Auth middleware error:', error.message);
      res.status(401);
      throw new Error('Not authorized');
    }
  }

  if (!token) {
    console.log('⚠️ No token provided in headers');
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.userType === 'admin') {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as an admin');
  }
};

const officer = (req, res, next) => {
  if (req.user && (req.user.userType === 'officer' || req.user.userType === 'admin')) {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as an officer');
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      res.status(403);
      throw new Error(`User type ${req.user.userType} is not authorized to access this route`);
    }
    next();
  };
};

module.exports = { protect, admin, officer, authorize };
