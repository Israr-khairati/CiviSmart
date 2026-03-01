const express = require('express');
const router = express.Router();
const {
  getComplaints,
  createComplaint,
  getPublicComplaints,
  getAllComplaints,
  updateComplaintStatus,
  deleteComplaint,
  getComplaintHotspots,
  submitFeedback,
  transcribeVoice
} = require('../controllers/complaintController');
const { protect, officer, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/').get(protect, getComplaints).post(protect, upload.single('image'), createComplaint);
router.route('/public').get(getPublicComplaints);
router.route('/admin/all').get(protect, officer, getAllComplaints);
router.route('/voice-transcribe').post(protect, upload.single('audio'), transcribeVoice);
router.route('/hotspots').get(protect, officer, getComplaintHotspots);
router.route('/:id/status').put(protect, officer, upload.single('resolvedImage'), updateComplaintStatus);
router.route('/:id/feedback').post(protect, submitFeedback);
router.route('/:id').delete(protect, officer, deleteComplaint);

module.exports = router;
