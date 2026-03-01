const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    adharNumber: {
      type: String,
      required: true,
      unique: true,
    },
    citizenId: {
      type: String,
      unique: true,
      sparse: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      required: true,
      enum: ['citizen', 'officer', 'admin'],
      default: 'citizen',
    },
    department: {
      type: String,
      enum: ['Road', 'Electricity', 'Sewage', 'Garbage', 'Water Supply', 'None'],
      default: 'None',
    },
    permissions: {
      canRead: {
        type: Boolean,
        default: true,
      },
      canWrite: {
        type: Boolean,
        default: true,
      },
      canDelete: {
        type: Boolean,
        default: false,
      },
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
