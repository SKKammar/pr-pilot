import hashlib
import hmac
from fastapi import HTTPException, Request

async def verify_webhook_signature(request: Request, secret: str) -> bytes:
    """
    Verify GitHub's HMAC-SHA256 webhook signature.
    MUST be called before processing any payload.
    Returns raw body bytes on success, raises 401 on failure.
    """
    signature_header = request.headers.get("X-Hub-Signature-256")
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing signature header")

    body = await request.body()
    
    if not secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    # Use compare_digest to prevent timing attacks
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=401, detail="Invalid signature")

    return body
