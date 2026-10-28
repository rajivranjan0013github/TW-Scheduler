# ThousandPost platform review checklist

Updated October 26, 2026. This is a preparation guide, not evidence that production or platform dashboard checks have passed. Submit only after deploying the matching frontend and backend and completing the live checks below.

## Reviewer access and policy acceptance

- Provision a dedicated creator reviewer with `npm run reviewer:provision` in the backend, using temporary `REVIEWER_EMAIL`, `REVIEWER_PASSWORD`, and optional `REVIEWER_NAME` values.
- The reviewer must have `role=editor` and `userType=account_handler`. Give it access only to disposable review channels and content.
- Supply credentials through the platform's private reviewer-instructions field. Do not put passwords in recordings, source files, or public pages. Rotate or disable them after review.
- On first sign-in, the reviewer sees the October 26 policy update. Show the Privacy Policy and Terms links, the initially unchecked acceptance box, and explicit acceptance before using the app.
- Existing channel owners must also accept this version. Until then, comment collection, Inbox processing, queued replies, and new channel authorization are blocked. Do not pre-mark users or reviewers as accepted in the database.
- Settings, My Channels, disconnection, deletion, and sign-out remain available without accepting. Connecting a new channel still requires acceptance.

## Public and callback URLs

- Homepage: `https://thousandpost.com/`
- Privacy policy: `https://thousandpost.com/privacy-policy`
- Terms: `https://thousandpost.com/terms-and-conditions`
- Data deletion instructions: `https://thousandpost.com/data-deletion`
- Meta deletion callback: `https://thousandpost.com/api/auth/meta-data-deletion`
- Meta deauthorization callback: `https://thousandpost.com/api/auth/meta-deauthorize`
- Facebook redirect: `https://thousandpost.com/auth/facebook/callback`
- Instagram redirect: `https://thousandpost.com/auth/instagram/callback`
- YouTube redirect: `https://thousandpost.com/auth/youtube/callback`

Match the configured URLs exactly. Open the three legal pages while signed out and confirm they show October 26, 2026 and include comments, DMs, Inbox, retention, and deletion. Confirm Meta's crawler can access the URLs using the Sharing Debugger; a browser-only check does not establish crawler access.

## Permissions and visible uses

### Facebook Pages

| Permission | Demonstration |
| --- | --- |
| `pages_show_list` | List and select a Facebook Page the user manages. |
| `pages_read_engagement` | Show Page post performance in Analytics. |
| `pages_manage_posts` | Publish the user's selected post to the selected Page. |
| `pages_manage_metadata` | Subscribe the Page to `feed` and `messages` webhooks; show a new comment/message arriving. |
| `pages_read_user_content` | Show comments and available commenter names in Automations → Comments. |
| `pages_manage_engagement` | Send a manual public reply and a keyword-triggered automatic public reply. |
| `pages_messaging` | Send an eligible private reply to a commenter, then read and answer a Messenger conversation in Inbox. |

For Facebook Login for Business, verify `META_LOGIN_CONFIG_ID` requests these same permissions in its dashboard configuration. A configured login flow does not use the fallback scope list in the code.

### Instagram Login

| Permission | Demonstration |
| --- | --- |
| `instagram_business_basic` | Identify and show the connected Professional account. |
| `instagram_business_content_publish` | Publish the user's selected image, Reel, or carousel. |
| `instagram_business_manage_insights` | Show account-authorized performance metrics. |
| `instagram_business_manage_comments` | Show comments, send a public reply, and run a keyword reply rule. |
| `instagram_business_manage_messages` | Read a DM conversation and send a reply from Inbox; also demonstrate the private-reply use case. |

Instagram uses its separate Instagram Login flow. Do not request legacy Facebook Login Instagram permissions for this build.

### Google OAuth / YouTube

| Scope | Demonstration |
| --- | --- |
| `https://www.googleapis.com/auth/youtube.upload` | Upload with the user's selected title, description, visibility, audience, and disclosure choices. |
| `https://www.googleapis.com/auth/youtube.readonly` | Identify the channel and retrieve its videos and performance. |
| `https://www.googleapis.com/auth/youtube.force-ssl` | Read comments and send manual or authorized automatic public replies. |

Existing YouTube channels may need to reconnect to grant comment access. Show the comment-use disclosure before Google authorization. YouTube has no DM or Inbox feature in ThousandPost.

## Review recording and instructions

Record the real production flow in English using disposable accounts and real provider responses. Include full OAuth and permission-grant steps; do not use mocked data, hidden tokens, or edited-out authorization steps in the submitted recording.

1. Open the homepage, sign in as the reviewer, review the policies, and explicitly accept.
2. Open My Channels, connect a reviewer-controlled channel, and show the full provider consent flow.
3. Publish a disposable post with the user's selected content and settings; show its performance.
4. Open Automations → Comments, receive a new comment from a separate test person, and send a manual public reply.
5. Create an enabled keyword rule for a specific disposable post, with public reply text and (Meta only) private reply text. Comment the keyword and show both results on the social platform and the delivery results in Activity.
6. Send a DM from the separate test person. Open Inbox, read it, and reply within 24 hours of the person's message. Show YouTube is excluded from Inbox.
7. Explain that a comment-specific private reply is a single message within the eligible period; it does not open an unrestricted follow-up conversation. Demonstrate an expired Inbox thread blocking sends, using a naturally expired test thread.
8. Pause the rule, comment the keyword again, and verify that no further automatic reply is sent. Delete the rule if it is no longer needed.
9. Disconnect a disposable channel. Verify its local tokens, profile, cached API data, comments, messages, rules, activity, and queued automation work are removed.
10. Demonstrate deletion using a disposable user and confirm the associated database and object-storage records are removed. This deletes ThousandPost's copies, not messages or posts already held by social platforms.

## Production acceptance checks

- Run backend and frontend `npm test`, then frontend `npm run build`. Deploy the matching builds together, including rebuilt `dist` files if deployment serves the checked-in build.
- Verify `NODE_ENV=production`, `DEMO_MODE=false`, and the intended background-sync setting. Revocation cleanup runs independently of optional background sync.
- Verify encryption keys, HTTPS, restricted origins, and redirect allowlists. Legacy tokens are encrypted automatically during backend database connection when the encryption key is configured. Back up the key securely and do not rotate it without a migration.
- Confirm provider credentials never appear in account or OAuth response bodies. Verify database indexes for YouTube engagement expiry and queued-job cleanup.
- Confirm old and new users must explicitly accept the current policy; direct API calls and queued comment jobs must not bypass acceptance. A user/admin preview must not accept on another person's behalf.
- Revoke a disposable YouTube grant through Google settings. The independent authorization check runs at startup and every 12 hours; after detection the channel is disabled, cleanup runs every minute, and failures retry. Confirm all associated Authorized Data is erased. Reconnect only after cleanup finishes.
- Exercise a valid Meta signed deletion request in the disposable environment and verify the returned confirmation URL. Do not send fabricated or destructive requests for a real customer's account.
- Verify Meta Business Verification, required Advanced Access, data-processing questions, Data Use Checkup, Google OAuth scope verification, domain ownership, and reviewer instructions in their dashboards. Code and local tests cannot establish these states.

## Primary platform references

- [Meta privacy policy expectations](https://developers.facebook.com/documentation/development/terms-and-policies/privacy-policy)
- [Instagram private replies](https://developers.facebook.com/documentation/instagram-platform/private-replies)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
