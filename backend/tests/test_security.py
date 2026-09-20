import hashlib
import hmac
import pytest
from app.main import verify_signature

SECRET = "test_webhook_secret_key_12345"

def _make_signature(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()


def test_verify_signature_valid(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    body = b'{"action": "opened", "pull_request": {"number": 42}}'
    sig = _make_signature(SECRET, body)
    assert verify_signature(body, sig) is True


def test_verify_signature_tampered_body(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    body = b'{"action": "opened"}'
    sig = _make_signature(SECRET, body)
    tampered_body = b'{"action": "opened", "injected": true}'
    assert verify_signature(tampered_body, sig) is False


def test_verify_signature_wrong_secret(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    body = b'{"action": "opened"}'
    wrong_sig = _make_signature("wrong_secret_key", body)
    assert verify_signature(body, wrong_sig) is False


def test_verify_signature_missing_prefix(monkeypatch):
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", SECRET)
    body = b'{"action": "opened"}'
    raw_hash = hmac.new(SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    assert verify_signature(body, raw_hash) is False
    assert verify_signature(body, "") is False
