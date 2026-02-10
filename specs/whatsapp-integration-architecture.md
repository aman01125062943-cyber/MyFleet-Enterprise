# 🏗️ WhatsApp Integration Architecture - MyFleet Pro

## 📋 نظرة عامة

هذا المستند يحدد الهيكل المعماري الكامل لتكامل نظام الواتساب من مشروع Wasel مع MyFleet Pro، مع الأخذ في الاعتبار أن MyFleet Pro حالياً هو React SPA + Supabase بدون Node.js backend.

---

## 🎯 المتطلبات الأساسية

### ✅ الوضع الحالي
- **Frontend**: React SPA + TypeScript + Vite
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **Architecture**: Serverless (لا يوجد Node.js backend)
- **Deployment**: Static hosting (Render/Vercel/Netlify)

### 🎯 المتطلبات الجديدة
1. إرسال رسائل واتساب للعملاء (trial users, expiring subscriptions, activated subscriptions)
2. تخزين جلسات الواتساب في Supabase (persistent across deployments)
3. استخدام Baileys library (يحتاج Node.js runtime)
4. Multi-tenant support (كل organization لها جلسة واتساب منفصلة)

---

## 🏛️ الهيكل المعماري المقترح

```
┌─────────────────────────────────────────────────────────────────┐
│                     MyFleet Pro Frontend                         │
│                    (React SPA - Existing)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │   Settings   │  │  WhatsApp    │          │
│  │              │  │              │  │   Panel      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS/REST API
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                      Supabase Platform                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                    │  │
│  │  • organizations                                          │  │
│  │  • profiles                                               │  │
│  │  • whatsapp_sessions (NEW)                               │  │
│  │  • whatsapp_messages (NEW)                               │  │
│  │  • whatsapp_templates (NEW)                              │  │
│  │  • notification_queue (NEW)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supabase Edge Functions (Deno)              │  │
│  │  • whatsapp-webhook (receives QR, status updates)        │  │
│  │  • send-notification (triggers WhatsApp service)         │  │
│  │  • process-queue (scheduled, processes pending msgs)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Supabase Storage                       │  │
│  │  • whatsapp-media/ (images, documents for messages)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS/REST API + WebSocket
                         │
┌────────────────────────┴────────────────────────────────────────┐
│              WhatsApp Microservice (Node.js)                     │
│                    (Separate Deployment)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Express.js Server                      │  │
│  │  • POST /api/sessions/init                               │  │
│  │  • GET  /api/sessions/:orgId/qr                          │  │
│  │  • POST /api/sessions/:orgId/logout                      │  │
│  │  • POST /api/messages/send                               │  │
│  │  • GET  /api/sessions/:orgId/status                      │  │
│  │  • POST /api/messages/send-bulk                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Baileys WhatsApp Client                      │  │
│  │  • Multi-session manager (one per org_id)               │  │
│  │  • Custom Supabase Auth State Handler                    │  │
│  │  • Message queue processor                               │  │
│  │  • Connection state manager                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Supabase Auth State Adapter                  │  │
│  │  • useSupabaseAuthState() - replaces filesystem         │  │
│  │  • Stores: creds.json, keys, pre-keys in DB             │  │
│  │  • Real-time sync with Supabase                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                         │
                         │ WhatsApp Protocol
                         │
                    ┌────┴────┐
                    │ WhatsApp │
                    │  Servers │
                    └──────────┘
```

---

## 📊 جداول Supabase المطلوبة

### 1️⃣ `whatsapp_sessions` - تخزين جلسات الواتساب

