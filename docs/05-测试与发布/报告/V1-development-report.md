{
  "schema": "test-report/development/v1",
  "kind": "development",
  "version": "V1",
  "status": "pending",
  "environment": "local",
  "clean_checkout": true,
  "note": "Development baseline report - full testing pending",
  "steps": [
    {
      "command": "npm install",
      "exit_code": 0
    },
    {
      "command": "npm run build",
      "exit_code": 0
    }
  ],
  "services": [
    {
      "name": "api",
      "url": "http://localhost:3000/health",
      "http_status": 200,
      "ready": true
    }
  ]
}
