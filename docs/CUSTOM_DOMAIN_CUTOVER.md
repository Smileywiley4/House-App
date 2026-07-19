# Custom domain cutover

Use this checklist after branding is final and before submitting the site to AdSense. Replace `https://app.example.com`
with the final HTTPS origin; do not include a trailing slash in environment variables.

1. **Vercel**
   - Add and verify the domain on the `house-app` project.
   - Set `VITE_SITE_URL` to the final origin in Production and Preview as appropriate.
   - Set `VITE_OG_IMAGE_URL` after the branded social image is available.
   - Keep the existing Vercel URL as a redirect/alias during cutover.

2. **Railway**
   - Set `APP_PUBLIC_URL` to the final origin.
   - Add the final origin to `CORS_ORIGINS`; retain the Vercel origin until cutover is verified.
   - Redeploy the backend.

3. **Supabase Auth**
   - Authentication → URL Configuration: set **Site URL** to the final origin.
   - Add `https://app.example.com/**` to **Redirect URLs**.
   - Keep the Vercel callback temporarily during verification.

4. **Google OAuth**
   - Add the final origin under **Authorized JavaScript origins**.
   - Supabase remains the OAuth redirect handler; retain its callback URI exactly as shown in Supabase.

5. **Google AdSense**
   - Add the final domain as the site submitted for review.
   - Set `VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-...` in Vercel.
   - Set the approved ad-unit slot variables.
   - The build automatically adds the `google-adsense-account` verification meta tag and generates `/ads.txt`.
   - Publish Google&apos;s certified consent messages before enabling live ads or Vignette ads.

6. **Search and verification**
   - Confirm `/robots.txt`, `/sitemap.xml`, `/ads.txt`, Privacy, Terms, login, OAuth, checkout returns, property search,
     and the Railway API work on the final domain.
   - Submit the final-domain sitemap in Google Search Console.
   - Verify that guests/free accounts see eligible ad placements and paid accounts do not load them.

Never update the unrelated `gasworks-site` Vercel project.
