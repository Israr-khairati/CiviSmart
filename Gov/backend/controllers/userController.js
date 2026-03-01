const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const twilio = require('twilio');

// Helper to get Twilio client
const getTwilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  
  if (!sid || !token || sid === 'your_twilio_sid') {
    throw new Error('Twilio credentials are not configured in .env file');
  }
  
  return twilio(sid, token);
};

// Simple in-memory store for OTPs (In production, use Redis or a DB)
const otpStore = new Map();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, adharNumber, mobileNumber, password } = req.body;

  if (!name || !adharNumber || !mobileNumber || !password) {
    res.status(400).json({ message: 'Please enter all required fields' });
    return;
  }

  if (adharNumber.length !== 12 || !/^[0-9]{12}$/.test(adharNumber)) {
    res.status(400).json({ message: 'Aadhar Number must be 12 digits' });
    return;
  }

  if (mobileNumber.length !== 10 || !/^[0-9]{10}$/.test(mobileNumber)) {
    res.status(400).json({ message: 'Mobile Number must be 10 digits' });
    return;
  }

  const userExists = await User.findOne({ adharNumber });

  if (userExists) {
    res.status(400).json({ message: 'User with this Aadhar Number already exists' });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Generate unique citizenId (e.g., CIT-2026-XXXX)
  const count = await User.countDocuments({ userType: 'citizen' });
  const citizenId = `CIT-2026-${String(count + 1).padStart(4, '0')}`;

  const user = await User.create({
    name,
    adharNumber,
    citizenId,
    mobileNumber,
    password: hashedPassword,
    userType: 'citizen',
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      adharNumber: user.adharNumber,
      citizenId: user.citizenId,
      mobileNumber: user.mobileNumber,
      userType: user.userType,
      department: user.department || 'None',
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
});

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { adharNumber, password } = req.body;

  console.log('Login attempt for Aadhar Number:', adharNumber);
  console.log('Password provided:', password);

  // Check for user adharNumber
  const user = await User.findOne({ adharNumber });

  if (!user) {
    console.log('User not found for Aadhar Number:', adharNumber);
    res.status(400).json({ message: 'Invalid credentials' });
    return;
  }

  console.log('User found:', user.name);
  const isMatch = await bcrypt.compare(password, user.password);
  console.log('Password match result:', isMatch);

  if (isMatch) {
    res.json({
      _id: user._id,
      name: user.name,
      adharNumber: user.adharNumber,
      citizenId: user.citizenId,
      mobileNumber: user.mobileNumber,
      userType: user.userType,
      department: user.department || 'None',
      permissions: user.permissions || { canRead: true, canWrite: true, canDelete: false },
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: 'Invalid credentials' });
  }
});

const sendOtp = asyncHandler(async (req, res) => {
  const { mobileNumber } = req.body;

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

  try {
    // Save OTP to DB (we'll look for user or create a temporary record if needed)
    // For registration, we can just return success and check against a temporary store or 
    // simply trust the client-side verified OTP if using Twilio Verify, but here we'll use standard SMS
    
    // We store OTP in a way that we can verify it later. 
    // Since the user isn't created yet during registration, we can use a separate logic or 
    // find a way to store it. For now, let's assume we want to send it.
    const client = getTwilioClient();

    await client.messages.create({
      body: `Your CiviSmart verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobileNumber}`
    });

    console.log(`Twilio OTP sent to ${mobileNumber}: ${otp}`);

    // Store OTP in server memory for verification
    otpStore.set(mobileNumber, {
      otp: otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    res.status(200).json({ 
      message: 'OTP sent successfully via Twilio'
    });
  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to send SMS. Check your Twilio credentials.',
      code: error.code
    });
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { mobileNumber, otp } = req.body;

  console.log('Verifying OTP for:', mobileNumber);
  console.log('OTP received from client:', otp);

  const storedData = otpStore.get(mobileNumber);

  if (!storedData) {
    console.log('No OTP found for this number');
    res.status(400).json({ message: 'OTP expired or not sent. Please try again.' });
    return;
  }

  if (Date.now() > storedData.expires) {
    console.log('OTP expired');
    otpStore.delete(mobileNumber);
    res.status(400).json({ message: 'OTP expired. Please try again.' });
    return;
  }

  console.log('OTP expected (server memory):', storedData.otp);

  // Convert both to string and trim to ensure exact match
  if (otp && storedData.otp && otp.toString().trim() === storedData.otp.toString().trim()) {
    console.log('OTP verified successfully!');
    otpStore.delete(mobileNumber); // Remove after successful verification
    res.status(200).json({ message: 'OTP verified successfully' });
  } else {
    console.log('OTP mismatch!');
    res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
  }
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const name = req.body?.name;
  const mobileNumber = req.body?.mobileNumber;

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }
    user.name = trimmedName;
  }

  if (mobileNumber !== undefined) {
    const digits = String(mobileNumber).replace(/\D/g, '');
    if (digits.length !== 10 || !/^[0-9]{10}$/.test(digits)) {
      res.status(400).json({ message: 'Mobile Number must be exactly 10 digits' });
      return;
    }

    if (digits !== user.mobileNumber) {
      const userExists = await User.findOne({ mobileNumber: digits });
      if (userExists) {
        res.status(400).json({ message: 'User with this Mobile Number already exists' });
        return;
      }
      user.mobileNumber = digits;
    }
  }

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    adharNumber: updatedUser.adharNumber,
    citizenId: updatedUser.citizenId,
    mobileNumber: updatedUser.mobileNumber,
    userType: updatedUser.userType,
    department: updatedUser.department || 'None',
    permissions: updatedUser.permissions || { canRead: true, canWrite: true, canDelete: false },
    token: generateToken(updatedUser._id),
  });
});

module.exports = { loginUser, registerUser, sendOtp, verifyOtp, updateUserProfile };
