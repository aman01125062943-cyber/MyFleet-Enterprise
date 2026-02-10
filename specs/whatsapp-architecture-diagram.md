# 📊 WhatsApp Integration - Visual Architecture Diagrams

## 🏗️ System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[React SPA<br/>MyFleet Pro]
        A1[Dashboard]
        A2[WhatsApp Settings]
        A3[Message Templates]
        A --> A1
        A --> A2
        A --> A3
    end

    subgraph "Supabase Platform"
        B[PostgreSQL Database]
        C[Edge Functions]
        D[Storage]
        E[Auth]
        
        B1[(whatsapp_sessions)]
        B2[(whatsapp_messages)]
        B3[(whatsapp_templates)]
        B4[(notification_queue)]
        
        B --> B1
        B --> B2
        B --> B3
        B --> B4
        
        C1[whatsapp-webhook]
        C2[send-notification]
        C3[process-queue]
        
        C --> C1
        C --> C2
        C --> C3
    end

    subgraph "WhatsApp Microservice"
        F[Express.js Server]
        G[Baileys Client Manager]
        H[Supabase Auth State]
        I[Message Queue Processor]
        
        F --> G
        G --> H
        G --> I
    end

    subgraph "External Services"
        J[WhatsApp Servers]
    end

    A -->|HTTPS/REST| B
    A -->|HTTPS/REST| C
    A -->|HTTPS/REST| F
    
    C -->|HTTPS/REST| F
    B <-->|Read/Write| H
    
    F -->|WebSocket| J
    G -->|WhatsApp Protocol| J
    
    style A fill:#3b82f6
    style B fill:#10b981
    style F fill:#f59e0b
    style J fill:#25D366
```

## 🔄 Session Initialization Flow

```mermaid
sequenceDiagram
    participant U as User (Owner)
    participant FE as Frontend
    participant EF as Edge Function
    participant WS as WhatsApp Service
    participant DB as Supabase DB
    participant BA as Baileys
    participant WA as WhatsApp

    U->>FE: Click "Connect WhatsApp"
    FE->>EF: POST /whatsapp-init
    EF->>WS: POST /api/sessions/init
    WS->>DB: INSERT whatsapp_sessions
    WS->>BA: Create socket instance
    BA->>BA: Generate QR code
    BA->>DB: Save QR + status='qr_pending'
    WS-->>EF: Return QR code
    EF-->>FE: Return QR code
    FE->>U: Display QR code
    
    loop Poll every 3 seconds
        FE->>DB: Check session status
    end
    
    U->>WA: Scan QR with mobile
    WA->>BA: Connection established
    BA->>DB: Save auth_state + status='connected'
    DB-->>FE: Status update (realtime)
    FE->>U: Show success message
```

## 📨 Message Sending Flow

```mermaid
sequenceDiagram
    participant T as Trigger (DB/User)
    participant Q as notification_queue
    participant EF as Edge Function
    participant WS as WhatsApp Service
    participant BA as Baileys
    participant DB as Supabase DB
    participant WA as WhatsApp

    T->>Q: INSERT notification
    Note over Q: status='pending'
    
    EF->>Q: Query pending notifications
    Q-->>EF: Return pending items
    
    EF->>WS: POST /api/messages/send-template
    WS->>DB: Fetch template
    DB-->>WS: Return template
    WS->>WS: Replace variables
    WS->>DB: Check session status
    DB-->>WS: status='connected'
    
    WS->>BA: Send message
    BA->>WA: WhatsApp Protocol
    WA-->>BA: Message ID
    
    BA->>DB: INSERT whatsapp_messages<br/>status='sent'
    WS->>Q: UPDATE status='completed'
    
    WA->>BA: Delivery receipt
    BA->>DB: UPDATE delivered_at
    
    WA->>BA: Read receipt
    BA->>DB: UPDATE read_at
