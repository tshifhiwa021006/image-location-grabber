const shareButton = document.getElementById('shareButton');
const statusEl = document.getElementById('status');
const dashboardLink = document.getElementById('dashboardLink');
const dashboardLinkContainer = document.getElementById('dashboardLinkContainer');

function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform || 'unknown';
  const vendor = navigator.vendor || 'unknown';
  return `${userAgent} | ${platform} | ${vendor}`;
}

function parseOsInfo() {
  const userAgent = navigator.userAgent;
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown';
}

async function shareLocation() {
  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation is not supported by this browser.';
    return;
  }

  statusEl.textContent = 'Requesting location permission...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const payload = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        browserInfo: getBrowserInfo(),
        osInfo: parseOsInfo()
      };

      const savedToken = localStorage.getItem('dashboardToken');
      if (savedToken) {
        payload.sessionToken = savedToken;
      }

      statusEl.textContent = 'Sending location to server...';

      try {
        const baseUrl = window.API_BASE_URL || '';
        const response = await fetch(`${baseUrl}/share-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Server error');
        }

        localStorage.setItem('dashboardToken', result.token);
        const dashboardUrl = `dashboard.html?token=${encodeURIComponent(result.token)}`;
        dashboardLink.href = dashboardUrl;
        dashboardLinkContainer.classList.remove('hidden');

        statusEl.textContent = 'Location shared successfully. Open the dashboard to view live updates.';
      } catch (error) {
        dashboardLinkContainer.classList.add('hidden');
        statusEl.textContent = `Failed to share location: ${error.message}`;
      }
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        statusEl.textContent = 'Permission denied. Location not shared.';
      } else {
        statusEl.textContent = `Error retrieving location: ${error.message}`;
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

const initialToken = localStorage.getItem('dashboardToken');
if (initialToken) {
  dashboardLink.href = `dashboard.html?token=${encodeURIComponent(initialToken)}`;
  dashboardLinkContainer.classList.remove('hidden');
}

shareButton.addEventListener('click', shareLocation);
