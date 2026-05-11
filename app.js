const DB_NAME = 'PinMyTripsDB';
const STORE_NAME = 'places';
const THEME_KEY = 'pinmytrips-theme';

const refs = {
  panel: document.getElementById('panel'),
  placesList: document.getElementById('placesList'),
  detailPanel: document.getElementById('detailPanel'),
  detailCover: document.getElementById('detailCover'),
  detailBody: document.getElementById('detailBody'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  placeForm: document.getElementById('placeForm'),
  search: document.getElementById('search'),
  importFile: document.getElementById('importFile'),
  themeButton: document.getElementById('themeButton'),
  exportButton: document.getElementById('exportButton'),
  addPlaceButton: document.getElementById('addPlaceButton'),
  closeModalButton: document.getElementById('closeModalButton'),
  closeDetailButton: document.getElementById('closeDetailButton'),
  deleteButton: document.getElementById('btnDelete'),
  modalTitle: document.getElementById('modalTitle'),
  formFields: {
    id: document.getElementById('f_id'),
    title: document.getElementById('f_title'),
    country: document.getElementById('f_country'),
    dates: document.getElementById('f_dates'),
    budget: document.getElementById('f_budget'),
    rating: document.getElementById('f_rating'),
    fav: document.getElementById('f_fav'),
    lat: document.getElementById('f_lat'),
    lng: document.getElementById('f_lng'),
    spots: document.getElementById('f_spots'),
    notes: document.getElementById('f_notes'),
    photo: document.getElementById('f_photo'),
    photoB64: document.getElementById('f_photo_b64'),
  }
};

let places = [];
const map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
const markers = L.layerGroup().addTo(map);

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = event => {
    event.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const requestToPromise = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const getStore = async (mode = 'readonly') => {
  const db = await dbPromise;
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
};

async function getAllPlaces() {
  const store = await getStore();
  const all = await requestToPromise(store.getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

async function savePlace(place) {
  const store = await getStore('readwrite');
  await requestToPromise(store.put(place));
}

async function deletePlace(id) {
  const store = await getStore('readwrite');
  await requestToPromise(store.delete(id));
}

function getSavedTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function createIcon(isFav) {
  return L.divIcon({
    html: `<div class="marker-pin" style="background:${isFav ? 'var(--color-secondary)' : 'var(--color-primary)'}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    className: ''
  });
}

function formatStars(count) {
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

function getSearchTerm() {
  return refs.search.value.trim().toLowerCase();
}

function filterPlaces() {
  const term = getSearchTerm();
  if (!term) return places;
  return places.filter(place => {
    const haystack = [place.title, place.country, place.dates, place.notes, ...(place.spots || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

function renderList() {
  const filtered = filterPlaces();
  const fragment = document.createDocumentFragment();

  filtered.forEach(place => {
    const card = document.createElement('article');
    card.className = 'place-card';
    card.tabIndex = 0;
    card.innerHTML = `
      ${place.photo ? `<div class="cover" style="background-image:url('${place.photo}')"></div>` : ''}
      <div class="place-head">
        <div>
          <div class="place-title">${place.title} ${place.fav ? '<i data-feather="heart" class="fav-icon" width="16"></i>' : ''}</div>
          <div class="place-sub">${place.country} · ${place.dates || 'Sans date'}</div>
        </div>
        <div class="stars">${formatStars(place.rating)}</div>
      </div>`;

    card.addEventListener('click', () => focusPlace(place.id));
    card.addEventListener('keypress', event => {
      if (event.key === 'Enter') focusPlace(place.id);
    });
    fragment.appendChild(card);
  });

  refs.placesList.innerHTML = '';
  refs.placesList.appendChild(fragment);
  lucide.createIcons();
}

function renderMap() {
  markers.clearLayers();
  const bounds = [];

  places.forEach(place => {
    const marker = L.marker([place.lat, place.lng], { icon: createIcon(place.fav) }).addTo(markers);
    marker.on('click', () => focusPlace(place.id));
    bounds.push([place.lat, place.lng]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 10);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function hideDetail() {
  refs.detailPanel.classList.remove('show');
  refs.detailPanel.setAttribute('aria-hidden', 'true');
}

function showDetail() {
  refs.detailPanel.classList.add('show');
  refs.detailPanel.setAttribute('aria-hidden', 'false');
}

function focusPlace(id) {
  const place = places.find(item => item.id === id);
  if (!place) return;
  map.setView([place.lat, place.lng], 10);

  refs.detailCover.style.backgroundImage = place.photo ? `url('${place.photo}')` : 'none';
  refs.detailCover.style.display = place.photo ? 'block' : 'none';

  refs.detailBody.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start">
      <h2 class="detail-title">${place.title}</h2>
      <button type="button" class="btn-icon" id="editPlaceButton" aria-label="Modifier"><i data-feather="edit"></i></button>
    </div>
    <div class="detail-meta">${place.country} · ${place.dates || '?'} ${place.budget ? `· ${place.budget}€` : ''}</div>
    <div style="margin-bottom:1rem;color:var(--color-star)">${formatStars(place.rating)}</div>
    <div class="grid-2">
      <div class="data-box"><span>Adresses</span>${place.spots?.length ? place.spots.join('<br>') : '-'}</div>
      <div class="data-box"><span>Notes</span>${place.notes || '-'}</div>
    </div>`;

  const editButton = refs.detailBody.querySelector('#editPlaceButton');
  if (editButton) editButton.addEventListener('click', () => openModal(place.id));

  showDetail();
  if (window.innerWidth <= 900) refs.panel.classList.add('hidden');
  lucide.createIcons();
}

function closeModal() {
  refs.modalBackdrop.classList.remove('open');
  refs.modalBackdrop.setAttribute('aria-hidden', 'true');
  refs.placeForm.reset();
  refs.formFields.photoB64.value = '';
  refs.deleteButton.style.display = 'none';
}

function openModal(placeId = null) {
  const place = placeId ? places.find(item => item.id === placeId) : null;
  refs.modalTitle.textContent = place ? "Modifier l'étape" : 'Ajouter une étape';
  refs.modalBackdrop.classList.add('open');
  refs.modalBackdrop.setAttribute('aria-hidden', 'false');

  if (!place) {
    refs.placeForm.reset();
    refs.formFields.photoB64.value = '';
    refs.deleteButton.style.display = 'none';
    refs.formFields.id.value = '';
    return;
  }

  refs.formFields.id.value = place.id;
  refs.formFields.title.value = place.title;
  refs.formFields.country.value = place.country;
  refs.formFields.dates.value = place.dates || '';
  refs.formFields.budget.value = place.budget || '';
  refs.formFields.rating.value = place.rating || 3;
  refs.formFields.fav.checked = !!place.fav;
  refs.formFields.lat.value = place.lat;
  refs.formFields.lng.value = place.lng;
  refs.formFields.spots.value = (place.spots || []).join(', ');
  refs.formFields.notes.value = place.notes || '';
  refs.formFields.photoB64.value = place.photo || '';
  refs.deleteButton.style.display = 'inline-flex';
}

function parsePlaceForm() {
  return {
    id: refs.formFields.id.value || crypto.randomUUID(),
    title: refs.formFields.title.value.trim(),
    country: refs.formFields.country.value.trim(),
    dates: refs.formFields.dates.value.trim(),
    budget: Number(refs.formFields.budget.value) || 0,
    rating: Number(refs.formFields.rating.value) || 3,
    fav: refs.formFields.fav.checked,
    lat: Number(refs.formFields.lat.value),
    lng: Number(refs.formFields.lng.value),
    spots: refs.formFields.spots.value.split(',').map(item => item.trim()).filter(Boolean),
    notes: refs.formFields.notes.value.trim(),
    photo: refs.formFields.photoB64.value || '',
    createdAt: Date.now()
  };
}

async function saveCurrentPlace(event) {
  event.preventDefault();
  const place = parsePlaceForm();

  if (!place.title || !place.country || Number.isNaN(place.lat) || Number.isNaN(place.lng)) {
    alert('Veuillez renseigner le lieu, le pays, la latitude et la longitude.');
    return;
  }

  const existing = places.find(item => item.id === place.id);
  place.createdAt = existing?.createdAt || place.createdAt;
  await savePlace(place);
  await refreshPlaces();
  closeModal();
  hideDetail();
}

async function deleteCurrentPlace() {
  const id = refs.formFields.id.value;
  if (!id || !confirm('Supprimer définitivement cette étape ?')) return;
  await deletePlace(id);
  await refreshPlaces();
  closeModal();
  hideDetail();
}

function exportData() {
  const blob = new Blob([JSON.stringify(places, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pinmytrips-backup.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Format invalide');
    const operations = imported.map(async item => {
      if (!item.id) item.id = crypto.randomUUID();
      item.createdAt = item.createdAt || Date.now();
      await savePlace(item);
    });
    await Promise.all(operations);
    await refreshPlaces();
    alert('Import réussi !');
  } catch (error) {
    console.error(error);
    alert('Fichier invalide.');
  } finally {
    event.target.value = '';
  }
}

function toggleTheme() {
  const current = getSavedTheme();
  applyTheme(current === 'light' ? 'dark' : 'light');
}

function switchTab(tab) {
  const activeClass = 'active';
  const items = Array.from(document.querySelectorAll('.nav-item'));
  if (tab === 'list') {
    refs.panel.classList.remove('hidden');
    items.forEach((item, index) => item.classList.toggle(activeClass, index === 0));
  } else {
    refs.panel.classList.add('hidden');
    items.forEach((item, index) => item.classList.toggle(activeClass, index === 1));
  }
}

async function refreshPlaces() {
  places = await getAllPlaces();
  renderList();
  renderMap();
}

function setupListeners() {
  refs.search.addEventListener('input', renderList);
  refs.importFile.addEventListener('change', importData);
  refs.themeButton.addEventListener('click', toggleTheme);
  refs.exportButton.addEventListener('click', exportData);
  refs.addPlaceButton.addEventListener('click', () => openModal());
  refs.closeModalButton.addEventListener('click', closeModal);
  refs.closeDetailButton.addEventListener('click', hideDetail);
  refs.deleteButton.addEventListener('click', deleteCurrentPlace);
  refs.placeForm.addEventListener('submit', saveCurrentPlace);
  refs.modalBackdrop.addEventListener('click', event => {
    if (event.target === refs.modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });
}

async function init() {
  applyTheme(getSavedTheme());
  setupListeners();
  places = await getAllPlaces();

  if (!places.length) {
    const demo = {
      id: crypto.randomUUID(),
      title: 'Kyoto',
      country: 'Japon',
      lat: 35.0116,
      lng: 135.7681,
      dates: 'Octobre 2025',
      budget: 1200,
      rating: 5,
      fav: true,
      spots: ['Fushimi Inari', 'Gion'],
      notes: 'Incroyable atmosphère.',
      photo: '',
      createdAt: Date.now()
    };
    await savePlace(demo);
    places = await getAllPlaces();
  }

  renderList();
  renderMap();
  lucide.createIcons();
}

init();
