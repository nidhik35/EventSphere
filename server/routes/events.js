const express = require('express');
const Event = require('../models/Event');

const router = express.Router();

// GET /events - list all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /events/:id - get event details
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /events - create event
router.post('/', async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    const event = new Event({
      title,
      description,
      date,
      location,
    });
    const saved = await event.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(400).json({ error: 'Failed to create event' });
  }
});

// PUT /events/:id - update event
router.put('/:id', async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { title, description, date, location },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(400).json({ error: 'Failed to update event' });
  }
});

// DELETE /events/:id - delete event
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;

