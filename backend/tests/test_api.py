import hashlib
import hmac
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
SECRET = "test_webhook_secret_key_12345"


def _make_headers(event: str, body: bytes, delivery_id: str = "deliv-12345"):
    sig = "sha256=" + hmac.new(SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return {
        "X-GitHub-Event": event,
        "X-Hub-Signature-256": sig,
        "X-GitHub-Delivery": delivery_id,
        "Content-Type": "application/json",
    }


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"
    assert data.get("service") == "PR Pilot"


def test_stats_endpoint():
    resp = client.get("/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_reviews" in data
    assert "total_errors" in data


def test_webhook_ping_event():
    body = b'{"zen": "Non-blocking is better than blocking."}'
    headers = _make_headers("ping", body)
    resp = client.post("/webhook", content=body, headers=headers)
    assert resp.status_code == 200
    assert resp.json().get("status") == "pong"


def test_webhook_invalid_signature():
    body = b'{"action": "opened"}'
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalid_hash",
        "X-GitHub-Delivery": "test-delivery-id",
        "Content-Type": "application/json",
    }
    resp = client.post("/webhook", content=body, headers=headers)
    assert resp.status_code == 401


def test_webhook_pr_opened_enqueues_job():
    payload = {
        "action": "opened",
        "pull_request": {
            "number": 101,
            "title": "Add user authentication feature",
            "user": {"login": "santosh", "type": "User"},
            "draft": False,
            "head": {"sha": "abc1234567890"},
        },
        "repository": {
            "full_name": "SKKammar/pr-pilot",
            "name": "pr-pilot",
            "owner": {"login": "SKKammar"}
        },
        "installation": {"id": 9999}
    }
    body = json.dumps(payload).encode("utf-8")
    headers = _make_headers("pull_request", body, delivery_id="deliv-99999")

    resp = client.post("/webhook", content=body, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "queued"
    assert data.get("delivery_id") == "deliv-99999"
