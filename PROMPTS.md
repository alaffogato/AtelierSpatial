# Project Prompts Log — Atelier Spatial

A chronological archive of all user prompts used to build **Atelier Spatial** (with access tokens redacted for security).

---

## 1. Initial Application Brief
> You are a senior front-end developer with expertise in vanilla javascript, responsive UI, and serverless functions on Vercel. Build a single-page DIY interior design advisor app with:
> - Upload function of floor plan, photos of a space
> - Mood board generator powered by Unsplash with several different options of style, colour scheme
> - Selection by user
> - Creation of 3D model based on floor plan and photos uploaded and application of selected style onto 3D model with ability for users to pan, zoom, rotate and walk through the space virtually
> - Estimation of renovation costs and links to recommended renovation contractors.
>
> Just do the front-end, I will integrate the backend later

---

## 2. Git Push (Milestone 1)
> `git push https://[REDACTED]@github.com/alaffogato/AtelierSpatial.git`

---

## 3. Vercel Serverless Unsplash Connection
> 1. Add a serverless connection that pulls images from Unsplash for moodboard generation using the following endpoint:
>    `GET https://api.unsplash.com/search/photos?query=coffee&per_page=5`
>    `# Authorization: Client-ID <UNSPLASH_ACCESS_KEY>`
>    `# Accept-Version: v1`
> 2. Store this in `/api` folder at project root level (not the `src` file)
> 3. Include `/health.ts` and `/moodboard.ts` within the same sub folder
> 4. Do not hardcode any key, I will input them later

---

## 4. Git Push (Milestone 2)
> `git push https://[REDACTED]@github.com/alaffogato/AtelierSpatial.git`

---

## 5. Landing Page, Singapore Localization & 1-Click Quotations
> 1. Add a landing page to illustrate the functions of the webapp - visualisation of floor plan, finding renovation style inspiration, getting renovation budget estimate and getting Singapore renovation contractor recommendation and convenience of 1 click button to obtain quotations based on floor plan and selected style.

---

## 6. Floor Plan Wall & Scale Scanner, Ceiling Height & Metric/Imperial Units
> 2. Rebuild the floor plan upload function to scan for walls and scale bar in the image, add user input for the height of the ceiling and regenerate the 3d model when a new plan is uploaded. Add toggle button for metric vs imperial options for dimensions and floor area with metric as the default.

---

## 7. Git Push (Milestone 3)
> `git push https://[REDACTED]@github.com/alaffogato/AtelierSpatial.git`

---

## 8. Landing Page Asset Fix
> Fix the landing page image jpg broken link with a japandi inspired interior image from Unsplash.

---

## 9. Singapore HDB 5-Room Sample Plan & Multi-Room 3D Layout
> Load sample plan from HDB 5-room flat floor plan and load sample 3d model based on a typical Singapore 5-room flat layout

---

## 10. Git Push (Milestone 4)
> `git push https://[REDACTED]@github.com/alaffogato/AtelierSpatial.git`

---

## 11. Photorealistic Photo Rendering *(initiated)*
> Generate photorealistic renderings of uploaded photos based on selected style and colour palette.

---

## 12. Design Brief PDF Export
> Export design brief to pdf and include screenshots of 3D model as well as floor plan and selected inspiration mood board

---

## 13. Prompt Archive
> collate all of the prompts and store them as a PROMPTS.md file
