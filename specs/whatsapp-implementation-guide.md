# 🚀 WhatsApp Integration - Implementation Guide

## 📋 جدول المحتويات

1. [Prerequisites](#prerequisites)
2. [Phase 1: Database Setup](#phase-1-database-setup)
3. [Phase 2: WhatsApp Microservice](#phase-2-whatsapp-microservice)
4. [Phase 3: Supabase Edge Functions](#phase-3-supabase-edge-functions)
5. [Phase 4: Frontend Integration](#phase-4-frontend-integration)
6. [Phase 5: Testing](#phase-5-testing)
7. [Phase 6: Deployment](#phase-6-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Services
- ✅ Supabase project (existing)
- ✅ Render.com account (or Railway/Fly.io)
- ✅ GitHub repository
- ✅ WhatsApp Business account (optional, personal works too)

### Development Environment
```bash
# Node.js version
node --version  # v18+ required

# Install global tools
npm install -g supabase
npm install -g typescript
```

---

## Phase 1: Database Setup

### Step 1.1: Run Migration

```bash
# Navigate to project root
cd c:/Users/amin/Desktop/copy-of-مدير-الأسطول---enterprise-saas

# Apply migration to Supabase
supabase db push

# Or manually via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy content from supabase/migrations/20260207_whatsapp_integration.sql
# 3. Run the script
```

### Step 1.2: Verify Tables Created

```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'whatsapp%';

-- Expected output:
-- whatsapp_sessions
-- whatsapp_messages
-- whatsapp_templates
-- whatsapp_audit_logs
```

### Step 1.3: Verify Default Templates

```sql
SELECT name, category, is_system 
FROM whatsapp_templates 
WHERE is_system = true;

-- Should return 4 system templates:
-- trial_welcome
-- subscription_expiring
-- subscription_activated
-- payment_reminder
```

### Step 1.4: Test RLS Policies

```sql
-- Test as authenticated user
SET ROLE authenticated;
SET request.jwt.claims.sub = '<your-user-id>';

-- Should only see your org's session
SELECT * FROM whatsapp_sessions;

-- Reset
RESET ROLE;
```

---

## Phase 2: WhatsApp Microservice

### Step 2.1: Create Project Structure

```bash
# Create new directory for WhatsApp service
mkdir whatsapp-service
cd whatsapp-service

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express @whiskeysockets/baileys @supabase/supabase-js
npm install cors dotenv helmet express-rate-limit
npm install qrcode-terminal

# Install dev dependencies
npm install -D typescript @types/node @types/express
npm install -D @types/cors nodemon ts-node
```

### Step 2.2: Create TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 2.3: Create Environment File

```bash
# .env
NODE_ENV=development
PORT=3001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Security
JWT_SECRET=your-jwt-secret-here
ALLOWED_ORIGINS=http://localhost:5173,https://myfleet.app

# Monitoring (optional)
SENTRY_DSN=
```

### Step 2.4: Implement useSupabaseAuthState

```typescript
// src/lib/useSupabaseAuthState.ts
import { 
  AuthenticationState, 
  initAuthCreds, 
  BufferJSON,
  proto
} from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SupabaseAuthStateOptions {
  orgId: string;
  sessionId: string;
}

export const useSupabaseAuthState = async (
  options: SupabaseAuthStateOptions
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> => {
  const { orgId, sessionId } = options;

  console.log(`[${orgId}] Loading auth state from Supabase...`);

  // Load existing auth state from Supabase
  const { data: session, error } = await supabase
    .from('whatsapp_sessions')
    .select('auth_state')
    .eq('id', sessionId)
    .eq('org_id', orgId)
    .single();

  let authState: AuthenticationState;

  if (error || !session?.auth_state) {
    console.log(`[${orgId}] No existing state, initializing new credentials`);
    authState = initAuthCreds();
  } else {
    console.log(`[${orgId}] Loading existing auth state from database`);
    // Parse with BufferJSON to handle Buffer objects
    authState = JSON.parse(
      JSON.stringify(session.auth_state),
      BufferJSON.reviver
    );
  }

  /**
   * Save credentials to Supabase whenever they change
   * This is called automatically by Baileys on creds.update event
   */
  const saveCreds = async () => {
    try {
      console.log(`[${orgId}] Saving auth state to Supabase...`);

      // Serialize with BufferJSON to handle Buffer objects
      const serialized = JSON.stringify(authState, BufferJSON.replacer);

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('whatsapp_sessions')
        .update({
          auth_state: JSON.parse(serialized),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('org_id', orgId);

      if (updateError) {
        console.error(`[${orgId}] Failed to save auth state:`, updateError);
        throw updateError;
      }

      console.log(`[${orgId}] Auth state saved successfully`);
    } catch (err) {
      console.error(`[${orgId}] Error saving credentials:`, err);
      throw err;
    }
  };

  return {
    state: authState,
    saveCreds
  };
};
```

### Step 2.5: Implement Session Manager

```typescript
// src/lib/sessionManager.ts
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { useSupabaseAuthState } from './useSupabaseAuthState';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Store active sessions in memory
const activeSessions = new Map<string, WASocket>();

export const createWhatsAppSession = async (
  orgId: string,
  sessionId: string
): Promise<WASocket> => {
  console.log(`[${orgId}] Creating WhatsApp session...`);

  // Check if session already exists
  if (activeSessions.has(orgId)) {
    console.log(`[${orgId}] Session already exists, returning existing`);
    return activeSessions.get(orgId)!;
  }

  // Load auth state from Supabase
  const { state, saveCreds } = await useSupabaseAuthState({ orgId, sessionId });

  // Create Baileys socket
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['MyFleet Pro', 'Chrome', '10.0'],
    defaultQueryTimeoutMs: undefined,
  });

  // Listen for credential updates
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    console.log(`[${orgId}] Connection update:`, { connection, qr: !!qr });

    // QR code generated
    if (qr) {
      console.log(`[${orgId}] QR code generated`);
      
      await supabase
        .from('whatsapp_sessions')
        .update({
          qr_code: qr,
          qr_expires_at: new Date(Date.now() + 60000).toISOString(),
          status: 'qr_pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Log audit event
      await supabase.from('whatsapp_audit_logs').insert({
        org_id: orgId,
        session_id: sessionId,
        event_type: 'qr_generated',
        event_data: { timestamp: new Date().toISOString() }
      });
    }

    // Connection closed
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[${orgId}] Connection closed. Should reconnect:`, shouldReconnect);

      if (shouldReconnect) {
        console.log(`[${orgId}] Reconnecting...`);
        await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'connecting',
            retry_count: supabase.rpc('increment', { x: 1 }),
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        // Reconnect after delay
        setTimeout(() => createWhatsAppSession(orgId, sessionId), 3000);
      } else {
        console.log(`[${orgId}] Logged out, not reconnecting`);
        activeSessions.delete(orgId);
        
        await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'disconnected',
            last_disconnected_at: new Date().toISOString(),
            qr_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        // Log audit event
        await supabase.from('whatsapp_audit_logs').insert({
          org_id: orgId,
          session_id: sessionId,
          event_type: 'session_disconnected',
          event_data: { reason: 'logged_out' }
        });
      }
    }

    // Connection opened
    if (connection === 'open') {
      console.log(`[${orgId}] Connected successfully!`);

      // Get WhatsApp account info
      const info = sock.user;

      await supabase
        .from('whatsapp_sessions')
        .update({
          status: 'connected',
          phone_number: info?.id.split(':')[0],
          whatsapp_id: info?.id,
          display_name: info?.name,
          last_connected_at: new Date().toISOString(),
          qr_code: null,
          connection_error: null,
          retry_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Log audit event
      await supabase.from('whatsapp_audit_logs').insert({
        org_id: orgId,
        session_id: sessionId,
        event_type: 'session_connected',
        event_data: {
          phone_number: info?.id.split(':')[0],
          display_name: info?.name
        }
      });

      // Store in active sessions
      activeSessions.set(orgId, sock);
    }
  });

  return sock;
};

export const getActiveSession = (orgId: string): WASocket | undefined => {
  return activeSessions.get(orgId);
};

export const closeSession = async (orgId: string, sessionId: string) => {
  const sock = activeSessions.get(orgId);
  
  if (sock) {
    await sock.logout();
    activeSessions.delete(orgId);
    
    await supabase
      .from('whatsapp_sessions')
      .update({
        status: 'disconnected',
        last_disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    console.log(`[${orgId}] Session closed`);
  }
};
```

### Step 2.6: Implement API Routes

```typescript
// src/routes/sessions.ts
import { Router } from 'express';
import { createWhatsAppSession, getActiveSession, closeSession } from '../lib/sessionManager';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize session
router.post('/init', async (req, res) => {
  try {
    const { org_id } = req.body;
    const orgId = req.orgId; // From auth middleware

    if (!orgId) {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Check if session already exists
    let { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('org_id', orgId)
      .single();

    // Create new session if doesn't exist
    if (!session) {
      const { data: newSession, error } = await supabase
        .from('whatsapp_sessions')
        .insert({
          org_id: orgId,
          status: 'connecting'
        })
        .select()
        .single();

      if (error) throw error;
      session = newSession;
    }

    // Create WhatsApp socket
    await createWhatsAppSession(orgId, session.id);

    // Wait for QR code (max 10 seconds)
    let attempts = 0;
    while (attempts < 20) {
      const { data: updated } = await supabase
        .from('whatsapp_sessions')
        .select('qr_code, status')
        .eq('id', session.id)
        .single();

      if (updated?.qr_code || updated?.status === 'connected') {
        return res.json({
          success: true,
          session_id: session.id,
          status: updated.status,
          qr_code: updated.qr_code
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    res.json({
      success: true,
      session_id: session.id,
      status: 'connecting',
      message: 'Session initializing, check status endpoint'
    });

  } catch (error) {
    console.error('Error initializing session:', error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

// Get QR code
router.get('/:orgId/qr', async (req, res) => {
  try {
    const { orgId } = req.params;

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('qr_code, status, qr_expires_at')
      .eq('org_id', orgId)
      .single();

    if (!session || !session.qr_code) {
      return res.status(404).json({ 
        error: 'QR code not found or session already connected' 
      });
    }

    res.json({
      success: true,
      qr_code: session.qr_code,
      expires_at: session.qr_expires_at,
      status: session.status
    });

  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

// Get session status
router.get('/:orgId/status', async (req, res) => {
  try {
    const { orgId } = req.params;

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      status: session.status,
      phone_number: session.phone_number,
      display_name: session.display_name,
      last_connected_at: session.last_connected_at
    });

  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
});

// Logout session
router.post('/:orgId/logout', async (req, res) => {
  try {
    const { orgId } = req.params;

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('org_id', orgId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await closeSession(orgId, session.id);

    res.json({
      success: true,
      message: 'Session logged out successfully'
    });

  } catch (error) {
    console.error('Error logging out session:', error);
    res.status(500).json({ error: 'Failed to logout session' });
  }
});

export default router;
```

### Step 2.7: Implement Message Routes

```typescript
// src/routes/messages.ts
import { Router } from 'express';
import { getActiveSession } from '../lib/sessionManager';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Send single message
router.post('/send', async (req, res) => {
  try {
    const { org_id, recipient, message, type = 'text' } = req.body;
    const orgId = req.orgId;

    // Get active session
    const sock = getActiveSession(orgId);
    if (!sock) {
      return res.status(400).json({ 
        error: 'WhatsApp not connected. Please connect first.' 
      });
    }

    // Format phone number (remove + and add @s.whatsapp.net)
    const jid = recipient.replace('+', '') + '@s.whatsapp.net';

    // Send message
    const result = await sock.sendMessage(jid, { text: message });

    // Save to database
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('org_id', orgId)
      .single();

    const { data: messageRecord } = await supabase
      .from('whatsapp_messages')
      .insert({
        org_id: orgId,
        session_id: session?.id,
        recipient_phone: recipient,
        message_type: type,
        message_body: message,
        status: 'sent',
        whatsapp_message_id: result.key.id,
        sent_at: new Date().toISOString(),
        sent_by: req.user?.id
      })
      .select()
      .single();

    res.json({
      success: true,
      message_id: messageRecord?.id,
      whatsapp_message_id: result.key.id,
      status: 'sent'
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send template message
router.post('/send-template', async (req, res) => {
  try {
    const { org_id, recipient, template_id, variables } = req.body;
    const orgId = req.orgId;

    // Get template
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Replace variables in template
    let message = template.message_template;
    if (variables) {
      Object.keys(variables).forEach(key => {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
      });
    }

    // Send message using the send endpoint logic
    const sock = getActiveSession(orgId);
    if (!sock) {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    const jid = recipient.replace('+', '') + '@s.whatsapp.net';
    const result = await sock.sendMessage(jid, { text: message });

    // Save to database
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('org_id', orgId)
      .single();

    const { data: messageRecord } = await supabase
      .from('whatsapp_messages')
      .insert({
        org_id: orgId,
        session_id: session?.id,
        recipient_phone: recipient,
        message_type: 'template',
        message_body: message,
        template_name: template.name,
        template_params: variables,
        status: 'sent',
        whatsapp_message_id: result.key.id,
        sent_at: new Date().toISOString(),
        sent_by: req.user?.id
      })
      .select()
      .single();

    // Update template usage
    await supabase
      .from('whatsapp_templates')
      .update({
        usage_count: supabase.rpc('increment', { x: 1 }),
        last_used_at: new Date().toISOString()
      })
      .eq('id', template_id);

    res.json({
      success: true,
      message_id: messageRecord?.id,
      whatsapp_message_id: result.key.id,
      status: 'sent'
    });

  } catch (error) {
    console.error('Error sending template message:', error);
    res.status(500).json({ error: 'Failed to send template message' });
  }
});

export default router;
```

### Step 2.8: Create Main Server File

```typescript
// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import sessionRoutes from './routes/sessions';
import messageRoutes from './routes/messages';
import { authenticateRequest } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(express.json());

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.headers['x-org-id'] as string
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/sessions', apiLimiter, authenticateRequest, sessionRoutes);
app.use('/api/messages', messageLimiter, authenticateRequest, messageRoutes);

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Service running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
});
```

### Step 2.9: Create Auth Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const orgId = req.headers['x-org-id'] as string;

    if (!token || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify user belongs to org and has permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.org_id !== orgId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!['owner', 'admin', 'super_admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Attach to request
    (req as any).user = user;
    (req as any).orgId = orgId;
    (req as any).role = profile.role;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
```

### Step 2.10: Update package.json Scripts

```json
{
  "name": "myfleet-whatsapp-service",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "echo \"No tests yet\""
  }
}
```

---

## Phase 3: Supabase Edge Functions

### Step 3.1: Create Edge Function for Queue Processing

```bash
# Create edge function
supabase functions new process-whatsapp-queue
```

```typescript
// supabase/functions/process-whatsapp-queue/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WHATSAPP_SERVICE_URL = Deno.env.get('WHATSAPP_SERVICE_URL')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    console.log('Processing WhatsApp notification queue...');

    // Get pending notifications
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('notification_type', 'whatsapp')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    console.log(`Found ${notifications?.length || 0} pending notifications`);

    const results = [];

    for (const notification of notifications || []) {
      try {
        // Mark as processing
        await supabase
          .from('notification_queue')
          .update({ 
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
            attempts: notification.attempts + 1
          })
          .eq('id', notification.id);

        // Send via WhatsApp service
        const response = await fetch(
          `${WHATSAPP_SERVICE_URL}/api/messages/send-template`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'X-Org-Id': notification.org_id
            },
            body: JSON.stringify({
              org_id: notification.org_id,
              recipient: notification.recipient_phone,
              template_id: notification.template_id,
              variables: notification.message_data
            })
          }
        );

        const result = await response.json();

        if (result.success) {
          // Mark as completed
          await supabase
            .from('notification_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              whatsapp_message_id: result.message_id
            })
            .eq('id', notification.id);

          results.push({ id: notification.id, status: 'completed' });
        } else {
          throw new Error(result.error || 'Failed to send message');
        }

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);

        // Check if should retry
        if (notification.attempts + 1 >= notification.max_attempts) {
          // Max retries reached, mark as failed
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              error_message: error.message
            })
            .eq('id', notification.id);

          results.push({ id: notification.id, status: 'failed' });
        } else {
          // Reset to pending for retry
          await supabase
            .from('notification_queue')
            .update({
              status: 'pending',
              error_message: error.message
            })
            .eq('id', notification.id);

          results.push({ id: notification.id, status: 'retry' });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 3.2: Deploy Edge Function

```bash
# Deploy
supabase functions deploy process-whatsapp-queue

# Set environment variables
supabase secrets set WHATSAPP_SERVICE_URL=https://your-service.onrender.com
```

### Step 3.3: Create Cron Job

```sql
-- In Supabase SQL Editor
-- Create pg_cron extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule edge function to run every minute
SELECT cron.schedule(
  'process-whatsapp-queue',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-whatsapp-queue',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

---

## Phase 4: Frontend Integration

### Step 4.1: Add Environment Variable

```bash
# .env (frontend)
VITE_WHATSAPP_SERVICE_URL=https://your-service.onrender.com
```

### Step 4.2: Create WhatsApp Types

```typescript
// types.ts (add to existing file)
export interface WhatsAppSession {
  id: string;
  org_id: string;
  status: 'disconnected' | 'connecting' | 'qr_pending' | 'connected' | 'error';
  phone_number?: string;
  whatsapp_id?: string;
  display_name?: string;
  qr_code?: string;
  qr_expires_at?: string;
  last_connected_at?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  org_id: string;
  recipient_phone: string;
  recipient_name?: string;
  message_type: 'text' | 'image' | 'document' | 'template';
  message_body?: string;
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  org_id?: string;
  name: string;
  description?: string;
  category: string;
  message_template: string;
  variables?: string[];
  is_active: boolean;
  is_system: boolean;
  usage_count: number;
  created_at: string;
}
```

### Step 4.3: Create WhatsApp Settings Component

```typescript
// components/WhatsAppSettings.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppSession } from '../types';
import { CheckCircle, XCircle, Loader, QrCode } from 'lucide-react';

const WHATSAPP_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL;

export const WhatsAppSettings: React.FC = () => {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
    subscribeToChanges();
  }, []);

  const loadSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('org_id', profile.org_id)
        .single();

      setSession(data);
      
      if (data?.status === 'qr_pending' && data.qr_code) {
        setQrCode(data.qr_code);
      }
    } catch (err) {
      console.error('Error loading session:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('whatsapp_session_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_sessions'
      }, (payload) => {
        console.log('Session updated:', payload);
        setSession(payload.new as WhatsAppSession);
        
        if (payload.new.status === 'connected') {
          setQrCode(null);
        } else if (payload.new.status === 'qr_pending' && payload.new.qr_code) {
          setQrCode(payload.new.qr_code);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const connectWhatsApp = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session: authSession } } = await supabase.auth.getSession();
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/sessions/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.access_token}`,
          'X-Org-Id': profile.org_id
        },
        body: JSON.stringify({ org_id: profile.org_id })
      });

      const result = await response.json();

      if (result.success) {
        if (result.qr_code) {
          setQrCode(result.qr_code);
        }
      } else {
        setError(result.error || 'فشل الاتصال');
      }
    } catch (err) {
      console.error('Error connecting:', err);
      setError('حدث خطأ أثناء الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWhatsApp = async () => {
    try {
      setLoading(true);
      
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      await fetch(`${WHATSAPP_SERVICE_URL}/api/sessions/${profile.org_id}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
          'X-Org-Id': profile.org_id
        }
      });

      await loadSession();
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('فشل قطع الاتصال');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>إعدادات الواتساب</span>
      </h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {session?.status === 'connected' ? (
        <div>
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <CheckCircle size={20} />
            <span>متصل: {session.phone_number}</span>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            آخر اتصال: {new Date(session.last_connected_at!).toLocaleString('ar-EG')}
          </p>
          <button
            onClick={disconnectWhatsApp}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
          >
            قطع الاتصال
          </button>
        </div>
      ) : qrCode ? (
        <div className="text-center">
          <p className="mb-4">امسح رمز QR بتطبيق الواتساب</p>
          <div className="inline-block p-4 bg-white rounded">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`} alt="QR Code" />
          </div>
          <p className="text-sm text-slate-400 mt-4">
            الرمز صالح لمدة دقيقة واحدة
          </p>
        </div>
      ) : (
        <div>
          <p className="text-slate-400 mb-4">
            قم بربط حساب الواتساب الخاص بك لإرسال الإشعارات التلقائية للعملاء
          </p>
          <button
            onClick={connectWhatsApp}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition disabled:opacity-50"
          >
            {loading ? 'جاري الاتصال...' : 'ربط الواتساب'}
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Phase 5: Testing

### Test Checklist

```bash
# 1. Database
✅ Tables created
✅ RLS policies working
✅ Default templates inserted

# 2. WhatsApp Service
✅ Server starts without errors
✅ Health check responds
✅ Session initialization works
✅ QR code generated
✅ Connection established after scan
✅ Message sending works
✅ Template rendering works

# 3. Edge Functions
✅ Queue processor runs
✅ Notifications sent
✅ Retry logic works

# 4. Frontend
✅ Settings page loads
✅ QR code displays
✅ Status updates in real-time
✅ Disconnect works
```

---

## Phase 6: Deployment

### Deploy WhatsApp Service to Render

```bash
# 1. Push code to GitHub
git add .
git commit -m "Add WhatsApp integration"
git push

# 2. Create new Web Service on Render
# - Connect GitHub repo
# - Build Command: npm install && npm run build
# - Start Command: npm start
# - Add environment variables

# 3. Note the service URL
# https://myfleet-whatsapp.onrender.com
```

### Update Frontend Environment

```bash
# Update .env
VITE_WHATSAPP_SERVICE_URL=https://myfleet-whatsapp.onrender.com

# Rebuild and deploy
npm run build
```

---

## Troubleshooting

### Issue: QR Code Not Generating

```bash
# Check logs
# Render: View Logs tab
# Local: Check terminal output

# Common causes:
- Supabase connection failed
- Auth state not saving
- Session already connected
```

### Issue: Messages Not Sending

```bash
# Check:
1. Session status is 'connected'
2. Phone number format (+201234567890)
3. Rate limits not exceeded
4. Baileys socket is active
```

### Issue: Queue Not Processing

```bash
# Check:
1. Edge function deployed
2. Cron job scheduled
3. Environment variables set
4. WhatsApp service URL correct
```

---

**Implementation Time Estimate**: 2-3 weeks  
**Difficulty**: Advanced  
**Prerequisites**: Node.js, TypeScript, Supabase, React
