# OpenCLaw Integration Guide

Complete guide for integrating OpenCLaw (or other external tools) with Auto-Harness to enable full project and task automation.

## Overview

Auto-Harness provides a comprehensive External API that allows OpenCLaw to:
- **Read projects and tasks**: List all projects, view details, monitor progress
- **Create and manage tasks**: Create tasks, update status, reorder priorities
- **Generate Roadmaps**: Auto-generate strategic roadmaps with AI
- **Generate Ideation**: Discover improvements, performance issues, security vulnerabilities
- **Monitor progress**: Real-time development progress tracking
- **Full automation**: Complete autonomous project management

## Architecture

```
┌─────────────────┐
│   OpenCLaw      │
│  (External Tool) │
└────────┬────────┘
         │ HTTP/WebSocket
         ▼
┌─────────────────────────────────┐
│  Auto-Harness External API      │
│  - RESTful API                  │
│  - WebSocket (real-time events) │
│  - CLI Tool                     │
└────────┬────────────────────────┘
         │ IPC
         ▼
┌─────────────────────────────────┐
│  Auto-Harness Core              │
│  - Project Management           │
│  - Task Execution               │
│  - Roadmap Generation           │
│  - Ideation                     │
└─────────────────────────────────┘
```

## Quick Start

### 1. Enable External API

1. Open Auto-Harness settings
2. Navigate to **External API** section
3. Enable the API server
4. Configure security settings:
   - Set API key (or leave empty for no auth)
   - Configure allowed origins (CORS)
   - Set rate limits
   - Enable/disable write operations
5. Restart Auto-Harness

### 2. Test Connection

```bash
# Test health endpoint
curl http://localhost:3456/health

# List projects (with API key)
curl -H "X-API-Key: your-api-key" http://localhost:3456/api/projects
```

### 3. OpenCLaw Integration

OpenCLaw can now use the API to control Auto-Harness:

```python
import requests

API_BASE = "http://localhost:3456"
API_KEY = "your-api-key"  # Optional

headers = {}
if API_KEY:
    headers["X-API-Key"] = API_KEY

# List all projects
response = requests.get(f"{API_BASE}/api/projects", headers=headers)
projects = response.json()

# Get project details
project_id = projects[0]["id"]
response = requests.get(f"{API_BASE}/api/projects/{project_id}", headers=headers)
project = response.json()

# Create a task
task_data = {
    "projectId": project_id,
    "title": "Implement user authentication",
    "description": "Add OAuth2 authentication with GitHub",
    "priority": "high",
    "autoStart": True
}
response = requests.post(f"{API_BASE}/api/projects/{project_id}/tasks", json=task_data, headers=headers)
task = response.json()
```

## API Endpoints

### Projects

#### List Projects
```http
GET /api/projects
```

**Response:**
```json
{
  "items": [
    {
      "id": "proj-123",
      "name": "My E-commerce App",
      "path": "/Users/dev/ecommerce",
      "description": "Online store",
      "createdAt": "2025-01-15T10:00:00Z",
      "lastModified": "2025-01-20T15:30:00Z",
      "isActive": true,
      "taskCount": 15,
      "completedTaskCount": 8,
      "status": "active"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50,
  "hasMore": false
}
```

#### Get Project Details
```http
GET /api/projects/{projectId}
```

**Response:**
```json
{
  "id": "proj-123",
  "name": "My E-commerce App",
  "path": "/Users/dev/ecommerce",
  "description": "Online store",
  "settings": { /* project settings */ },
  "tasks": [ /* task summaries */ ],
  "recentActivity": [ /* activity log */ ]
}
```

### Tasks

#### List Tasks
```http
GET /api/projects/{projectId}/tasks
```

#### Create Task
```http
POST /api/projects/{projectId}/tasks

{
  "projectId": "proj-123",
  "title": "Implement user authentication",
  "description": "Add OAuth2 with GitHub",
  "priority": "high",
  "autoStart": true
}
```

#### Update Task
```http
PATCH /api/projects/{projectId}/tasks/{taskId}

{
  "status": "in_progress",
  "priority": "critical"
}
```

#### Reorder Tasks
```http
POST /api/tasks/reorder

{
  "projectId": "proj-123",
  "taskIds": ["task-1", "task-3", "task-2"],
  "phase": "planning"  // Optional
}
```

### Roadmap

