const express = require('express');
const router = express.Router();
const { 
  addOfficer, 
  getOfficers, 
  resetOfficerPassword,
  updateOfficer,
  deleteOfficer,
  getAnalytics
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/analytics').get(protect, admin, getAnalytics);

router.route('/officers')
  .post(protect, admin, addOfficer)
  .get(protect, admin, getOfficers);

router.route('/officers/:id')
  .put(protect, admin, updateOfficer)
  .delete(protect, admin, deleteOfficer);

router.put('/officers/:id/reset-password', protect, admin, resetOfficerPassword);

module.exports = router;
