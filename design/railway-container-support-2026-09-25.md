# Railway Support Draft: Repeated CREATE_CONTAINER Stall

Status: draft, not submitted. Obtain approval before posting. Refresh the latest deployment state before submission.

Our staging web service repeatedly stalls at CREATE_CONTAINER after successful builds. It currently cannot serve requests. This is staging, not a production outage.

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
5. Recovery `4c53d64f-f517-4009-85ac-e475f07385c8` redeploys the previously successful `51e93a5b` code/config. Its BUILD_IMAGE completed at 15:27:58Z, but CREATE_CONTAINER has remained pending since 15:28:00Z, without a surfaced error or deploy logs.

The application closes HTTP/DB connections on SIGTERM, as confirmed in the prior deployment logs. We have not deleted/detached the volume, recreated the database, disabled authentication/healthchecks, or changed production. We cannot establish the exact scheduling/mounting cause from available events.

Please investigate the service's container scheduling and persistent-volume attachment state, and help restore the existing service without deleting its volume or database. We need platform-level diagnosis, not an application-code review.

No credentials, environment-variable values, database content, or member data are included in this draft.
