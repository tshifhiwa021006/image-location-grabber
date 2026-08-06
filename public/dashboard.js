const map = L.map('map').setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const locationsList = document.getElementById('locationsList');

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString();
}

function addLocationItem(loc) {
  const li = document.createElement('li');
  li.innerHTML = `
    <strong>${loc.browser_info || 'Browser info unavailable'}</strong><br />
    ${loc.os_info || ''}<br />
    ${formatTimestamp(loc.timestamp)}<br />
    IP: ${loc.ip_address || 'N/A'}<br />
    Accuracy: ${loc.accuracy !== null ? loc.accuracy + ' m' : 'unknown'}
  `;
  locationsList.appendChild(li);
}

fetch('/locations')
  .then((res) => res.json())
  .then((locations) => {
    if (!Array.isArray(locations) || locations.length === 0) {
      locationsList.innerHTML = '<li>No shared locations yet.</li>';
      return;
    }

    locations.forEach((loc, index) => {
      L.marker([loc.latitude, loc.longitude]).addTo(map);
      addLocationItem(loc);
    });

    const first = locations[0];
    if (first) {
      map.setView([first.latitude, first.longitude], 10);
    }
  })
  .catch((err) => {
    locationsList.innerHTML = `<li>Unable to load locations: ${err.message}</li>`;
  });
