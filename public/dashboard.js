const map = L.map('map').setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const locationsList = document.getElementById('locationsList');
const tokenDisplay = document.getElementById('tokenDisplay');
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

if (!token) {
  locationsList.innerHTML = '<li>Missing dashboard token. Open this page with a valid token.</li>';
}

if (tokenDisplay) {
  tokenDisplay.textContent = token ? `Dashboard token: ${token}` : '';
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString();
}

function addLocationItem(loc, prepend = false) {
  const li = document.createElement('li');
  li.innerHTML = `
    <strong>${loc.browser_info || 'Browser info unavailable'}</strong><br />
    ${loc.os_info || ''}<br />
    ${formatTimestamp(loc.timestamp)}<br />
    IP: ${loc.ip_address || 'N/A'}<br />
    Accuracy: ${loc.accuracy !== null ? loc.accuracy + ' m' : 'unknown'}
  `;
  if (prepend && locationsList.firstChild) {
    locationsList.insertBefore(li, locationsList.firstChild);
  } else {
    locationsList.appendChild(li);
  }
}

function renderLocation(loc, prepend = false) {
  L.marker([loc.latitude, loc.longitude]).addTo(map);
  addLocationItem(loc, prepend);
}

if (token) {
  const baseUrl = window.API_BASE_URL || '';
  fetch(`${baseUrl}/locations?token=${encodeURIComponent(token)}`)
    .then((res) => res.json())
    .then((locations) => {
      if (!Array.isArray(locations) || locations.length === 0) {
        locationsList.innerHTML = '<li>No shared locations yet.</li>';
        return;
      }

      locations.forEach((loc) => {
        renderLocation(loc);
      });

      const first = locations[0];
      if (first) {
        map.setView([first.latitude, first.longitude], 10);
      }
    })
    .catch((err) => {
      locationsList.innerHTML = `<li>Unable to load locations: ${err.message}</li>`;
    });

  const eventSource = new EventSource(`${baseUrl}/stream-locations?token=${encodeURIComponent(token)}`);
  eventSource.onmessage = (event) => {
    try {
      const loc = JSON.parse(event.data);
      renderLocation(loc, true);
      map.setView([loc.latitude, loc.longitude], 10);
    } catch (error) {
      console.error('Invalid SSE payload', error);
    }
  };

  eventSource.onerror = () => {
    console.warn('Live updates paused or unavailable.');
  };
} else {
  map.setView([20, 0], 2);
}
