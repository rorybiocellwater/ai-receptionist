# AI Receptionist — Setup Guide
# ════════════════════════════════════════════════════════
# Plain-English step-by-step. No technical experience needed.
# Takes about 45 minutes. Follow each step in order.
# ════════════════════════════════════════════════════════


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Install Node.js (if you haven't already)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://nodejs.org
2. Click the big green "LTS" download button
3. Run the installer — just click Next on everything
4. When done, open a Terminal (Mac) or Command Prompt (Windows)
5. Type:  node --version
   You should see something like:  v20.11.0
   If you do, Node.js is installed correctly. ✓


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Install the app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Put the ai-phone-app folder somewhere on your computer
   (e.g. your Desktop or Documents folder)

2. Open Terminal / Command Prompt
3. Navigate to the folder by typing:
      cd Desktop/ai-phone-app
   (adjust the path to wherever you put it)

4. Type:  npm install
   Wait for it to finish. It will download a few small files.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Set up Twilio (your Irish phone number)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You need this because Vapi needs a phone number to answer.
Twilio gives you one. Cost: about €1/month.

1. Go to https://www.twilio.com and create a free account
2. Verify your email and mobile number
3. In the Twilio dashboard, click "Phone Numbers" → "Buy a number"
4. Search for Irish (+353) numbers
5. Buy one (free trial credit covers this)
6. Write down your Twilio number — you'll need it shortly


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Set up Vapi (the AI voice brain)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4a. Create a Vapi account
    1. Go to https://dashboard.vapi.ai
    2. Sign up for a free account

4b. Create your AI assistant
    1. Click "Assistants" in the left sidebar
    2. Click "Create Assistant"
    3. Choose "Blank Template"
    4. Give it a name (e.g. "Reception Assistant")
    5. In the System Prompt box, paste this (edit the business name):

    ────────────────────────────────────────────────
    You are a friendly receptionist for [YOUR BUSINESS NAME].
    Your job is to:
    1. Greet the caller warmly
    2. Ask for their name
    3. Ask for their phone number or email address
    4. Ask them to briefly describe the reason for their call
    5. Thank them and let them know someone will be in touch soon
    
    Keep the conversation friendly and brief. 
    Do not make up information about the business.
    If asked a question you cannot answer, say you will pass the 
    message on and someone will call them back.
    ────────────────────────────────────────────────

    6. Under "First Message", type something like:
       "Good morning, thank you for calling [Business Name], 
        how can I help you today?"

    7. Click "Publish" or "Save"
    8. You'll see an Assistant ID at the top of the page
       — copy and save it (looks like: asst_xxxxxxxxxxxx)

4c. Import your Twilio number into Vapi
    1. Click "Phone Numbers" in the left sidebar
    2. Click "Import"
    3. Select "Twilio" and follow the steps to connect your
       Twilio account and import the number you bought in Step 3
    4. Once imported, set the "Inbound Assistant" to the
       assistant you just created

4d. Get your Vapi API key
    1. Click your account icon (top right) → "API Keys"
    2. Create a new key and copy it — save it somewhere safe

4e. Set up the webhook (so Vapi tells your app about calls)
    1. In Vapi, go to your Assistant settings
    2. Find "Server URL" or "Webhook URL"
    3. For now, leave this — we'll come back in Step 6


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Set up Gmail to send you call notifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The app uses Gmail to email you after each call.
You need to create an "App Password" — a special one-time 
password just for this app (not your normal Gmail password).

1. Go to https://myaccount.google.com
2. Click "Security" in the left menu
3. Make sure "2-Step Verification" is turned ON
   (if not, turn it on first)
4. Go back to Security and search for "App passwords"
5. Click "App passwords"
6. Under "Select app" choose "Mail"
7. Under "Select device" choose "Other" and type "AI Receptionist"
8. Click "Generate"
9. You'll see a 16-character password like: xxxx xxxx xxxx xxxx
   COPY THIS NOW — Google will never show it again
   (You can always generate a new one if you lose it)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Configure the app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. In your ai-phone-app folder, find the file called:
      .env.example

2. Make a COPY of it and rename the copy to:
      .env
   (just .env — no .example at the end)
   
   NOTE: On Mac/Windows this file may be hidden because it starts
   with a dot. That's fine — it still works.

3. Open .env in any text editor (Notepad, TextEdit, etc.)

4. Fill in your details:

   EMAIL_FROM=        ← your Gmail address
   EMAIL_APP_PASSWORD= ← the 16-char App Password from Step 5
   EMAIL_TO=          ← where you want call summaries sent
                        (can be the same Gmail, or any email)
   VAPI_API_KEY=      ← your Vapi API key from Step 4d
   VAPI_ASSISTANT_ID= ← your Assistant ID from Step 4b

5. Save the file


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Start the app and make it accessible online
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7a. Start the app
    1. In your Terminal (in the ai-phone-app folder), type:
          npm start
    2. You should see:  ✅ AI Receptionist server running on http://localhost:3000
    3. Open a browser and go to:  http://localhost:3000
       You should see your dashboard!

7b. Make it accessible to Vapi (Vapi needs to reach your app)
    Vapi's servers need to send data to your app after each call.
    For this you need a tool called ngrok (free):

    1. Go to https://ngrok.com and create a free account
    2. Download ngrok and install it
    3. In a NEW Terminal window (keep the app running in the other),
       type:
          ngrok http 3000
    4. You'll see a line like:
          Forwarding  https://abc123.ngrok.io → localhost:3000
    5. Copy that https://... URL

7c. Add the webhook URL to Vapi
    1. Go back to your Vapi assistant settings
    2. Find "Server URL" / "Webhook URL"
    3. Paste your ngrok URL + /webhook/vapi
       Example:  https://abc123.ngrok.io/webhook/vapi
    4. Save


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — Test it!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Call your Twilio number from your mobile
2. Your AI receptionist should answer and greet you
3. Have a short conversation — give a fake name and message
4. After the call ends, check your email — you should receive
   a summary within about 30 seconds
5. Refresh your dashboard at http://localhost:3000 —
   the call should appear there too

If it works: 🎉 You're all set!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTIONAL — Forward your existing office number to Twilio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

So callers dial your normal number and the AI answers:

1. Call your phone provider (Vodafone, Eir, etc.)
2. Ask them to set up "unconditional call forwarding" 
   (or "divert all calls") to your Twilio number
3. This is a standard feature — most providers offer it
4. Once set up, anyone calling your normal number will be
   answered by the AI automatically


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEEPING IT RUNNING LONG-TERM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The setup above runs on your own computer.
This means the app stops when your computer sleeps or restarts.

For a permanent always-on setup, consider hosting on:
- Railway.app (easiest, free tier available)
- Render.com (free tier available)
- A cheap VPS like Hetzner (~€4/month)

These are simple to set up and mean your receptionist
answers calls 24/7 without your computer needing to be on.
Ask for help with this step if you need it.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI doesn't answer the call?
→ Check that the Twilio number has your Vapi assistant assigned
→ Check that your Vapi assistant is published/saved

Not receiving emails?
→ Double-check your Gmail App Password in the .env file
→ Make sure 2-Step Verification is on in your Google account
→ Check your spam folder

Dashboard not loading?
→ Make sure the app is still running (npm start in terminal)
→ Go to http://localhost:3000

Call appears in dashboard but no email?
→ Check the EMAIL_TO address in your .env file
→ Look at the terminal window for any error messages

ngrok URL changed?
→ Free ngrok URLs change every time you restart ngrok
→ You'll need to update the webhook URL in Vapi each time
→ A paid ngrok account gives you a permanent URL (~$8/month)
   or use a hosting service (see "Keeping it running" above)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEED HELP?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Come back to Claude and describe exactly where you got stuck.
Include any error messages you see in the terminal window.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
