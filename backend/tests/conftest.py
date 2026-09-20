import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app.* imports work in tests
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set dummy environment variables for tests
os.environ["GITHUB_WEBHOOK_SECRET"] = "test_webhook_secret_key_12345"
os.environ["GITHUB_APP_ID"] = "123456"
os.environ["FRONTEND_URL"] = "http://localhost:3000"
os.environ["SUPABASE_URL"] = "https://mock.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "mock_service_role_key"
