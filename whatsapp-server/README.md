# WhatsApp Integration for Fleet Management

A complete WhatsApp Web API integration built directly into the Fleet Management application using the same technology stack (Node.js + React + Supabase).

## Architecture

### Components

1. **WhatsApp Server** (`whatsapp-server/`)
   - Node.js/Express server running alongside the main app
   - Uses `@whiskeysockets/baileys` for WhatsApp Web API
   - Manages socket connections and session persistence
   - Exposes REST API endpoints for the frontend

2. **React UI** (`components/WhatsAppSection.tsx`)
   - Deterministic UI state machine
   - Reactive connection status
   - Clean one-state-per-renderer architecture

3. **Database** (`supabase/migrations/`)
   - `whatsapp_sessions` - Session management
   - `whatsapp_messages` - Message logging
   - `whatsapp_templates` - Message templates

## Setup Instructions

### 1. Database Migration

Run the SQL migration in Supabase:

```bash
# Copy the migration file content and run in Supabase SQL Editor
cat supabase/migrations/20260208_whatsapp_integration.sql
```

### 2. Install WhatsApp Server Dependencies

```bash
cd whatsapp-server
npm install
```

### 3. Configure Environment

Create `.env` file in `whatsapp-server/`:

```env
# Copy from .env.example and fill in your values
cp .env.example .env
```

Update your main `.env` file with:

```env
VITE_WHATSAPP_SERVER_URL=http://localhost:3001
```

### 4. Start the WhatsApp Server

```bash
cd whatsapp-server
npm start
```

The server will start on `http://localhost:3001`

### 5. Start the Main Application

```bash
npm run dev
```

## Usage

### Connecting a WhatsApp Session

1. Navigate to the WhatsApp section in the admin dashboard
2. Click "ربط جهاز واتساب" (Connect WhatsApp Device)
3. Scan the QR code with your phone:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices
   - Tap "Link a Device" and scan the QR code
4. The session will automatically connect

### State Flow

```
Initial Load → Check DB
             ↓
    No Sessions? → DISCONNECTED → Show "Connect" button
    Connected?   → CONNECTED → Show session cards

Click "Connect" → WAITING_QR → Show QR code
                → Scan QR → CONNECTED → Session active

Disconnect → DISCONNECTED → Show "Connect" button
Reconnect → RECONNECTING → WAITING_QR → CONNECTED
```

## API Endpoints

### Session Management

- `POST /api/sessions/init` - Initialize a new session
- `GET /api/sessions/:sessionId/qr` - Get QR code for a session
- `GET /api/sessions/:sessionId/status` - Get session connection status
- `POST /api/sessions/:sessionId/disconnect` - Disconnect a session
- `DELETE /api/sessions/:sessionId` - Delete a session
- `GET /api/sessions` - Get all sessions

### Messages

- `POST /api/messages/send` - Send a message

## UI State Machine

The UI uses a deterministic state machine with the following states:

| State | Description |
|-------|-------------|
| `loading` | Initial load, fetching data |
| `error` | Error occurred |
| `disconnected` | No connected sessions |
| `waiting_qr` | Waiting for QR scan |
| `connected` | At least one session connected |
| `reconnecting` | Reconnecting a session |

Each state has exactly one renderer function - no nested conditionals.

## File Structure

```
whatsapp-server/
├── src/
│   └── index.js          # Main server
├── auth/                 # Session auth storage (auto-created)
├── package.json
└── .env.example

components/
└── WhatsAppSection.tsx   # React UI component

supabase/migrations/
└── 20260208_whatsapp_integration.sql
```

## Troubleshooting

### Server won't start

- Ensure port 3001 is available
- Check that Supabase credentials are correct

### QR code not appearing

- Check the server logs for errors
- Ensure the WhatsApp server is running
- Check browser console for API errors

### Session disconnects frequently

- This is normal for WhatsApp Web API
- The session will need to be re-linked periodically
- Consider implementing auto-reconnect for production

## Production Deployment

For production deployment:

1. Deploy the WhatsApp server on a separate process (PM2, Docker, etc.)
2. Use environment variables for configuration
3. Ensure the server can persist auth files (use volume mounts for Docker)
4. Consider implementing proper logging and monitoring

## License

Same as the main Fleet Management application.
