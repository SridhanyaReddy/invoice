const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    logo: { type: String }, // Base64 or URL
}, { timestamps: true });

module.exports = mongoose.model('Organization', OrganizationSchema);