```sql
CREATE TABLE whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Session Status
    status TEXT NOT NULL DEFAULT 'disconnected', 
    -- 'disconnected' | 'connecting' | 'qr_pending' | 'connected' | 'error'
    
    -- WhatsApp Account Info
    phone_number TEXT,
    whatsapp_id TEXT, -- WhatsApp JID (e.g., 201234567890@s.whatsapp.net)
    display_name TEXT,
    
    -- Authentication State (Baileys format)
    auth_state JSONB, -- Stores creds, keys, pre-keys, etc.
    
    -- QR Code (for initial connection)
    qr_code TEXT, -- Base64 encoded QR
    qr_expires_at TIMESTAMPTZ,
    
    -- Connection Metadata
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    connection_error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Settings
    auto_reconnect BOOLEAN DEFAULT true,
    enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(org_id), -- One session per organization
    CHECK (status IN ('disconnected', 'connecting', 'qr_pending', 'connected', 'error'))
);

-- Indexes
CREATE INDEX idx_whatsapp_sessions_org_id ON whatsapp_sessions(org_id);
CREATE INDEX idx_whatsapp_sessions_status ON whatsapp_sessions(status);
CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);

-- RLS Policies
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Organizations can only see their own session
CREATE POLICY "Organizations can view own session"
    ON whatsapp_sessions FOR SELECT
    USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Only owners/admins can manage sessions
CREATE POLICY "Owners can manage sessions"
    ON whatsapp_sessions FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Super admins can see all
CREATE POLICY "Super admins can view all sessions"
    ON whatsapp_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );
```

### 2️⃣ `whatsapp_messages` - سجل الرسائل المرسلة

```sql
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    
    -- Message Details
    recipient_phone TEXT NOT NULL, -- E.164 format: +201234567890
    recipient_name TEXT,
    message_type TEXT NOT NULL DEFAULT 'text', 
    -- 'text' | 'image' | 'document' | 'template'
    
    -- Content
    message_body TEXT,
    template_name TEXT, -- If using template
    template_params JSONB, -- Template variables
    media_url TEXT, -- Supabase Storage URL
    
    -- Status Tracking
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
    
    whatsapp_message_id TEXT, -- WhatsApp's message ID
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    sent_by UUID REFERENCES profiles(id), -- User who triggered the message
    trigger_type TEXT, -- 'manual' | 'trial_welcome' | 'subscription_expiring' | 'subscription_activated'
    related_entity_id UUID, -- e.g., subscription_id, user_id
    
    -- Timestamps
    scheduled_at TIMESTAMPTZ, -- For scheduled messages
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
    CHECK (message_type IN ('text', 'image', 'document', 'template'))
);

-- Indexes
CREATE INDEX idx_whatsapp_messages_org_id ON whatsapp_messages(org_id);
CREATE INDEX idx_whatsapp_messages_session_id ON whatsapp_messages(session_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_recipient ON whatsapp_messages(recipient_phone);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_scheduled ON whatsapp_messages(scheduled_at) 
    WHERE status = 'pending' AND scheduled_at IS NOT NULL;

-- RLS Policies
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations can view own messages"
    ON whatsapp_messages FOR SELECT
    USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Authorized users can send messages"
    ON whatsapp_messages FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );
```

### 3️⃣ `whatsapp_templates` - قوالب الرسائل

```sql
CREATE TABLE whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    -- NULL org_id means system-wide template
    
    -- Template Info
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, 
    -- 'trial_welcome' | 'subscription_expiring' | 'subscription_activated' | 'custom'
    
    -- Content
    message_template TEXT NOT NULL, -- Supports {{variable}} syntax
    variables JSONB, -- Array of variable names: ["customer_name", "expiry_date"]
    
    -- Media (optional)
    media_type TEXT, -- 'image' | 'document' | null
    media_url TEXT,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- System templates can't be deleted
    
    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(org_id, name),
    CHECK (category IN ('trial_welcome', 'subscription_expiring', 'subscription_activated', 'payment_reminder', 'custom'))
);

-- Indexes
CREATE INDEX idx_whatsapp_templates_org_id ON whatsapp_templates(org_id);
CREATE INDEX idx_whatsapp_templates_category ON whatsapp_templates(category);
CREATE INDEX idx_whatsapp_templates_active ON whatsapp_templates(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org templates and system templates"
    ON whatsapp_templates FOR SELECT
    USING (
        org_id IS NULL -- System templates
        OR org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Owners can manage own templates"
    ON whatsapp_templates FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
        AND is_system = false -- Can't modify system templates
    );
```

