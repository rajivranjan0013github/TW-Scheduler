# ThousandPost platform review checklist

Use this checklist only after the current frontend and backend have been deployed to `https://thousandpost.com` and the production smoke tests pass.

## Reviewer access

- Provision the reviewer with `npm run reviewer:provision` in the backend. The command requires temporary `REVIEWER_EMAIL` and `REVIEWER_PASSWORD` environment values.
- Submit that email and temporary password through the platform's private reviewer-instructions field. Never place credentials in source code, screenshots, public pages, or this file.
- Confirm the account has `role=editor` and `userType=account_handler`.
- Rotate or disable the password after review.

## Public and callback URLs

- Homepage: `https://thousandpost.com/`
- Privacy policy: `https://thousandpost.com/privacy-policy`
- Terms: `https://thousandpost.com/terms-and-conditions`
- Data deletion instructions: `https://thousandpost.com/data-deletion`
- Meta data deletion callback: `https://thousandpost.com/api/auth/meta-data-deletion`
- Meta deauthorization callback: `https://thousandpost.com/api/auth/meta-deauthorize`
- Facebook redirect: `https://thousandpost.com/auth/facebook/callback`
- Instagram redirect: `https://thousandpost.com/auth/instagram/callback`
- YouTube redirect: `https://thousandpost.com/auth/youtube/callback`

The URLs configured in Meta and Google must match these values exactly, including scheme, host, path, and trailing-slash behavior.

## Requested permissions and visible use cases

### Facebook Login

- `pages_show_list`: show the Pages the user manages and let the user choose a Page to connect.
- `pages_read_engagement`: display Page post views, reactions/likes, and comment counts in analytics.
- `pages_manage_posts`: publish user-selected text, photo, and video content to the selected Page.

Facebook Login connects Facebook Pages only. Instagram accounts use the separate Instagram Login flow.

### Instagram Login

- `instagram_business_basic`: identify and display the connected professional account.
- `instagram_business_content_publish`: publish the user's selected image, reel, or carousel.
- `instagram_business_manage_insights`: display authorized performance metrics and comment counts.

### Google OAuth / YouTube Data API

- `youtube.upload`: upload the selected video with the exact title, description, privacy, audience, and disclosure choices entered by the user.
- `youtube.readonly`: identify the connected channel and retrieve the channel's videos and performance statistics.

## End-to-end reviewer steps

1. Open the homepage and sign in with the privately supplied email credentials.
2. Open **My Channels**.
3. Connect the reviewer-controlled Facebook Page, Instagram professional account, or YouTube channel.
4. Review the provider consent screen and approve the requested permissions.
5. Open **Schedule**, explicitly select one destination, and select or upload media.
6. For YouTube, enter a title and description; choose Public, Unlisted, or Private; answer Made for Kids; set the altered/synthetic-content disclosure; and certify Community Guidelines compliance.
7. Select **Now** to exercise publishing, or select a future time to exercise scheduling.
8. Open **Analytics** and show the metrics associated with the connected channel.
9. Open **My Channels** and disconnect an account to demonstrate provider revocation and local deletion.
10. Open **Settings** and demonstrate the complete workspace-deletion path if requested by the reviewer.

## Demonstration video

Record one continuous, narrated video per platform that shows:

1. The public homepage and privacy policy.
2. Reviewer sign-in.
3. The full OAuth consent screen, with every requested permission visible.
4. Channel selection and the exact feature that uses each permission.
5. A successful publish and analytics retrieval.
6. Disconnect/revocation and the data-deletion instructions.

Do not use mock data, admin-only screens, hidden shortcuts, pre-authorized tokens, or edited-out consent steps in the demonstration.

## Final production checks

- `NODE_ENV=production`, `DEMO_MODE=false`, `ENABLE_BACKGROUND_SYNC=true`.
- `SOCIAL_TOKEN_ENCRYPTION_KEY` is present and backed up securely; changing it without migrating tokens will make existing credentials unreadable.
- `ALLOWED_ORIGINS` includes the exact production origin.
- `META_GRAPH_API_VERSION` is set to the supported version tested in production.
- Email login, all OAuth redirects, upload, publish-now, future scheduling, analytics, disconnect, and deletion work in a clean browser session.
- Meta Business Verification, Advanced Access, Google branding verification, authorized domains, consent-screen contacts, and publisher-domain ownership are complete in their respective dashboards.