```

## 🗄️ Database Schema

```mermaid
erDiagram
    organizations ||--o{ whatsapp_sessions : has
    organizations ||--o{ whatsapp_messages : sends
    organizations ||--o{ whatsapp_templates : owns
    organizations ||--o{ notification_queue : has
    
    whatsapp_sessions ||--o{ whatsapp_messages : uses
    whatsapp_sessions ||--o{ whatsapp_audit_logs : logs
    
    whatsapp_templates ||--o{ notification_queue : uses
    whatsapp_templates ||--o{ whatsapp_messages : uses
    
    profiles ||--o{ whatsapp_messages : sends
    
    whatsapp_sessions {
        uuid id PK
        uuid org_id FK
        text status
        text phone_number
        text whatsapp_id
        jsonb auth_state
        text qr_code
        timestamptz last_connected_at
        boolean enabled
    }
    
    whatsapp_messages {
        uuid id PK
        uuid org_id FK
        uuid session_id FK
        text recipient_phone
        text message_type
        text message_body
        text status
        text whatsapp_message_id
        timestamptz sent_at
        timestamptz delivered_at
    }
    
    whatsapp_templates {
        uuid id PK
        uuid org_id FK
        text name
        text category
        text message_template
        jsonb variables
        boolean is_system
        boolean is_active
    }
    
    notification_queue {
        uuid id PK
        uuid org_id FK
        text notification_type
        text recipient_phone
        uuid template_id FK
        jsonb message_data
        text status
        integer priority
        timestamptz scheduled_for
    }
```

## 🔐 Security Architecture

```mermaid
graph LR
    subgraph "Frontend"
        A[React App]
    end
    
    subgraph "Authentication Layer"
        B[Supabase Auth]
        C[JWT Token]
    end
    
    subgraph "Authorization Layer"
        D[RLS Policies]
        E[Role Check]
        F[Org Isolation]
    end
    
    subgraph "API Layer"
        G[CORS Middleware]
        H[Rate Limiter]
        I[Auth Middleware]
    end
    
    subgraph "WhatsApp Service"
        J[Express Server]
    end
    
    A -->|Login| B
    B -->|Issue| C
    A -->|Request + JWT| G
    G --> H
    H --> I
    I -->|Verify| B
    I --> E
    E --> F
    F --> J
    
    A -->|Query DB| D
    D --> E
    
    style B fill:#10b981
    style D fill:#f59e0b
    style I fill:#ef4444
```

## 📊 Data Flow - Trial User Welcome

```mermaid
flowchart TD
    A[New User Signs Up] --> B{Trial Plan?}
    B -->|Yes| C[Database Trigger]
    B -->|No| Z[End]
    
    C --> D[INSERT notification_queue]
    D --> E[status='pending'<br/>template='trial_welcome']
    
    F[Edge Function<br/>Cron: Every 1 min] --> G[Query pending notifications]
    G --> H{Found?}
    H -->|No| F
    H -->|Yes| I[Process notification]
    
    I --> J[Fetch template]
    J --> K[Replace variables]
    K --> L{Session connected?}
    L -->|No| M[Mark as failed]
    L -->|Yes| N[Send via Baileys]
    
    N --> O[WhatsApp Servers]
    O --> P{Success?}
    P -->|Yes| Q[Update status='sent']
    P -->|No| R{Retry < 3?}
    R -->|Yes| S[Retry after delay]
    R -->|No| T[Mark as failed]
    
    Q --> U[Update queue='completed']
    M --> V[Log error]
    T --> V
    
    style A fill:#3b82f6
    style O fill:#25D366
    style Q fill:#10b981
    style T fill:#ef4444
```

## 🔄 Multi-Tenant Session Management

```mermaid
graph TB
    subgraph "WhatsApp Service"
        A[Session Manager]
        
        subgraph "Org 1"
            B1[Baileys Instance 1]
            C1[Auth State 1]
        end
        
        subgraph "Org 2"
            B2[Baileys Instance 2]
            C2[Auth State 2]
        end
        
        subgraph "Org 3"
            B3[Baileys Instance 3]
            C3[Auth State 3]
        end
        
        A --> B1
        A --> B2
        A --> B3
        
        B1 --> C1
        B2 --> C2
        B3 --> C3
    end
    
    subgraph "Supabase Database"
        D[(whatsapp_sessions)]
        E1[Session 1<br/>org_id=uuid1]
        E2[Session 2<br/>org_id=uuid2]
        E3[Session 3<br/>org_id=uuid3]
        
        D --> E1
        D --> E2
        D --> E3
    end
    
    C1 <-->|Read/Write| E1
    C2 <-->|Read/Write| E2
    C3 <-->|Read/Write| E3
    
    style A fill:#f59e0b
    style D fill:#10b981
```

## 🚀 Deployment Architecture

```mermaid
graph TB
    subgraph "Static Hosting (Render/Vercel)"
        A[React SPA<br/>MyFleet Pro]
    end
    
    subgraph "Supabase Cloud"
        B[PostgreSQL]
        C[Edge Functions<br/>Deno Runtime]
        D[Storage]
        E[Auth]
    end
    
    subgraph "Node.js Hosting (Render/Railway)"
        F[WhatsApp Service<br/>Express + Baileys]
        G[Health Check Endpoint]
        H[Auto-restart on failure]
    end
    
    subgraph "External"
        I[WhatsApp Servers]
        J[CDN]
    end
    
    A -->|HTTPS| B
    A -->|HTTPS| C
    A -->|HTTPS| F
    A -->|Assets| J
    
    C -->|HTTPS| F
    F -->|WebSocket| I
    
    F -->|Read/Write| B
    C -->|Read/Write| B
    
    G -->|Monitor| H
    
    style A fill:#3b82f6
    style B fill:#10b981
    style F fill:#f59e0b
    style I fill:#25D366
```

## 📈 Scaling Strategy

```mermaid
graph LR
    subgraph "Current (Phase 1)"
        A[Single WhatsApp Service<br/>1 instance]
        B[Handles 100 orgs]
    end
    
    subgraph "Growth (Phase 2)"
        C[Load Balancer]
        D[WhatsApp Service 1]
        E[WhatsApp Service 2]
        F[Handles 500 orgs]
        
        C --> D
        C --> E
    end
    
    subgraph "Scale (Phase 3)"
        G[Load Balancer + Redis]
        H[Service 1<br/>Orgs 1-200]
        I[Service 2<br/>Orgs 201-400]
        J[Service 3<br/>Orgs 401-600]
        K[Handles 1000+ orgs]
        
        G --> H
        G --> I
        G --> J
    end
    
    A -->|Growth| C
    C -->|Scale| G
    
    style A fill:#3b82f6
    style C fill:#f59e0b
    style G fill:#10b981
```

## 🔧 useSupabaseAuthState Implementation

```mermaid
sequenceDiagram
    participant BA as Baileys
    participant AS as useSupabaseAuthState
    participant DB as Supabase DB
    
    Note over BA,DB: Initialization
    BA->>AS: Load auth state
    AS->>DB: SELECT auth_state WHERE org_id=X
    DB-->>AS: Return auth_state (or null)
    AS->>AS: Parse JSON with BufferJSON.reviver
    AS-->>BA: Return AuthenticationState
    
    Note over BA,DB: Credential Updates
    BA->>AS: creds.update event
    AS->>AS: Serialize with BufferJSON.replacer
    AS->>DB: UPDATE auth_state
    DB-->>AS: Success
    
    Note over BA,DB: Key Rotation
    BA->>AS: Keys rotated
    AS->>DB: UPDATE auth_state (new keys)
    DB-->>AS: Success
    
    Note over BA,DB: Connection Lost
    BA->>AS: Connection closed
    AS->>DB: UPDATE status='disconnected'
    
    Note over BA,DB: Reconnection
    BA->>AS: Load auth state
    AS->>DB: SELECT auth_state
    DB-->>AS: Return saved state
    AS-->>BA: Restore session
    BA->>BA: Reconnect without QR
```

## 📱 Frontend Component Structure

```mermaid
graph TB
    A[App.tsx] --> B[Layout]
    B --> C[Dashboard]
    B --> D[Settings]
    
    D --> E[WhatsAppSettings]
    E --> F[SessionStatus]
    E --> G[QRCodeDisplay]
    E --> H[MessageTemplates]
    
    H --> I[TemplateList]
    H --> J[TemplateEditor]
    H --> K[TemplatePreview]
    
    C --> L[NotificationHistory]
    L --> M[MessageList]
    L --> N[MessageDetails]
    
    style E fill:#25D366
    style F fill:#10b981
    style G fill:#3b82f6
```

---

## 📝 Legend

- 🔵 **Blue**: Frontend/Client-side
- 🟢 **Green**: Database/Storage
- 🟠 **Orange**: Backend Services
- 🟢 **WhatsApp Green**: WhatsApp-related components

---

**Created**: 2026-02-07  
**Version**: 1.0
