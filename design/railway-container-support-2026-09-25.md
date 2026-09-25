# Railway Support Draft: Repeated CREATE_CONTAINER Stall

Status: draft, not submitted. Obtain approval before posting. Refresh the latest deployment state before submission.

Update at 2026-09-25 16:21 UTC: staging is restored using replacement service
`fef7af7c-e3c3-4977-8294-c3a123a4242e`, retaining the original database, volume and hostname.
Normal release `729f62d8-6556-4456-a5e1-5abee0442588` is successful, with live API and asset verification.
The old service no longer receives the original hostname's traffic. Its inconsistent instance state
remains unresolved; a platform root cause is not established. Details below describe the historical outage.

Our old staging web service repeatedly stalled at CREATE_CONTAINER after successful builds. This was staging, not a production outage.

- Project: `9371f53f-3043-4a19-b25f-a55d891fb46a`
- Environment: staging, `ae398a3f-4f0e-4617-8c55-838d1c5b47d9`
- Service: wechurch-staging, `cf36df49-a0f4-4224-80f2-4d0e4d1c1194`
- Region: `asia-southeast1-eqsg3a`
- Persistent volume: `cbbf9530-1d9d-45ab-9e1b-f575a8d3b0aa`, mounted at `/data`
- URL: https://wechurch-staging-staging.up.railway.app

Timeline on 2026-09-25 (UTC):

1. Failed deployment `2428f4f2-8cbe-4a55-96d8-9b7ed09371b2` built and pushed successfully. Deploy logs were empty. Railway's existing automated diagnosis classified it as `infra_error`, with CREATE_CONTAINER pending, and suggested contacting support.
2. After explicitly stopping the old deployment, redeployment `0bed20b2-2bcb-4359-badd-d08f0564c52e` succeeded. Health returned 200 at 14:57:46Z.
3. Deployment `51e93a5b-c1d7-401b-a556-3951c22ad09a` also succeeded; the website and reference APIs were usable.
4. A small follow-up patch deployment `ead9d0a6-8d22-4849-9410-8a809a531038` stalled again. Retries `dfe90c2c-5c91-49f6-a9e8-cc883bee0f13` and `a834b82d-fcf3-4a01-b92c-cd178bd65e56` similarly had no application startup logs and were aborted.
5. Recovery `4c53d64f-f517-4009-85ac-e475f07385c8` redeploys the previously successful `51e93a5b` code/config. Its BUILD_IMAGE completed at 15:27:58Z, but CREATE_CONTAINER never completed after 15:28:00Z. At 15:43:30Z it became FAILED, without application startup logs.

## Full Incident Log Comparison

At 15:40:05Z we collected the available build/runtime logs and deployment events for all 15 deployments since 03:19Z: 424 build records and 3,902 runtime records. No retrieved stream reached the requested 5,000-record limit. Snapshot failures have no associated build; those retrieval gaps are recorded rather than interpreted as application failures. Raw logs remain private and are not attached to this draft.

- Successful `51e93a5b` and failed recovery `4c53d64f` reference the identical runtime image `sha256:f08d1958cd448eee68ec50c32eb99191340ad9b27b35b8fe16f5fd41f9020332`.
- Their service manifests also match the failed follow-up `ead9d0a6`: Dockerfile builder, runtime V2, one Singapore replica, `/data` mount, `/__healthcheck`, no start-command override, and sleeping disabled. This compares exposed deployment manifests, not undisclosed host internals.
- The original deployment `6f2da44e-0757-4b1f-bcfb-c1ea04a7f110` logged SIGTERM and HTTP/DB shutdown at approximately 14:14:28Z. Its last captured log was timestamped 14:14:30Z. Unlike subsequently stopped deployments, no `Stopping Container` record appeared in its retrieved stream.
- Yet at 15:40Z the API still reported that deployment as SUCCESS, `deploymentStopped: false`, with instance `a9afec60-7972-4405-a66a-1c70f2433404` RUNNING. Its state timestamp was 15:02:40Z, after shutdown. The dashboard simultaneously indicated no active service deployment, while the old detail view showed Active.
- We explicitly removed only that stale deployment at 15:41:59Z. At 15:46:52Z it was still REMOVING, with its instance REMOVING. A bounded, read-only Railway SSH attempt targeting the instance returned `Deployment instance not found`.
- Runtime log scanning found no fatal application exception, OOM, disk-full, or SQLite error. Successful integration logged an experimental SQLite warning, then served normally. This does not prove that platform/host logs contain no errors.
- At 15:46:52Z the staging health URL returned Railway 404 `Application not found`, request ID `q6nV5COlQS-hjBFo-8Y8hA`.

The evidence establishes inconsistent deployment/instance state and failure before application startup. A stuck volume attachment or scheduler state is a hypothesis, not a confirmed root cause. The public status page was operational when checked; it explicitly excludes smaller isolated incidents.

The application closes HTTP/DB connections on SIGTERM, as confirmed in the prior deployment logs. During the initial incident we did not detach the volume. Subsequently, with owner approval, we moved the same volume attachment to the replacement service and verified all 26 reference files. No volume was deleted, database recreated, authentication/healthchecks disabled, or production deployment changed. We cannot establish the exact scheduling/mounting cause from available events.

Please reconcile the stale `6f2da44e` / `a9afec60` instance state, inspect the CREATE_CONTAINER failure for `4c53d64f`, and check scheduler and persistent-volume attachment events. Do not modify the replacement service, its original hostname, database or volume attachment. We need host/control-plane evidence that is not exposed through the available application logs.

No credentials, environment-variable values, database content, or member data are included in this draft.