### 4️⃣ `notification_queue` - طابور الإشعارات

```sql
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Notification Type
    notification_type TEXT NOT NULL,
    -- 'whatsapp' | 'email' | 'sms' (future)
    
    -- Target
    recipient_id UUID REFERENCES profiles(id),
    recipient_phone TEXT,
    recipient_email TEXT,
    
    -- Content
    template_id UUID REFERENCES whatsapp_templates(id),
    message_data JSONB, -- Template variables + custom data
    
    -- Scheduling
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Result
    whatsapp_message_id UUID REFERENCES whatsapp_messages(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    CHECK (notification_type IN ('whatsapp', 'email', 'sms')),
    CHECK (priority BETWEEN 1 AND 10)
);

-- Indexes
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for) 
    WHERE status = 'pending';
CREATE INDEX idx_notification_queue_org_id ON notification_queue(org_id);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority DESC);

-- RLS Policies
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations can view own notifications"
    ON notification_queue FOR SELECT
    USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

---

## 🔌 API Endpoints - WhatsApp Microservice

### Base URL
```
Production: https://whatsapp-service.myfleet.app
Development: http://localhost:3001
```

### Authentication
جميع الطلبات تحتاج header:
```
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
X-Org-Id: <organization_id>
```

### 📡 Endpoints

#### 1. Initialize Session
```http
POST /api/sessions/init
Content-Type: application/json

{
  "org_id": "uuid",
  "phone_number": "+201234567890" // optional
}

Response 200:
{
  "success": true,
  "session_id": "uuid",
  "status": "qr_pending",
  "qr_code": "data:image/png;base64,...",
  "message": "Scan QR code to connect"
}
```

#### 2. Get QR Code
```http
GET /api/sessions/:orgId/qr

Response 200:
{
  "success": true,
  "qr_code": "data:image/png;base64,...",
  "expires_at": "2026-02-07T14:00:00Z",
  "status": "qr_pending"
}

Response 404:
{
  "success": false,
  "error": "Session not found or already connected"
}
```

#### 3. Get Session Status
```http
GET /api/sessions/:orgId/status

Response 200:
{
  "success": true,
  "status": "connected",
  "phone_number": "+201234567890",
  "display_name": "MyFleet Pro",
  "last_connected_at": "2026-02-07T13:00:00Z"
}
```

#### 4. Logout Session
```http
POST /api/sessions/:orgId/logout

Response 200:
{
  "success": true,
  "message": "Session logged out successfully"
}
```

#### 5. Send Single Message
```http
POST /api/messages/send
Content-Type: application/json

{
  "org_id": "uuid",
  "recipient": "+201234567890",
  "message": "مرحباً! اشتراكك في MyFleet Pro سينتهي خلال 3 أيام.",
  "type": "text"
}

Response 200:
{
  "success": true,
  "message_id": "uuid",
  "whatsapp_message_id": "3EB0XXXXX",
  "status": "sent"
}
```

#### 6. Send Bulk Messages
```http
POST /api/messages/send-bulk
Content-Type: application/json

{
  "org_id": "uuid",
  "messages": [
    {
      "recipient": "+201234567890",
      "message": "رسالة 1",
      "template_id": "uuid"
    },
    {
      "recipient": "+201234567891",
      "message": "رسالة 2"
    }
  ]
}

Response 200:
{
  "success": true,
  "queued": 2,
  "job_id": "uuid"
}
```

#### 7. Send Template Message
```http
POST /api/messages/send-template
Content-Type: application/json

{
  "org_id": "uuid",
  "recipient": "+201234567890",
  "template_id": "uuid",
  "variables": {
    "customer_name": "أحمد",
    "expiry_date": "2026-02-10"
  }
}

Response 200:
{
  "success": true,
  "message_id": "uuid",
  "status": "sent"
}
```

#### 8. Upload Media
```http
POST /api/media/upload
Content-Type: multipart/form-data

file: <binary>
org_id: uuid

