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
        console.log('Received organization update request');
        if (req.body.logo) {
            console.log('Logo data received, length:', req.body.logo.length);
        } else {
            console.log('No logo data in request');
        }

        let org = await Organization.findOne();
        if (org) {
            console.log('Updating existing organization');
            Object.assign(org, req.body);
            await org.save();
        } else {
            console.log('Creating new organization');
            org = new Organization(req.body);
            await org.save();
        }
        res.json(org);
    } catch (err) {
        console.error('Error saving organization:', err);
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