#### Get Roadmap
```http
GET /api/projects/{projectId}/roadmap
```

#### Generate Roadmap
```http
POST /api/projects/{projectId}/roadmap/generate

{
  "projectId": "proj-123",
  "prompt": "Focus on e-commerce features",
  "competitorAnalysis": true,
  "focusAreas": ["performance", "security"],
  "timeframe": "medium-term"
}
```

### Ideation

#### Get Ideation
```http
GET /api/projects/{projectId}/ideation
```

#### Generate Ideation
```http
POST /api/projects/{projectId}/ideation/generate

{
  "projectId": "proj-123",
  "type": "all",  // improvements, performance, security, features
  "scope": "full-project",
  "count": 10
}
```

### Progress Monitoring

#### Get Development Progress
```http
GET /api/projects/{projectId}/progress
```

**Response:**
```json
{
  "projectId": "proj-123",
  "projectName": "My E-commerce App",
  "totalTasks": 15,
  "completedTasks": 8,
  "inProgressTasks": 3,
  "pendingTasks": 4,
  "blockedTasks": 0,
  "overallProgress": 53,
  "phaseBreakdown": [
    {
      "phase": "spec",
      "total": 5,
      "completed": 4,
      "progress": 80
    },
    {
      "phase": "planning",
      "total": 3,
      "completed": 2,
      "progress": 67
    }
  ],
  "recentActivity": [ /* activity entries */ ]
}
```

## CLI Tool Usage

Auto-Harness also provides a CLI tool for terminal-based integration:

```bash
# Install CLI globally
npm install -g @auto-harness/cli

# Configure
aperant-cli configure --api-key your-key

# List projects
aperant-cli project list

# Create task
aperant-cli task create proj-123 "Add OAuth" "Implement GitHub OAuth" --priority high --auto-start

# Generate roadmap
aperant-cli roadmap generate proj-123 --competitor

# Get progress
aperant-cli progress get proj-123
```

## WebSocket Real-time Updates

Connect to WebSocket for real-time event updates:

```javascript
const ws = new WebSocket('ws://localhost:3456');

ws.onopen = () => {
  // Authenticate (if using API key)
  ws.send(JSON.stringify({
    type: 'authenticate',
    data: { apiKey: 'your-api-key' }
  }));

  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: { events: ['task.created', 'task.completed', 'roadmap.generated'] }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'task.created':
      console.log('New task created:', message.data);
      break;
    case 'task.completed':
      console.log('Task completed:', message.data);
      break;
    case 'roadmap.generated':
      console.log('Roadmap ready:', message.data);
      break;
  }
};
```

## Advanced Usage

### Batch Operations

```http
POST /api/tasks/batch

{
  "projectId": "proj-123",
  "operations": [
    {
      "type": "update_status",
      "taskId": "task-1",
      "value": "in_progress"
    },
    {
      "type": "update_priority",
      "taskId": "task-2",
      "value": "high"
    },
    {
      "type": "archive",
      "taskId": "task-3"
    }
  ]
}
```

### Ideation to Task Conversion

```http
POST /api/projects/{projectId}/ideation/{ideaId}/convert

{
  "taskTitle": "Implement suggested improvement",
  "taskDescription": "Add caching layer for database queries",
  "autoStart": true
}
```

### Webhooks

Configure webhooks to receive notifications when events occur:

```bash
# Register webhook
curl -X POST http://localhost:3456/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["task.completed", "roadmap.generated"],
    "secret": "webhook-secret"
  }'
```

## Security Best Practices

### 1. API Key Authentication
```bash
# Generate secure API key
aperant-cli configure --api-key $(openssl rand -hex 32)
```

### 2. CORS Restrictions
```json
{
  "allowedOrigins": [
    "https://openclaw.example.com",
    "https://your-tool.example.com"
  ]
}
```

### 3. Rate Limiting
```json
{
  "rateLimit": 60  // 60 requests per minute
}
```

### 4. Permission Control
```json
{
  "allowWrite": true,        // Enable task creation, updates
  "allowDangerousOps": false  // Disable task deletion, project removal
}
```

## OpenCLaw Automation Example

Complete automation workflow:

