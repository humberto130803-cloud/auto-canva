# Auto Canva — Real Estate Social Media Post Generator API

A Node.js API that generates professional real estate social media post images. Designed to be called by a Custom GPT via GPT Actions.

## Features

- **6 layouts**: Hero Single, Split Duo, Feature Trio, Grid Quad, Grid Six, Carousel Slides
- **5 post types**: New Listing, Open House, Just Sold, Price Drop, Coming Soon
- **6 color themes**: Dark, Light, Blue, Gold, Minimal, Custom
- **3 sizes**: Instagram Post (1080×1080), Instagram Story (1080×1920), Facebook Post (1200×630)
- **Agent branding** automatically added to every image from server config
- **Auto-cleanup** of generated images after 24 hours

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure agent info

Edit `config/agent.json` with your agent's information:

```json
{
  "name": "Your Name",
  "phone": "+507 1234-5678",
  "email": "you@email.com",
  "logo": "https://url-to-your-logo.png",
  "website": "www.yoursite.com",
  "brokerage": "Your Brokerage"
}
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
BASE_URL=http://localhost:3000
IMAGE_TTL_HOURS=24
```

### 4. Run the server

```bash
npm start
```

Development mode with auto-reload:

```bash
npm run dev
```

## API Endpoints

### `GET /` — Health check

### `GET /templates` — List available template options

Returns all layouts, post types, color themes, and sizes.

### `GET /templates/preview/:combo` — Preview a template

Generate a preview with sample data. Format: `layout_postType_colorTheme_size`

```
GET /templates/preview/hero-single_new-listing_dark_instagram-post
```

### `POST /generate` — Generate a post image

```json
{
  "template": {
    "layout": "hero-single",
    "postType": "new-listing",
    "colorTheme": "dark",
    "size": "instagram-post"
  },
  "property": {
    "title": "Luxury Ocean View Apartment",
    "price": "$350,000",
    "location": "Punta Pacifica, Panama City",
    "bedrooms": 3,
    "bathrooms": 2,
    "area": "185 m²",
    "features": ["Ocean View", "Pool", "Gym"],
    "photos": ["https://example.com/photo1.jpg"]
  }
}
```

Response:

```json
{
  "success": true,
  "type": "single",
  "url": "https://your-server.com/image/uuid-here.png"
}
```

### `GET /image/:filename` — Serve a generated image

## Deployment on Render

### Option A: Docker (Recommended)

1. Push this repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo
4. Render will auto-detect the `Dockerfile`
5. Set environment variables:
   - `BASE_URL` = your Render URL (e.g., `https://auto-canva.onrender.com`)
   - `PORT` = `3000`
   - `NODE_ENV` = `production`

### Option B: render.yaml (Blueprint)

The included `render.yaml` can be used with Render's Blueprint feature for automatic setup.

### Railway

1. Push to GitHub
2. Create new project on [Railway](https://railway.app)
3. Connect repo — Railway detects the Dockerfile
4. Set `BASE_URL` environment variable to your Railway URL

## GPT Actions Setup

1. In your Custom GPT, go to **Configure** → **Actions** → **Create new action**
2. Paste the contents of `openapi.yaml`
3. Update the server URL to your deployed API URL
4. Set the GPT's system prompt using `gpt-system-prompt.md`

## Template Combinations

Any layout × post type × color theme × size combination works:

- `hero-single` + `new-listing` + `dark` + `instagram-post`
- `grid-quad` + `just-sold` + `gold` + `instagram-story`
- `carousel-slides` + `open-house` + `light` + `instagram-post`
- etc. (180 total combinations, plus custom colors)

## Project Structure

```
auto-canva/
├── config/
│   └── agent.json          # Agent branding config
├── public/
│   └── images/
│       └── generated/      # Temp generated images (auto-cleaned)
├── src/
│   ├── routes/
│   │   ├── generate.js     # POST /generate
│   │   ├── image.js        # GET /image/:filename
│   │   └── templates.js    # GET /templates
│   ├── services/
│   │   ├── cleanup.js      # Cron job for old image deletion
│   │   ├── renderer.js     # Puppeteer rendering pipeline
│   │   └── templateEngine.js # HTML/CSS template generation
│   └── server.js           # Express app entry point
├── .env.example
├── Dockerfile
├── openapi.yaml            # OpenAPI spec for GPT Actions
├── gpt-system-prompt.md    # System prompt for Custom GPT
├── render.yaml             # Render deployment config
└── package.json
```
