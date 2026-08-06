# image-location-grabber

A consent-based location sharing demo using a browser frontend and Node.js backend.

## GitHub Pages Deployment

This project separates the static frontend from the Node.js backend.

1. Host the `public/` folder as your GitHub Pages site.
2. Deploy the Node.js backend from `server.js` on a separate server or platform.
3. Copy `public/config.example.js` to `public/config.js`.
4. Set the backend URL in `public/config.js`:

```js
window.API_BASE_URL = 'https://your-backend.example.com';
```

## Local development

1. Run `npm install`.
2. Run `npm start`.
3. Open `http://localhost:3000`.

## How it works

- The static page asks users for geolocation consent.
- After permission, the browser sends location data to the backend.
- The backend stores the location and streams updates to the dashboard.
- The dashboard shows the location on OpenStreetMap.
