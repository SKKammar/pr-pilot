import base64
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from app.github_client import GitHubClient, _load_private_key

# Generate a small RSA private key for fast in-memory testing
def _generate_test_pem() -> str:
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return pem.decode("utf-8")


TEST_PEM = _generate_test_pem()


def test_load_private_key_raw_pem(monkeypatch):
    monkeypatch.setenv("GITHUB_PRIVATE_KEY", TEST_PEM)
    loaded = _load_private_key()
    assert loaded is not None
    assert "BEGIN PRIVATE KEY" in loaded


def test_load_private_key_base64(monkeypatch):
    b64_key = base64.b64encode(TEST_PEM.encode("utf-8")).decode("utf-8")
    monkeypatch.setenv("GITHUB_PRIVATE_KEY", b64_key)
    loaded = _load_private_key()
    assert loaded is not None
    assert "BEGIN PRIVATE KEY" in loaded


def test_github_client_jwt_generation():
    client = GitHubClient(app_id="12345", private_key=TEST_PEM)
    jwt_token = client._generate_jwt()
    assert isinstance(jwt_token, str)
    assert len(jwt_token.split(".")) == 3  # Header.Payload.Signature


def test_github_client_missing_credentials(monkeypatch):
    monkeypatch.delenv("GITHUB_APP_ID", raising=False)
    monkeypatch.delenv("GITHUB_PRIVATE_KEY", raising=False)
    client = GitHubClient(app_id="", private_key=None)
    client.app_id = ""
    client.private_key = ""
    with pytest.raises(ValueError):
        client._generate_jwt()