Response 200:
{
  "success": true,
  "media_url": "https://supabase.co/storage/v1/object/public/whatsapp-media/...",
  "media_type": "image"
}
```

#### 9. Health Check
```http
GET /api/health

Response 200:
{
  "success": true,
  "status": "healthy",
  "active_sessions": 5,
  "uptime": 86400
}
```

---

## 🔄 تدفق البيانات (Data Flow)

### 🎬 Scenario 1: إعداد جلسة واتساب جديدة

```
1. User (Owner) → Frontend
   - يذهب إلى Settings → WhatsApp Integration
   - يضغط "Connect WhatsApp"

2. Frontend → Supabase Edge Function
   POST /functions/v1/whatsapp-init
   { org_id: "uuid" }

3. Edge Function → WhatsApp Service
   POST https://whatsapp-service.myfleet.app/api/sessions/init
   { org_id: "uuid" }

4. WhatsApp Service:
   - Creates Baileys client instance
   - Generates QR code
   - Stores session in whatsapp_sessions table
   - Returns QR code

5. Frontend:
   - Displays QR code
   - Polls /api/sessions/:orgId/status every 3 seconds

6. User scans QR with WhatsApp mobile app

7. Baileys → WhatsApp Service:
   - Connection established
   - Auth state saved to Supabase (via useSupabaseAuthState)
   - Updates whatsapp_sessions.status = 'connected'

8. Frontend:
   - Detects status change
   - Shows success message
   - Enables WhatsApp features
```

### 📨 Scenario 2: إرسال رسالة تلقائية (Trial User Welcome)

```
1. Trigger: New user signs up (trial plan)

2. Database Trigger → notification_queue
   INSERT INTO notification_queue (
     org_id,
     notification_type: 'whatsapp',
     template_id: 'trial_welcome_template',
     recipient_phone: user.phone,
     message_data: { name: user.full_name }
   )

3. Supabase Edge Function (Scheduled - runs every minute)
   - Queries notification_queue WHERE status='pending' AND scheduled_for <= NOW()
   - Processes each notification

4. Edge Function → WhatsApp Service
   POST /api/messages/send-template
   {
     org_id,
     recipient,
     template_id,
     variables
   }

5. WhatsApp Service:
   - Fetches template from whatsapp_templates
   - Replaces variables: "مرحباً {{name}}" → "مرحباً أحمد"
   - Checks session status (must be 'connected')
   - Sends via Baileys
   - Inserts into whatsapp_messages table

6. Baileys → WhatsApp Servers:
   - Message sent
   - Receives message ID

7. WhatsApp Service:
   - Updates whatsapp_messages.status = 'sent'
   - Updates notification_queue.status = 'completed'

8. Webhook (optional):
   - WhatsApp sends delivery/read receipts
   - Updates whatsapp_messages.delivered_at / read_at
```

### ⏰ Scenario 3: إشعار انتهاء الاشتراك (Expiring Subscription)

```
1. Supabase Cron Job (runs daily at 9 AM)
   - Queries subscriptions WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'

2. For each expiring subscription:
   INSERT INTO notification_queue (
     org_id,
     notification_type: 'whatsapp',
     template_id: 'subscription_expiring',
     recipient_phone: org.owner_phone,
     message_data: {
       org_name: org.name,
       expiry_date: subscription.end_date,
       plan_name: subscription.plan_name
     },
     priority: 3 // High priority
   )

3. Edge Function processes queue (same as Scenario 2)

4. Message sent: "تنبيه! اشتراكك في MyFleet Pro سينتهي في 10/02/2026. جدد الآن لتجنب انقطاع الخدمة."
```

---

## 🔐 الأمان و CORS

### 🛡️ Security Measures

#### 1. Authentication
```typescript
// WhatsApp Service - Middleware
const authenticateRequest = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const orgId = req.headers['x-org-id'];
  
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
  
  if (profile.org_id !== orgId || !['owner', 'admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  req.user = user;
  req.orgId = orgId;
  next();
};
```

#### 2. CORS Configuration
```typescript
// WhatsApp Service - server.ts
import cors from 'cors';

const allowedOrigins = [
  'https://myfleet.app',
  'https://app.myfleet.app',
  'http://localhost:5173', // Development
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Id']
}));
```

#### 3. Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

// Message sending rate limit (stricter)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute per org
  keyGenerator: (req) => req.headers['x-org-id'],
  message: 'Message rate limit exceeded'
});

app.use('/api/', apiLimiter);
app.use('/api/messages/send', messageLimiter);
```

