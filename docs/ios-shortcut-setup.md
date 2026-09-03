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

## Capture a task with a deadline
`url` is optional — a `title` alone is a valid capture, which is how you get
"email the recruiter by Friday" into the Inbox in two taps without a page to
share. Build a second Shortcut ("Add task to MediaLog") with no share-sheet
input, an **Ask for Input** action for the task text, and this JSON body:

```json
{
  "token": "<your capture token>",
  "title": "Email the recruiter",
  "due_at": "2026-09-11T17:00:00Z",
  "note": ""
}
```

- `title` — required when there is no `url`. Sending neither is a `bad_request`.
- `due_at` — optional ISO 8601 timestamp. Anything that isn't a real date is
  rejected with a `bad_request` rather than saved, so build it from a **Date**
  action (Format Date → custom `yyyy-MM-dd'T'HH:mm:ssZ`) instead of typing it.
- `note` — leave blank. A non-empty note becomes the entry's title, which would
  override the `title` you sent.

All three fields work alongside `url` too, so the share-sheet Shortcut above can
gain an "Ask Each Time" deadline without any other change.

## Security note
The `secret` is stored inside the Shortcut on your device. If it leaks, rotate it:
`supabase secrets set CAPTURE_SECRET=<new>` and update the Shortcut.
