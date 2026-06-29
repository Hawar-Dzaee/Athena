---
description: Launch the Athena dev server and open it in the browser
---

## How to run Athena

1. Kill anything on port 3000 that isn't Athena (check first):

```bash
# See what's on port 3000
lsof -i :3000
```

If the process is NOT from `/Users/hawardizayee/Desktop/Galaxy/Athena`, kill it:

```bash
lsof -ti :3000 | xargs kill -9
```

2. Check if Athena is already running (Next.js logs its PID and port in `.next/dev/logs/`):

```bash
# If a next dev process is already running for Athena it will say so and give you the port
npm run dev 2>&1 | head -20
```

If it prints "Another next dev server is already running" with `Dir: .../Athena`, just open the listed port (usually 3001 when 3000 was stolen).

3. Otherwise start the server:

```bash
npm run dev > /tmp/athena-dev.log 2>&1 &
```

Wait for "Ready":

```bash
until grep -q "Ready" /tmp/athena-dev.log 2>/dev/null; do sleep 1; done
grep "Local:" /tmp/athena-dev.log | tail -1
```

4. Open in browser:

```bash
open http://localhost:3000   # or 3001 if that's what the log showed
```

## Notes

- Dev command is `npm run dev` (uses `--webpack` flag internally — do not change to Turbopack).
- The app lives at `/Users/hawardizayee/Desktop/Galaxy/Athena`.
- Always open in the **web browser**, not the terminal.
