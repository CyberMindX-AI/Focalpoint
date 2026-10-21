# Account data on the phone

The website home reads papers from this browser's IndexedDB (`PastQStudent` / localforage) and scores from that same browser, then copies score summaries to Supabase `exam_sessions`. Question text stays on the Hostinger library API. It is not stored in Supabase.

The phone was showing "Your first paper" because its home only rendered a paper after the questions had been saved in the phone's files. A score stored in Supabase was also hidden until a local paper existed. A failed library request could look the same as a new account.

The public library contains the installed paper as a normal bundle. The live website (checked 20 Oct 2026, `App-CX0auzFm.js`) writes `exam_sessions` with `source_bundle_id` and does not yet write `user_metadata.installed_library`. The phone therefore recovers a paper by joining a synced exam session to the public catalog. The website source now also publishes `{id, title, questionCount}` into `user_metadata.installed_library` when a signed-in user opens the updated site. That publish does not move question text. It reaches the phone only after the website is deployed and opened while signed in.

A catalog or history request that fails stays an error with Try again. It is not shown as "Your first paper." "Ready offline" appears only after the question list is saved on the device.

"Ready offline" is shown only when the question list is on the device. Otherwise the home card offers a download of that same bundle.
