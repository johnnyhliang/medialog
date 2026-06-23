// One-time script to set a password on an existing Supabase user.
// Run: node --env-file=.env.local scripts/set-password.js
//
// Find your USER_ID in: Supabase Dashboard → Authentication → Users → copy the UUID

import { createClient } from '@supabase/supabase-js'

const USER_ID = 'PASTE_YOUR_USER_ID_HERE'
const NEW_PASSWORD = 'PASTE_YOUR_NEW_PASSWORD_HERE'

if (USER_ID === 'PASTE_YOUR_USER_ID_HERE' || NEW_PASSWORD === 'PASTE_YOUR_NEW_PASSWORD_HERE') {
  console.error('Edit the USER_ID and NEW_PASSWORD values in this file first.')
  process.exit(1)
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.updateUserById(USER_ID, { password: NEW_PASSWORD })
if (error) {
  console.error('Failed:', error.message)
} else {
  console.log('Password set for:', data.user.email)
  console.log('You can now delete this script or clear the password from it.')
}
