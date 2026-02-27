const express = require('express');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

const router = express.Router();

// POST /register/:eventId - register for an event
router.post('/register/:eventId', async (req, res) => {
  try {
    const { name, email } = req.body;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const registration = new Registration({
      eventId,
      name,
      email,
    });

    const saved = await registration.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating registration:', err);
    res.status(400).json({ error: 'Failed to register for event' });
  }
});

// GET /registrations/:eventId - list registrations for an event
router.get('/registrations/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const registrations = await Registration.find({ eventId }).sort({ timestamp: -1 });
    res.json(registrations);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

module.exports = router;

