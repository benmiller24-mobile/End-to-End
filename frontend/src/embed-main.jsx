// Standalone entry for the consumer-facing render embed (iframed by the FAKS /
// Showroom Atlas site). No wizard, no dealer chrome — just the floor plan,
// elevations, 3D, and AI rendering for a URL-encoded design spec.
import React from 'react';
import ReactDOM from 'react-dom/client';
import EmbedApp from './EmbedApp.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<EmbedApp />);
