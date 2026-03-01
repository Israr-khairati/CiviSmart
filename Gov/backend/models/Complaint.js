const mongoose = require('mongoose');

const complaintSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    complaintId: {
      type: String,
      unique: true,
    },
    category: {
      type: String,
      required: [true, 'Please add a category'],
      enum: ['Road', 'Electricity', 'Garbage', 'Sewage', 'Water Supply', 'Other Issue'],
    },
    description: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: [true, 'Please add an address'],
    },
    location: {
      latitude: {
        type: Number,
        required: false,
      },
      longitude: {
        type: Number,
        required: false,
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'In Progress', 'Resolved'],
      default: 'Pending',
    },
    priority: {
      type: String,
      required: true,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    aiPriorityReasoning: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: false,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    isAuthentic: {
      type: Boolean,
      default: false,
    },
    authenticityScore: {
      type: Number,
      default: 0,
    },
    resolvedImage: {
      type: String,
      required: false,
    },
    isDuplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },
    reRaisedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
    },
    aiRecommendations: [
      {
        type: String,
      },
    ],
    detectedLanguage: {
      type: String,
      default: 'English',
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      comment: {
        type: String,
        default: null
      },
      submittedAt: {
        type: Date,
        default: null
      }
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);