```python
import requests
import time

API_BASE = "http://localhost:3456"
HEADERS = {"X-API-Key": "your-api-key"}

class AutoHarnessController:
    def __init__(self):
        self.base_url = API_BASE
        self.headers = HEADERS

    def get_active_project(self):
        """Get the active project"""
        projects = requests.get(f"{self.base_url}/api/projects", headers=self.headers).json()
        for project in projects["items"]:
            if project["isActive"]:
                return project
        return None

    def analyze_and_plan(self, project_id):
        """Generate roadmap and ideation"""
        # Generate roadmap
        roadmap = requests.post(
            f"{self.base_url}/api/projects/{project_id}/roadmap/generate",
            json={"projectId": project_id, "competitorAnalysis": True},
            headers=self.headers
        ).json()

        # Generate ideation
        ideas = requests.post(
            f"{self.base_url}/api/projects/{project_id}/ideation/generate",
            json={
                "projectId": project_id,
                "type": "all",
                "count": 20
            },
            headers=self.headers
        ).json()

        return roadmap, ideas

    def create_tasks_from_roadmap(self, project_id, roadmap):
        """Create tasks from roadmap features"""
        created_tasks = []

        for feature in roadmap.get("features", []):
            task = requests.post(
                f"{self.base_url}/api/projects/{project_id}/tasks",
                json={
                    "projectId": project_id,
                    "title": feature["title"],
                    "description": feature["description"],
                    "priority": self.map_priority(feature["priority"]),
                    "autoStart": False
                },
                headers=self.headers
            ).json()

            created_tasks.append(task)

        return created_tasks

    def optimize_task_order(self, project_id, tasks):
        """Reorder tasks based on dependencies and priority"""
        # Sort by priority and dependencies
        sorted_tasks = sorted(tasks, key=lambda t: (
            -self.priority_value(t["priority"]),
            t["id"]
        ))

        task_ids = [t["id"] for t in sorted_tasks]

        requests.post(
            f"{self.base_url}/api/tasks/reorder",
            json={
                "projectId": project_id,
                "taskIds": task_ids
            },
            headers=self.headers
        )

    def monitor_progress(self, project_id):
        """Monitor development progress"""
        while True:
            progress = requests.get(
                f"{self.base_url}/api/projects/{project_id}/progress",
                headers=self.headers
            ).json()

            print(f"Progress: {progress['overallProgress']}%")
            print(f"Completed: {progress['completedTasks']}/{progress['totalTasks']}")

            if progress["overallProgress"] >= 100:
                break

            time.sleep(60)  # Check every minute

    @staticmethod
    def priority_value(priority):
        priority_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        return priority_map.get(priority, 0)

    @staticmethod
    def map_priority(value):
        value_map = {4: "critical", 3: "high", 2: "medium", 1: "low"}
        return value_map.get(value, "medium")

# Full automation example
controller = AutoHarnessController()

project = controller.get_active_project()
if project:
    print(f"Working on project: {project['name']}")

    # Analyze and plan
    roadmap, ideas = controller.analyze_and_plan(project["id"])

    # Create tasks from roadmap
    tasks = controller.create_tasks_from_roadmap(project["id"], roadmap)

    # Optimize task order
    controller.optimize_task_order(project["id"], tasks)

    # Monitor progress
    controller.monitor_progress(project["id"])
```

## Monitoring and Debugging

### View API Logs

Auto-Harness logs all API requests:

```bash
# View API access logs
tail -f ~/Library/Logs/Aperant/api.log

# Monitor rate limiting
grep "rate limit" ~/Library/Logs/Aperant/api.log
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:3456/health

# Authentication test
curl -H "X-API-Key: wrong-key" http://localhost:3456/api/projects

# Rate limiting test
for i in {1..150}; do
  curl http://localhost:3456/api/projects
done
```

## Troubleshooting

### Connection Refused
- Make sure External API is enabled in settings
- Check that the port is not already in use
- Restart Auto-Harness after enabling API

### Authentication Errors
- Verify API key matches in settings
- Check that X-API-Key header is set correctly
- Ensure CORS is configured for your origin

### Rate Limiting
- Increase rate limit in settings
- Implement request queuing in your tool
- Use WebSocket for real-time updates instead of polling

## Conclusion

This integration allows OpenCLaw (or any external tool) to fully automate Auto-Harness project management, from planning to completion. The combination of RESTful API, WebSocket real-time updates, and CLI tool provides flexible integration options for any workflow.

For more information or API updates, refer to the Auto-Harness documentation or check the API specification at `http://localhost:3456/health` when the server is running.
