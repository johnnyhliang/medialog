# iOS Shortcut — "Add to MediaLog"

Captures the current Safari page (or any shared URL/text) into your MediaLog Inbox.

## Build the Shortcut
1. Open the **Shortcuts** app → **+** → name it "Add to MediaLog".
2. Turn on **Show in Share Sheet** (settings icon at top). Under "Accept", allow **URLs** and **Text**.
3. Add action **Get Contents of URL**:
   - URL: `https://<project-ref>.functions.supabase.co/capture`
   - Method: **POST**
   - Headers: add `Content-Type` = `application/json`
   - Request Body: **JSON**, with fields:
     - `secret` (Text) = your `CAPTURE_SECRET`
     - `url` (Text) = the **Shortcut Input** (Magic Variable)
     - `note` (Text) = leave blank or add an "Ask Each Time" text prompt
4. (Optional) Add **Show Notification** with the response so you get confirmation.

## Use it
In any app → Share → **Add to MediaLog**. The link lands in your Inbox; triage it later via **Sort Inbox**.

## Security note
The `secret` is stored inside the Shortcut on your device. If it leaks, rotate it:
`supabase secrets set CAPTURE_SECRET=<new>` and update the Shortcut.
