# Backend

## Boundaries

- Validate external input with Zod or framework pipes.
- Keep API DTOs explicit.
- Include request IDs in structured logs.

## Local Services

```bash
docker compose up -d
```

## Observability

- Add error tracking before production.
- Define service-level metrics for latency, error rate, and throughput.
