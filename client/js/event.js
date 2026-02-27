function getEventIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadEventDetails() {
  const eventId = getEventIdFromQuery();
  if (!eventId) {
    return;
  }

  const titleEl = document.getElementById('event-title');
  const descEl = document.getElementById('event-description');
  const dateEl = document.getElementById('event-date');
  const locationEl = document.getElementById('event-location');

  try {
    const res = await fetch(`/events/${eventId}`);
    if (!res.ok) {
      throw new Error('Failed to load event');
    }
    const event = await res.json();

    titleEl.textContent = event.title;
    descEl.textContent = event.description;
    dateEl.textContent = event.date ? new Date(event.date).toLocaleDateString() : '';
    locationEl.textContent = event.location || '';
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Unable to load event';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const eventId = getEventIdFromQuery();
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageEl = document.getElementById('register-message');

  messageEl.textContent = '';

  if (!eventId) {
    messageEl.textContent = 'Invalid event.';
    return;
  }

  try {
    const res = await fetch(`/register/${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: nameInput.value,
        email: emailInput.value,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const msg = errorBody.error || 'Failed to register.';
      throw new Error(msg);
    }

    messageEl.textContent = 'Registration successful. Thank you!';
    nameInput.value = '';
    emailInput.value = '';
  } catch (err) {
    console.error(err);
    messageEl.textContent = err.message || 'Registration failed.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadEventDetails();
  const form = document.getElementById('register-form');
  form.addEventListener('submit', handleRegister);
});

