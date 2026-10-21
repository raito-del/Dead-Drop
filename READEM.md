# Dead Drop — Made by Team BreakByte

## ফাইল স্ট্রাকচার
- `index.html` — হোম পেজ (হ্যাকার অ্যানিমেশন)
- `notes.html` — PDF লিস্ট + আপলোডার
- `style.css` — থিম ফাইল (এটা বদলালেই পুরো লুক বদলে যাবে)
- `js/config.js` — এখান থেকেই Firebase / GitHub সুইচ করবে
- `js/firebase-mode.js`, `js/github-mode.js` — দুই মোডের কোড আলাদা
- `notes/` — GitHub মোডে PDF এখানে রাখবে

## ১. GitHub Pages চালু
1. নতুন **public** রিপোজিটরি বানাও, সব ফাইল আপলোড করো।
2. Settings → Pages → Branch: `main` / root → Save।
3. কিছুক্ষণ পর `https://raito-del.github.io/Dead-Drop/` লিঙ্ক পাবে।

## ২. Firebase মোড (শুরুতে এটা)
1. Firebase console-এ প্রজেক্ট বানাও, Web app যোগ করো, config কপি করে `js/config.js`-এ বসাও।
2. Authentication → Email/Password চালু করো, নিজের জন্য একটা ইউজার বানাও।
3. Storage চালু করো, Rules-এ এটা বসাও:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /notes/{file} {
      allow read: if true;
      allow write: if request.auth != null
        && request.resource.contentType == 'application/pdf'
        && request.resource.size < 25 * 1024 * 1024;
    }
  }
}
```
4. Authentication → Settings → Authorized domains-এ `raito-del.github.io` যোগ করো।
5. `notes.html` খুলে লগইন করো, তারপর PDF আপলোড করো।

## ৩. GitHub মোডে শিফট (Firebase-এ কার্ড চাইলে)
1. `js/config.js`-এ `MODE = "github"` লিখো, আর `GITHUB` অংশে নিজের username/repo বসাও।
2. PDF গুলো রিপোজিটরির `notes/` ফোল্ডারে আপলোড করো (notes.html-এর বাটন সরাসরি GitHub আপলোড পেজ খুলবে)।
3. কমিট করলেই সাইটে লিস্ট আপডেট হবে।

## নোট
- লোকালে `file://` দিয়ে খুললে চলবে না, কারণ ES modules লাগে। VS Code-এর Live Server বা `python -m http.server` ব্যবহার করো।
- GitHub মোডে রিপোজিটরি public হতে হবে।

