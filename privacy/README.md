# DSR Endpoint Documentation

## `POST /api/dsr/export`

- Access: `org_admin` only
- Behavior: Returns JSON export of all practice and provider records.
- Response: `200 OK` with full data payload.

## `POST /api/dsr/delete`

- Access: `org_admin` only
- Behavior: Soft-deletes practice and provider records by setting `deletedAt`, and schedules purge at `purgeAfter` exactly 30 days later.
- Response: `202 Accepted` with purge timestamp.

## PHI and sensitivity notes

Credential records are not PHI on their own, but linked provider records are sensitive and must be handled as confidential data during export and deletion workflows.
