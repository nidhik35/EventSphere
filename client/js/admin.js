async function fetchEvents() {
  const listEl = document.getElementById('admin-events-list');
  const emptyEl = document.getElementById('admin-events-empty');

  try {
    const res = await fetch('/events');
    if (!res.ok) {
      throw new Error('Failed to load events');
    }
    const events = await res.json();

    listEl.innerHTML = '';

    if (!events || events.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    events.forEach((event) => {
      const card = document.createElement('article');
      card.className = 'card';

      const title = document.createElement('h3');
      title.textContent = event.title;

      const meta = document.createElement('p');
      const date = event.date ? new Date(event.date).toLocaleDateString() : '';
      meta.innerHTML = `<span class="tag">${date}</span> &nbsp; ${event.location || ''}`;

      const actions = document.createElement('div');

      const editBtn = document.createElement('button');
      editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
      editBtn.addEventListener('click', () => editEvent(event));

      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
      deleteBtn.style.marginLeft = '0.5rem';
      deleteBtn.addEventListener('click', () => deleteEvent(event._id));

      const registrationsBtn = document.createElement('button');
      registrationsBtn.innerHTML = '<i class="fas fa-users"></i> Registrations';
      registrationsBtn.style.marginLeft = '0.5rem';
      registrationsBtn.addEventListener('click', () => loadRegistrations(event));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(registrationsBtn);

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(actions);

      listEl.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    emptyEl.textContent = 'Unable to load events.';
    emptyEl.classList.remove('hidden');
  }
}

async function createEvent(e) {
  e.preventDefault();

  const titleEl = document.getElementById('title');
  const categoryEl = document.getElementById('category');
  const descriptionEl = document.getElementById('description');
  const dateEl = document.getElementById('date');
  const locationEl = document.getElementById('location');

  try {
    const res = await fetch('/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: titleEl.value,
        category: categoryEl.value,
        description: descriptionEl.value,
        date: dateEl.value,
        location: locationEl.value,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to create event');
    }

    titleEl.value = '';
    categoryEl.value = 'Academic Project';
    descriptionEl.value = '';
    dateEl.value = '';
    locationEl.value = '';

    await fetchEvents();
  } catch (err) {
    console.error(err);
    alert('Unable to create event.');
  }
}

async function editEvent(event) {
  const newTitle = window.prompt('Title', event.title);
  if (newTitle === null) return;
  const newCategory = window.prompt('Category (Academic Project / Workshop / Hackathon / Competition / Fest / Talk / General)', event.category || 'General');
  if (newCategory === null) return;
  const newDescription = window.prompt('Description', event.description);
  if (newDescription === null) return;
  const currentDate = event.date ? new Date(event.date).toISOString().substring(0, 10) : '';
  const newDate = window.prompt('Date (YYYY-MM-DD)', currentDate);
  if (newDate === null) return;
  const newLocation = window.prompt('Location', event.location || '');
  if (newLocation === null) return;

  try {
    const res = await fetch(`/events/${event._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: newTitle,
        category: newCategory,
        description: newDescription,
        date: newDate,
        location: newLocation,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to update event');
    }

    await fetchEvents();
  } catch (err) {
    console.error(err);
    alert('Unable to update event.');
  }
}

async function deleteEvent(id) {
  if (!window.confirm('Delete this event?')) {
    return;
  }

  try {
    const res = await fetch(`/events/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to delete event');
    }
    await fetchEvents();
  } catch (err) {
    console.error(err);
    alert('Unable to delete event.');
  }
}

async function loadRegistrations(event) {
  const infoEl = document.getElementById('registrations-info');
  const listEl = document.getElementById('registrations-list');

  infoEl.textContent = `Registrations for "${event.title}"`;
  listEl.innerHTML = '';

  try {
    const res = await fetch(`/registrations/${event._id}`);
    if (!res.ok) {
      throw new Error('Failed to load registrations');
    }
    const regs = await res.json();

    if (!regs || regs.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No registrations yet.';
      listEl.appendChild(li);
      return;
    }

    regs.forEach((reg) => {
      const li = document.createElement('li');
      const date = reg.timestamp ? new Date(reg.timestamp).toLocaleString() : '';
      li.textContent = `${reg.name} (${reg.email}) — ${date}`;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Unable to load registrations.';
    listEl.appendChild(li);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-event-form');
  form.addEventListener('submit', createEvent);
  fetchEvents();
});

