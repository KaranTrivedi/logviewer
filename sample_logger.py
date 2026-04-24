"""
test_logger.py — generates random log output to test LogWatch

Usage:
  python test_logger.py | python logwatch_bridge.py
  python test_logger.py 2>&1 | python logwatch_bridge.py
"""

import logging
import random
import time
import sys

# Custom handler that flushes after each write
class FlushingFileHandler(logging.FileHandler):
    def emit(self, record):
        super().emit(record)
        self.flush()

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(levelname)s] %(asctime)s — %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    handlers=[FlushingFileHandler("logs/app.log")]
)

loggers = [
    logging.getLogger("app.server"),
    logging.getLogger("app.database"),
    logging.getLogger("app.auth"),
    logging.getLogger("app.cache"),
    logging.getLogger("app.worker"),
]

MESSAGES = {
    logging.DEBUG: [
        "Cache hit for key '{key}' (TTL: {n}s remaining)",
        "SQL query executed in {n}ms: SELECT * FROM {table} WHERE id={n}",
        "Worker {n} picked up job {job_id}",
        "Heartbeat received from node-{n}",
        "Session token refreshed for user_{n}",
        "Config reloaded: {n} keys updated",
        "Retry {n}/3 for task {job_id}",
    ],
    logging.INFO: [
        "Server listening on 0.0.0.0:{port}",
        "User user_{n} logged in from 192.168.1.{n}",
        "Request handled: GET /api/v1/items — 200 OK ({n}ms)",
        "Request handled: POST /api/v1/orders — 201 Created ({n}ms)",
        "Scheduled job 'daily_sync' completed in {n}s",
        "New connection established: client-{n}",
        "Uploaded file processed: report_{n}.csv ({n} rows)",
        "Email sent to user_{n}@example.com",
        "Background task 'cleanup' finished: {n} records deleted",
    ],
    logging.WARNING: [
        "Memory usage at {n}% — approaching limit",
        "Slow query detected ({n}ms): consider adding an index",
        "Rate limit at {n}/1000 for IP 10.0.0.{n}",
        "Disk usage at {n}% on /dev/sda1",
        "Deprecated endpoint /api/v0/users called by client-{n}",
        "Connection pool at {n}% capacity",
        "Retrying failed request to external service (attempt {n}/3)",
    ],
    logging.ERROR: [
        "Failed to connect to Redis: Connection refused (attempt {n})",
        "Unhandled exception in worker-{n}: NullPointerException",
        "Payment gateway timeout after {n}ms for order_{n}",
        "Failed to write to log file: Permission denied",
        "Email delivery failed for user_{n}@example.com: SMTP error 550",
        "Database deadlock detected — transaction rolled back",
        "API call to external service returned 503 after {n}ms",
    ],
    logging.CRITICAL: [
        "DISK FULL on /dev/sda1 — writes are failing!",
        "Database primary is unreachable — failover initiated",
        "Memory exhausted: OOM killer invoked on worker-{n}",
        "SSL certificate expires in {n} hours — renewal failed",
        "Security alert: {n} failed login attempts from 192.168.1.{n}",
    ],
}

# Weighted distribution to mimic real logs
LEVEL_WEIGHTS = [
    (logging.DEBUG,    30),
    (logging.INFO,     45),
    (logging.WARNING,  15),
    (logging.ERROR,     8),
    (logging.CRITICAL,  2),
]

LEVELS, WEIGHTS = zip(*LEVEL_WEIGHTS)
TABLES = ["users", "orders", "products", "sessions", "events", "payments"]
JOB_IDS = [f"job_{random.randint(1000,9999)}" for _ in range(20)]


def random_message(level):
    template = random.choice(MESSAGES[level])
    return template.format(
        n=random.randint(1, 999),
        key=f"cache:{random.choice(TABLES)}:{random.randint(1,500)}",
        table=random.choice(TABLES),
        job_id=random.choice(JOB_IDS),
        port=random.choice([8080, 8443, 3000, 5000]),
    )


def main():
    interval_min = 0.2
    interval_max = 1.2

    try:
        while True:
            logger = random.choice(loggers)
            level  = random.choices(LEVELS, weights=WEIGHTS, k=1)[0]
            logger.log(level, random_message(level))
            time.sleep(random.uniform(interval_min, interval_max))
    except KeyboardInterrupt:
        print("[INFO] test_logger.py stopped", flush=True)


if __name__ == "__main__":
    main()