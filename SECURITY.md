# Security Policy

Nova Server Manager is an administrative control plane with root-level capabilities.

- Never expose Uvicorn directly to the public internet.
- Use HTTPS, a unique password, and firewall access restrictions where possible.
- Do not install untrusted application archives or Docker images.
- Keep Ubuntu, Docker, Python dependencies, Nginx, and Certbot updated.
- Rotate `NOVA_SECRET_KEY` only with care: changing it invalidates sessions and prevents decrypting stored Telegram credentials.
- Report vulnerabilities privately to the maintainer; do not include credentials or production backups.

