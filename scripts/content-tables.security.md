# Database Transport Requirements

`content-tables.cjs` supplies connection settings for content/table exports,
imports, member cleanup, and local-admin password maintenance.

Remote connections require certificate-chain and hostname verification. Without
an explicit CA, Node's trusted certificate authorities are used. For a database
using a private CA, set `PG_CA_CERT` to the PEM certificate contents in the
operator process running the script. Programmatic callers can instead pass
`pgConfig(databaseUrl, { ca: pemCertificate })`. Neither option disables hostname
verification. Do not put database passwords or CA private keys in this setting.

Railway public PostgreSQL exports may require the database provider's explicitly
trusted CA. Verify the correct CA through an authenticated provider/operator
channel before using it. These fixes have not verified the live Railway chain.
An untrusted or mismatched certificate causes the operation to fail; there is no
automatic insecure fallback.

Remote database URLs may omit TLS parameters or specify `sslmode=verify-full`.
Other `ssl*` parameters and `uselibpqcompat` are rejected so node-postgres cannot
replace the verified TLS configuration. In particular, legacy URLs using
`sslmode=require`, `sslmode=no-verify`, `sslmode=disable`, or `ssl=0` must be
corrected before these scripts run. Supply a required custom CA through
`PG_CA_CERT`, not a URL `sslrootcert` parameter. Query-string endpoint overrides
are also rejected.

Only literal `localhost`, `127.0.0.1`, and `[::1]` retain the local-development
transport exception. `ALLOW_NON_LOCAL_IMPORT=1` authorizes applicable maintenance
commands to target a remote database; it does not weaken TLS verification.