#### 4. Environment Variables
```bash
# WhatsApp Service .env
NODE_ENV=production
PORT=3001

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx # Server-side only, never expose to frontend
SUPABASE_ANON_KEY=xxx

# Security
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx # For encrypting auth_state in DB

# WhatsApp
WHATSAPP_WEBHOOK_SECRET=xxx

# Monitoring
SENTRY_DSN=xxx
```

---

## 🔧 Supabase Auth State Adapter

### Implementation: `useSupabaseAuthState.ts`

```typescript
import { AuthenticationState, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { supabase } from './supabaseClient';

interface SupabaseAuthStateOptions {
  orgId: string;
  sessionId: string;
}

/**
 * Custom Baileys auth state handler that stores credentials in Supabase
 * instead of filesystem. This ensures persistence across deployments.
 */
export const useSupabaseAuthState = async (
  options: SupabaseAuthStateOptions
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> => {
  const { orgId, sessionId } = options;

  // Load existing auth state from Supabase
  const { data: session, error } = await supabase
    .from('whatsapp_sessions')
    .select('auth_state')
    .eq('id', sessionId)
    .eq('org_id', orgId)
    .single();

  let authState: AuthenticationState;

  if (error || !session?.auth_state) {
    // No existing state, initialize new credentials
    console.log(`[${orgId}] Initializing new auth state`);
    authState = initAuthCreds();
  } else {
    // Parse existing state from database
    console.log(`[${orgId}] Loading existing auth state`);
    authState = JSON.parse(
      JSON.stringify(session.auth_state),
      BufferJSON.reviver
    );
  }

  /**
   * Save credentials to Supabase whenever they change
   */
  const saveCreds = async () => {
    try {
      // Serialize auth state (handles Buffers properly)
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

### Usage in Baileys Client

```typescript
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import { useSupabaseAuthState } from './useSupabaseAuthState';

export const createWhatsAppClient = async (orgId: string, sessionId: string) => {
  // Load auth state from Supabase
  const { state, saveCreds } = await useSupabaseAuthState({ orgId, sessionId });

  // Create Baileys socket
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // We'll handle QR display in frontend
    browser: ['MyFleet Pro', 'Chrome', '10.0'],
    
    // Save credentials whenever they change
    // This is called automatically by Baileys
    // when keys are updated, rotated, etc.
  });

  // Listen for credential updates
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // QR code generated, save to database for frontend to display
      await supabase
        .from('whatsapp_sessions')
        .update({
          qr_code: qr,
          qr_expires_at: new Date(Date.now() + 60000).toISOString(), // 1 min
          status: 'qr_pending'
        })
        .eq('id', sessionId);
    }

    if (connection === 'close') {
      const shouldReconnect = 
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log(`[${orgId}] Reconnecting...`);
        await createWhatsAppClient(orgId, sessionId);
      } else {
        await supabase
          .from('whatsapp_sessions')
          .update({ status: 'disconnected' })
          .eq('id', sessionId);
      }
    }

    if (connection === 'open') {
      console.log(`[${orgId}] Connected successfully`);
      
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
          retry_count: 0
        })
        .eq('id', sessionId);
    }
  });

  return sock;
};
```

---

## 🚀 Deployment Strategy

### 1️⃣ WhatsApp Microservice Deployment

#### Option A: Render (Recommended)
```yaml
# render.yaml
services:
  - type: web
    name: myfleet-whatsapp-service
    env: node
    region: frankfurt # Closest to your users
    plan: starter # $7/month
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: PORT
        value: 3001
    healthCheckPath: /api/health
    autoDeploy: true
