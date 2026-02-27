async function loadEvents() {
  const listEl = document.getElementById('events-list');
  const emptyEl = document.getElementById('events-empty');

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

      const desc = document.createElement('p');
      desc.className = 'muted';
      desc.textContent = event.description;

      const meta = document.createElement('p');
      const date = event.date ? new Date(event.date).toLocaleDateString() : '';
      meta.innerHTML = `<span class="tag"><i class="fas fa-calendar-day"></i>${date}</span> &nbsp; ${event.location ? `<i class="fas fa-map-marker-alt"></i>${event.location}` : ''}`;

      const link = document.createElement('a');
      link.href = `event.html?id=${event._id}`;
      link.className = 'btn-link';
      link.innerHTML = '<i class="fas fa-info-circle"></i> View details';

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(meta);
      card.appendChild(link);

      listEl.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    emptyEl.textContent = 'Unable to load events. Please try again later.';
    emptyEl.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', loadEvents);

