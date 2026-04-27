const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');

// Get Organization details
router.get('/', async (req, res) => {
    try {
        const org = await Organization.findOne();
        res.json(org || {});
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Save or Update Organization details
router.post('/', async (req, res) => {
    try {
        let org = await Organization.findOne();
        if (org) {
            // Update
            Object.assign(org, req.body);
            await org.save();
        } else {
            // Create
            org = new Organization(req.body);
            await org.save();
        }
        res.json(org);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