```

#### Option B: Railway
```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### Option C: Fly.io
```toml
# fly.toml
app = "myfleet-whatsapp"
primary_region = "fra"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "3001"
  NODE_ENV = "production"

[[services]]
  http_checks = []
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### 2️⃣ Supabase Edge Functions

```bash
# Deploy Edge Functions
supabase functions deploy whatsapp-webhook
supabase functions deploy send-notification
supabase functions deploy process-queue
```

### 3️⃣ Frontend (No Changes Needed)
- MyFleet Pro frontend remains static
- Deployed on Render/Vercel/Netlify as before
- Communicates with WhatsApp service via REST API

---

## 📱 Frontend Integration

### WhatsApp Settings Component

```typescript
// components/WhatsAppSettings.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'qrcode.react';

const WHATSAPP_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL;

export const WhatsAppSettings: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
    
    // Subscribe to session changes
    const subscription = supabase
      .channel('whatsapp_session_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_sessions'
      }, (payload) => {
        setSession(payload.new);
        if (payload.new.status === 'connected') {
          setQrCode(null);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadSession = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('org_id', profile.org_id)
      .single();

    setSession(data);
    setLoading(false);
  };

  const connectWhatsApp = async () => {
    setLoading(true);
    
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
      setQrCode(result.qr_code);
      pollSessionStatus(profile.org_id);
    }
    
    setLoading(false);
  };

  const pollSessionStatus = async (orgId: string) => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('status')
        .eq('org_id', orgId)
        .single();

      if (data?.status === 'connected') {
        clearInterval(interval);
        setQrCode(null);
        loadSession();
      }
    }, 3000);

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(interval), 120000);
  };

  const disconnectWhatsApp = async () => {
    // Implementation
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">إعدادات الواتساب</h2>
      
      {session?.status === 'connected' ? (
        <div>
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <CheckCircle size={20} />
            <span>متصل: {session.phone_number}</span>
          </div>
          <button
            onClick={disconnectWhatsApp}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            قطع الاتصال
          </button>
        </div>
      ) : qrCode ? (
        <div className="text-center">
          <p className="mb-4">امسح رمز QR بتطبيق الواتساب</p>
          <QRCode value={qrCode} size={256} />
        </div>
      ) : (
        <button
          onClick={connectWhatsApp}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
        >
          ربط الواتساب
        </button>
      )}
    </div>
  );
};
```

---

## 📊 Monitoring & Logging

### 1. Application Monitoring
```typescript
// WhatsApp Service - monitoring.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

