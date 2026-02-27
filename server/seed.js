const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Event = require('./models/Event');
const Registration = require('./models/Registration');

async function seed() {
  try {
    dotenv.config();

    const MONGO_URL = process.env.MONGO_URL;

    if (!MONGO_URL) {
      console.error('MONGO_URL environment variable is not set.');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB for seeding');

    await Registration.deleteMany({});
    await Event.deleteMany({});

    const eventsData = [
      {
        title: 'Robotics Challenge 2026',
        description: 'Build and program autonomous robots to complete obstacle courses and tasks.',
        date: new Date('2026-03-10'),
        location: 'Mechanical Engineering Block Auditorium',
      },
      {
        title: 'AI & Machine Learning Hackathon',
        description: '24-hour hackathon focused on real-world AI and ML problem statements.',
        date: new Date('2026-03-11'),
        location: 'Computer Science Innovation Lab',
      },
      {
        title: 'IoT for Smart Campus Workshop',
        description: 'Hands-on workshop building IoT prototypes for smarter campus infrastructure.',
        date: new Date('2026-03-12'),
        location: 'Electronics Lab 2',
      },
      {
        title: 'Coding Marathon - Algorithms & Data Structures',
        description: 'Intense competitive programming contest for algorithm enthusiasts.',
        date: new Date('2026-03-13'),
        location: 'Main Seminar Hall',
      },
      {
        title: 'Tech Expo: Future of Engineering',
        description: 'Exhibition of student projects in robotics, AI, IoT, and sustainable tech.',
        date: new Date('2026-03-14'),
        location: 'Central Expo Ground',
      },
      {
        title: 'Blockchain & Smart Contracts Workshop',
        description: 'Introduction to blockchain fundamentals and hands-on smart contracts development.',
        date: new Date('2026-03-15'),
        location: 'Distributed Systems Lab',
      },
      {
        title: 'UI/UX Design Sprint',
        description: 'Collaborative 6-hour sprint to prototype user interfaces for campus apps.',
        date: new Date('2026-03-16'),
        location: 'Design Studio 1',
      },
      {
        title: 'Cybersecurity CTF (Capture The Flag)',
        description: 'Team-based security challenge with beginner to advanced puzzles.',
        date: new Date('2026-03-17'),
        location: 'Cyber Lab',
      },
      {
        title: 'Startup Pitch Night',
        description: 'Student startups pitch to a panel of judges and mentors.',
        date: new Date('2026-03-18'),
        location: 'Auditorium B',
      },
      {
        title: 'Sustainability in Tech Panel',
        description: 'Discussion on sustainable engineering practices and green tech initiatives.',
        date: new Date('2026-03-19'),
        location: 'Conference Room 3',
      },
    ];

    const events = await Event.insertMany(eventsData);
    console.log(`Inserted ${events.length} tech fest events.`);

    const sampleRegistrations = [
      {
        eventId: events[0]._id,
        name: 'Alice Johnson',
        email: 'alice@example.com',
      },
      {
        eventId: events[1]._id,
        name: 'Rahul Verma',
        email: 'rahul@example.com',
      },
      {
        eventId: events[2]._id,
        name: 'Mei Chen',
        email: 'mei@example.com',
      },
      {
        eventId: events[5]._id,
        name: 'Carlos Mendes',
        email: 'carlos@example.com',
      },
      {
        eventId: events[6]._id,
        name: 'Priya Singh',
        email: 'priya@example.com',
      },
      {
        eventId: events[8]._id,
        name: 'Liam O\'Connor',
        email: 'liam@example.com',
      },
    ];

    await Registration.insertMany(sampleRegistrations);
    console.log(`Inserted ${sampleRegistrations.length} sample registrations.`);
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Seeding complete.');
    process.exit(0);
  }
}

seed();

