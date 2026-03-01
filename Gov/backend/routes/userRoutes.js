const express = require('express');
const router = express.Router();
const { registerUser, loginUser, sendOtp, verifyOtp, updateUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', registerUser);
router.post('/login', loginUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.put('/profile', protect, updateUserProfile);

module.exports = router;