export const logEvent = (event: string, data: any) => {
  console.log(`[${new Date().toISOString()}] ${event}:`, data);
  
  // Send to monitoring service
  Sentry.addBreadcrumb({
    category: 'whatsapp',
    message: event,
    data,
    level: 'info'
  });
};
```

### 2. Database Logging
```sql
-- Create audit log for WhatsApp events
CREATE TABLE whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    session_id UUID REFERENCES whatsapp_sessions(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_audit_org ON whatsapp_audit_logs(org_id);
CREATE INDEX idx_whatsapp_audit_created ON whatsapp_audit_logs(created_at DESC);
```

---

## 🎯 قوالب الرسائل الافتراضية

```sql
-- Insert default templates
INSERT INTO whatsapp_templates (name, description, category, message_template, variables, is_system) VALUES
(
  'trial_welcome',
  'رسالة ترحيب للمستخدمين الجدد',
  'trial_welcome',
  'مرحباً {{customer_name}}! 👋

شكراً لتسجيلك في MyFleet Pro. نحن سعداء بانضمامك!

🎁 لديك فترة تجريبية مجانية لمدة {{trial_days}} يوم للاستمتاع بجميع المميزات.

📱 ابدأ الآن من: {{app_url}}

إذا كان لديك أي استفسار، نحن هنا للمساعدة!',
  '["customer_name", "trial_days", "app_url"]',
  true
),
(
  'subscription_expiring',
  'تنبيه انتهاء الاشتراك',
  'subscription_expiring',
  '⚠️ تنبيه مهم

مرحباً {{customer_name}},

اشتراكك في خطة {{plan_name}} سينتهي في {{expiry_date}} (بعد {{days_remaining}} أيام).

💡 جدد اشتراكك الآن لتجنب انقطاع الخدمة:
{{renewal_url}}

شكراً لثقتك في MyFleet Pro! 🚗',
  '["customer_name", "plan_name", "expiry_date", "days_remaining", "renewal_url"]',
  true
),
(
  'subscription_activated',
  'تأكيد تفعيل الاشتراك',
  'subscription_activated',
  '✅ تم تفعيل اشتراكك بنجاح!

مرحباً {{customer_name}},

تم تفعيل خطة {{plan_name}} بنجاح.

📅 صالح حتى: {{end_date}}
✨ المميزات المتاحة:
{{features_list}}

استمتع بإدارة أسطولك بكفاءة! 🚀',
  '["customer_name", "plan_name", "end_date", "features_list"]',
  true
),
(
  'payment_reminder',
  'تذكير بالدفع',
  'payment_reminder',
  '💳 تذكير بالدفع

مرحباً {{customer_name}},

لديك فاتورة مستحقة بقيمة {{amount}} {{currency}}.

📄 رقم الفاتورة: {{invoice_number}}
📅 تاريخ الاستحقاق: {{due_date}}

ادفع الآن: {{payment_url}}',
  '["customer_name", "amount", "currency", "invoice_number", "due_date", "payment_url"]',
  true
);
```

---

## 🔄 Migration Plan

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Deploy WhatsApp microservice to Render/Railway
- [ ] Create Supabase tables (whatsapp_sessions, whatsapp_messages, etc.)
- [ ] Deploy Supabase Edge Functions
- [ ] Configure CORS and security

### Phase 2: Core Integration (Week 2)
- [ ] Implement useSupabaseAuthState adapter
- [ ] Build session management (init, QR, connect, disconnect)
- [ ] Test multi-tenant session isolation
- [ ] Implement message sending API

### Phase 3: Frontend Integration (Week 3)
- [ ] Add WhatsApp settings page
- [ ] QR code display and connection flow
- [ ] Message templates management UI
- [ ] Test end-to-end flow

### Phase 4: Automation (Week 4)
- [ ] Implement notification queue processor
- [ ] Add database triggers for auto-notifications
- [ ] Create default message templates
- [ ] Test automated scenarios (trial welcome, expiring subscription)

### Phase 5: Testing & Launch (Week 5)
- [ ] Load testing (100+ concurrent sessions)
- [ ] Security audit
- [ ] Documentation
- [ ] Soft launch with beta users

---

## 📚 التوثيق الإضافي

### Environment Variables Checklist

#### Frontend (.env)
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_WHATSAPP_SERVICE_URL=https://whatsapp-service.myfleet.app
```

#### WhatsApp Service (.env)
```bash
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx # CRITICAL: Never expose to frontend
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx
SENTRY_DSN=xxx
```

#### Supabase Edge Functions
```bash
WHATSAPP_SERVICE_URL=https://whatsapp-service.myfleet.app
WHATSAPP_SERVICE_SECRET=xxx
```

---

## 🎉 الخلاصة

هذا الهيكل المعماري يوفر:

✅ **Separation of Concerns**: Frontend (React) منفصل عن WhatsApp logic (Node.js)  
✅ **Scalability**: Microservice يمكن scale بشكل مستقل  
✅ **Persistence**: جلسات الواتساب محفوظة في Supabase (لا تضيع عند restart)  
✅ **Multi-tenancy**: كل organization لها جلسة منفصلة  
✅ **Security**: Authentication, CORS, Rate limiting, RLS policies  
✅ **Automation**: Notification queue + scheduled jobs  
✅ **Monitoring**: Audit logs, Sentry integration  

---

**تاريخ الإنشاء**: 2026-02-07  
**الإصدار**: 1.0  
**الحالة**: Ready for Implementation ✅
