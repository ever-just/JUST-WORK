
## 2026-09-04 — credential removed
A live GoDaddy credential was committed in `scripts/deploy-to-server.sh` in this public repository. It has been removed from HEAD and scheduled for rotation. It remains reachable in git history; rotation is the fix. Configuration secrets belong in the host platform's environment, never in a committed file.
