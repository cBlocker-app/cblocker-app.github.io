# CBlocker - extension (milestone 2: commitment mode)

Blocks two categories (social media and adult sites, short sample lists) plus sites
you add by hand, with one access window per category. Commitment mode (7, 14 or 30
days) keeps your rules from being loosened until it ends.

## Test it in Chrome
1. Unzip, open chrome://extensions, turn on "Developer mode", "Load unpacked", pick the folder.
   (If you already loaded the previous version, click the reload icon on the CBlocker card.)
2. In settings, turn on a category, set a window that does NOT include the current time, Save.
3. Click "Allow block screen". Open a blocked site: the CBlocker screen should appear.
4. Commitment mode: choose a length, tick the box, "Save and start commitment mode".
   Then try to turn the category off, lengthen the window or remove a site: it should refuse.
   You CAN shorten the window, add sites and increase the wait.
5. TESTING TIP: to end commitment mode early while testing, open the extension's service
   worker console (chrome://extensions > CBlocker > "service worker") and run:
   chrome.storage.local.remove("commitmentUntil")

## Not built yet
Wait screen with personal text, phrase, unlock, license, icon.
