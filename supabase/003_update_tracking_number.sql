-- Update the Google Ads tracking number to use your real Twilio number.
-- Run this in the Supabase SQL Editor.

update public.tracking_numbers
set phone_number = '+15034611991',
    label = 'Google Ads — Portland Tow (Primary)'
where source = 'google_ads';
