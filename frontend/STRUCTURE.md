# Frontend Directory Structure

```
frontend/
├── .env.example              # Supabase environment variables template
├── README.md                 # Setup and architecture documentation
├── STRUCTURE.md              # This file
├── package.json              # Project dependencies and scripts
├── vite.config.js            # Vite build configuration (proxies /api to backend)
├── index.html                # HTML entry point with Google Fonts
│
└── src/
    ├── main.jsx              # React DOM render entry point
    ├── App.jsx               # Main application component (474 lines)
    │                          # Contains all views, components, and styling:
    │                          # - Auth component (sign in/up)
    │                          # - WallEditor (add/edit/delete walls)
    │                          # - ApplianceEditor (configure appliances)
    │                          # - ResultsView (display solver output & quote)
    │                          # - TemplatePicker (browse templates)
    │                          # - Main App container with routing
    │
    └── lib/
        └── supabase.js       # Supabase client initialization
```

## Key Files

### package.json
- React 18, React Router 6
- Supabase JS SDK 2.39
- Vite 5 with React plugin
- Scripts: `dev`, `build`, `preview`

### vite.config.js
- Proxies `/api/*` to `http://localhost:8888` (backend)
- Builds to `../dist` directory

### index.html
- Sets up root React div
- Loads Google Fonts (Inter family)
- Imports main.jsx module

### src/App.jsx
Single-file component with all UI logic:
- **Auth Component**: Email/password sign-in and sign-up via Supabase
- **Room Designer**: 
  - Layout type selector (6 layouts)
  - Room type selector (5 types)
  - Wall editor (add/remove/configure walls)
  - Appliance editor (add/remove appliances, assign to walls)
- **Preferences Panel**:
  - Sophistication level (standard, high, very_high)
  - Ceiling height
  - Corner treatment (7 options)
  - Drawer base preference
- **Materials Panel**:
  - Wood species (6 options)
  - Door style (4 options)
  - Cabinet construction (3 options)
- **Results View**:
  - Summary stats (cabinet count, layout type, corners, total price)
  - Wall-by-wall layout visualization
  - Quote line items table (first 50)
  - Back button to designer
- **Templates View**:
  - Grid of room templates
  - Click to load template

### src/lib/supabase.js
- Creates Supabase client
- Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.local
- Exports singleton `supabase` instance

## Styling

All inline CSS using color constants:
- Dark theme: `#0f172a` background, `#1e293b` surfaces
- Blue primary: `#3b82f6`
- Emerald accent: `#10b981`
- Red danger: `#ef4444`
- Light text: `#f1f5f9`

## API Integration

Frontend expects backend at `http://localhost:8888`:

### POST /api/solve
Request:
```json
{
  "layoutType": "l-shape",
  "roomType": "kitchen",
  "walls": [{ "id": "A", "length": 156, "role": "range" }],
  "appliances": [{ "type": "range", "width": 30, "wall": "A" }],
  "prefs": { "sophistication": "standard", ... }
}
```
Response: `{ "layout": { "placements": [...] }, ... }`

### POST /api/quote
Same request structure as /solve, includes `materials` object.
Response includes `quote` with `lineItems` and `totalPrice`.

### GET /api/templates
Response: `{ "templates": [{ "id": "...", "name": "...", ... }] }`

### POST /api/templates
Request: `{ "templateId": "..." }`
Response: Template layout data

## Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with Supabase credentials
npm run dev
# Opens http://localhost:5173
```

## Build for Production

```bash
npm run build
# Output in ../dist
npm run preview  # Test build locally
```

## Auth Flow

1. User lands on page
2. `useEffect` in App checks `supabase.auth.getUser()`
3. If not authenticated, show Auth component
4. User enters email/password, clicks Sign In or Sign Up
5. Supabase handles auth, returns user object
6. App component receives user and renders designer
7. Header shows user email with Sign Out button
8. Sign Out calls `supabase.auth.signOut()`

## State Management

All state in App component (no Redux/Zustand):
- `layoutType`, `roomType` - Current selections
- `walls`, `appliances` - Room configuration
- `prefs`, `materials` - Design preferences
- `layout`, `quote` - Solver results
- `view` - Current page (designer, templates, results)
- `solving` - Loading state
- `error` - Error messages

## Component Exports

App.jsx contains:
- `Auth(props)` - Auth form
- `WallEditor(props)` - Wall management
- `ApplianceEditor(props)` - Appliance management
- `ResultsView(props)` - Results display
- `TemplatePicker(props)` - Template gallery
- `App()` - Main container (default export)
