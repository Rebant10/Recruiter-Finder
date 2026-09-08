# Recruiter Finder — Multi-Source Automated Lead Discovery

**Recruiter Finder** is a high-performance Chrome Extension (Manifest V3) that discovers verified recruiter, HR, and hiring manager email addresses at any target company using 10 integrated data sources and APIs.

It eliminates manual searching on LinkedIn and third-party tools by automating discovery, deduplicating contacts against your existing Google Sheets, detecting email naming patterns, and seamlessly exporting to Google Sheets for outreach with tools like **Mass Mailer**.

---

## Key Features

1. **Fully Automatic Discovery**:
   - Simply enter a company name (e.g., `Flipkart`, `Razorpay`, `Stripe`) and click **Find Recruiter Emails**.
   - Auto-resolves company domain or allows manual override.

2. **Smart Sequential Querying (Credit-Saving Engine)**:
   - Enter your target contact count (e.g. 10, 20, 50).
   - Queries configured APIs sequentially in priority order.
   - **Immediately stops** querying remaining services as soon as the target count is satisfied — never wasting your precious free API credits.

3. **Google Sheets Deduplication & Export**:
   - Provide an existing Google Sheet URL: the extension reads existing emails first and skips anyone you already have in your database.
   - 1-click export to a new spreadsheet or appends directly to an existing sheet.

4. **In-Extension Settings**:
   - Configure all your API keys right inside the extension side panel. No need to edit source code.
   - Keys are securely stored in Chrome's local extension storage.

5. **AI Email Pattern Engine**:
   - Automatically detects company email syntax from discovered leads (e.g., `{first}.{last}@company.com`).
   - Bonus feature: paste names from LinkedIn to instantly generate pattern-matching emails.

6. **Email Verification**:
   - 1-click bulk verification with QuickEmailVerification (100 free verifications/day ~ 3,000/month).
   - Color-coded badges: ✅ Valid | ⚠️ Risky | ❌ Invalid.

---

## Supported Services & Free Tiers

| # | Service | Type | Free Capacity | Reset | Filter By Role | Signup Link |
|---|---|---|---|---|---|---|
| 1 | **Hunter.io** | Email Finder | 50 credits/mo | Monthly | ✅ `department=hr` | [hunter.io/users/sign_up](https://hunter.io/users/sign_up) |
| 2 | **Snov.io** | Email Finder | 50 credits/mo | Monthly | Filtered by title | [app.snov.io/register](https://app.snov.io/register) |
| 3 | **Tomba.io** | Email Finder | 25 credits/mo | Monthly | ✅ `department=hr` | [app.tomba.io/auth/register](https://app.tomba.io/auth/register) |
| 4 | **GetProspect** | Email Finder | 50 credits/mo | Monthly | ✅ Title filter | [getprospect.com/signup](https://getprospect.com/signup) |
| 5 | **Prospeo.io** | Email Finder | 75 credits/mo | Monthly | ✅ Title search | [app.prospeo.io/register](https://app.prospeo.io/register) |
| 6 | **Dropcontact** | Finder / Enrichment | 50 credits | One-time trial | Title filter | [app.dropcontact.com/signup](https://app.dropcontact.com/signup) |
| 7 | **AnyMailFinder** | Email Finder | 100 credits | One-time trial | Domain search | [anymailfinder.com/signup](https://anymailfinder.com/signup) |
| 8 | **Serper.dev** | Google SERP Search | 2,500 queries | One-time | Public web search | [serper.dev](https://serper.dev) |
| 9 | **SerpApi** | Google SERP Search | 250 queries/mo | Monthly | Public web search | [serpapi.com/users/sign_up](https://serpapi.com/users/sign_up) |
| 10 | **QuickEmailVerification** | Verification | 100 verifications/day | Daily reset (~3,000/mo) | Deliverability check | [quickemailverification.com/register](https://quickemailverification.com/register) |

---

## Installation & Setup

### 1. Load the Extension into Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the directory: `D:\Recruiter Finder`.
5. The **Recruiter Finder** extension icon will appear in your Chrome toolbar. Click it to open the Side Panel.

### 2. Configure Google OAuth (for Google Sheets Export)
To export contacts directly to your Google Sheets account:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. You can use your existing project (e.g. from Mass Mailer) or create a new one.
3. Ensure the **Google Sheets API** is enabled.
4. Under **Credentials**, create or locate your **OAuth 2.0 Client ID** (Application type: *Chrome Extension*).
5. Open [manifest.json](file:///D:/Recruiter%20Finder/manifest.json) and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID.
6. In `chrome://extensions/`, find the extension's Extension ID and ensure it is registered in your Google Cloud OAuth Client ID configuration.
7. Click the reload icon on `chrome://extensions/` to apply changes.

### 3. Add Your Free API Keys
1. Open the Recruiter Finder side panel.
2. Click the gear icon (**⚙️**) in the top right.
3. Sign up for any of the free services listed above and paste the corresponding API keys.
4. Click **Save Settings**. (You don't need all 10 to start; even 1 or 2 will work right away!).

---

## How to Use

1. **Enter Company Name**: Type `Flipkart`, `Amazon`, `Google`, etc.
2. **Domain Resolution**: Click **Detect** or let the extension auto-resolve `flipkart.com`.
3. **Set Target Count**: Choose how many emails you want (e.g., 20).
4. **(Optional) Deduplicate Sheet**: Paste your existing Google Sheet URL. The extension will read existing emails and skip them.
5. **Click "Find Recruiter Emails"**:
   - Watch the live progress bar as it queries Hunter, Snov, Tomba, etc.
   - Once the target count is reached, it stops querying to conserve your credits.
6. **Review Discovered Contacts**:
   - Check/uncheck rows or filter by keyword.
   - Click **Verify All** to check email deliverability.
   - If a pattern is detected (e.g., `first.last@company.com`), optionally paste additional names to generate emails.
7. **Export to Google Sheets**:
   - Click **Export to Sheet** → Choose **Create New Spreadsheet** or **Append to Existing Sheet**.
   - Click **Export Now** and open your sheet directly!
