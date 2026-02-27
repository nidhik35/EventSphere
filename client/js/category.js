function getCategoryFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('category') || 'all';
}

let categoryEvents = [];

async function loadCategoryEvents() {
  const category = getCategoryFromQuery();
  const headingEl = document.getElementById('category-heading');
  const listEl = document.getElementById('category-events-list');
  const emptyEl = document.getElementById('category-events-empty');
  const tabs = document.querySelectorAll('.tab-button');

  // Update heading
  if (category === 'all') {
    headingEl.textContent = 'All Events';
  } else {
    headingEl.textContent = `${category} Events`;
  }

  // Highlight active tab
  tabs.forEach((tab) => {
    const href = tab.getAttribute('href') || '';
    if (category === 'all' && href.endsWith('index.html')) {
      tab.classList.add('active');
    } else if (href.includes(`category=${encodeURIComponent(category)}`)) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  try {
    const res = await fetch('/events');
    if (!res.ok) {
      throw new Error('Failed to load events');
    }
    const events = await res.json();

    categoryEvents =
      category === 'all'
        ? events
        : events.filter((event) => (event.category || 'General') === category);

    renderCategoryEvents('');
  } catch (err) {
    console.error(err);
    emptyEl.textContent = 'Unable to load events. Please try again later.';
    emptyEl.classList.remove('hidden');
  }
}

function renderCategoryEvents(query) {
  const listEl = document.getElementById('category-events-list');
  const emptyEl = document.getElementById('category-events-empty');

  listEl.innerHTML = '';

  if (!categoryEvents || categoryEvents.length === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  const normalized = (query || '').trim().toLowerCase();
  const filtered = normalized
    ? categoryEvents.filter((event) => {
        const haystack = `${event.title} ${event.description} ${event.location} ${event.category || ''}`.toLowerCase();
        return haystack.includes(normalized);
      })
    : categoryEvents;

  if (!filtered.length) {
    emptyEl.textContent = 'No events match your search in this category.';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  filtered.forEach((event) => {
    listEl.appendChild(createCategoryEventCard(event));
  });
}

function createCategoryEventCard(event) {
  const card = document.createElement('article');
  card.className = 'card';

  const title = document.createElement('h3');
  title.textContent = event.title;

  const desc = document.createElement('p');
  desc.className = 'muted';
  desc.textContent = event.description;

  const meta = document.createElement('p');
  const date = event.date ? new Date(event.date).toLocaleDateString() : '';
  const category = event.category || 'General';
  meta.innerHTML = `<span class="tag"><i class="fas fa-layer-group"></i>${category}</span> &nbsp; <span class="tag"><i class="fas fa-calendar-day"></i>${date}</span> &nbsp; ${
    event.location ? `<i class="fas fa-map-marker-alt"></i>${event.location}` : ''
  }`;

  const link = document.createElement('a');
  link.href = `event.html?id=${event._id}`;
  link.className = 'btn-link';
  link.innerHTML = '<i class="fas fa-info-circle"></i> View details';

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(meta);
  card.appendChild(link);

  return card;
}

document.addEventListener('DOMContentLoaded', () => {
  loadCategoryEvents();
  const searchInput = document.getElementById('category-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderCategoryEvents(e.target.value);
    });
  }
});

