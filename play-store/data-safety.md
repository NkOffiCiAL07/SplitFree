# Data safety form: answers based on the actual code

Sources: `prisma/schema.prisma`, the API routes, `src/lib/{email,notify,rates}.ts`, `public/sw.js`, `src/app/privacy/page.tsx`. Nothing here is guessed.

## Top-level questions
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS only; Supabase and Vercel use TLS) |
| Do you provide a way for users to request that their data be deleted? | **Yes**: in-app *Settings → Delete account*, and the web page https://www.splitr.pro/delete-account |

## Data types
"Shared" below means sent to a third party *other than a service provider acting on our behalf*. Supabase (database/auth), Vercel (hosting), Resend (email delivery) and the browser's push service process data only to run Splitr, so they are **service providers**, which Google does not count as "sharing".

| Data type | Collected | Shared | Purpose | Optional? | Notes |
|---|---|---|---|---|---|
| **Name** (Personal info) | Yes | No | App functionality, account management | Required | Shown to people in your groups |
| **Email address** (Personal info) | Yes | No | App functionality, account management, communications (invites, reminders) | Required | Never shown to other users |
| **Phone number** (Personal info) | Yes | No | Account management | Required to sign up | Not verified, never shown to others, never used for marketing |
| **User IDs** (Personal info) | Yes | No | App functionality | Required | Internal account ID |
| **Other info: UPI ID** (Personal info) | Yes | No | App functionality (so friends can pay you) | Optional | Shown to people who owe you |
| **Photos** (Photos and videos) | Yes (only the Google profile photo URL if you sign in with Google) | No | Account management | Optional | There is no photo upload |
| **Other financial info**: expenses, amounts, who owes whom, payments recorded | Yes | No | App functionality | Required for the core feature | *Not* payment card or bank data; Splitr does not process payments |
| **Other user-generated content**: group names, expense descriptions, notes, comments, reactions | Yes | No | App functionality | Required for the core feature | |
| **Device or other IDs**: web-push endpoint | Yes (only if you turn push notifications on) | No | App functionality (notifications) | Optional | Removed when you turn it off or delete the account |
| **App activity / interactions** | No | | | | There is no analytics SDK |
| **App info and performance** (crash logs, diagnostics) | No | | | | No crash-reporting SDK |
| **Location, Contacts, Calendar, Audio, Health, Web browsing, SMS/Call log, Files** | No | | | | Not accessed |
| **Advertising ID** | No | | | | No ads |

## Security practices
- Data encrypted in transit: **Yes**
- You can request data deletion: **Yes**
- Independent security review: **No** (do not claim one)
- Follows Play's Families policy: **No** (the app is not for children)

## Additional declarations
- **Ads:** the app contains no ads.
- **Financial features (Play policy):** Splitr tracks shared expenses. It is not a loan, banking, investment, crypto or payments-processing app. In the declaration, choose the option that says it offers none of the listed financial services (personal loans, banking, investment, trading, crypto, insurance, payments).
- **Government apps / health apps / news apps:** none apply.
- **Account creation:** the app lets users create an account in-app, therefore the account deletion declaration applies (done: link above).

## Keep this in sync
If you ever add analytics, crash reporting, ads, photo upload or phone verification, update this file, the privacy policy page and the Play Console form *before* releasing.
