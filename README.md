# Pilma Hotel Reception Stock & POS

A responsive website for the Pilma Hotel reception team. Receptionists sign in individually but share the same product stock, sales and stock history through Supabase.

## Included

- Mobile and desktop responsive interface
- Email/password accounts for receptionists
- Shared product list, prices and quantities
- One-tap “Sell 1” checkout
- Database-side atomic sale handling: checks stock, subtracts quantity, records the sale and logs the movement together
- Add/edit/hide products
- Restock entries with history
- Low-stock alerts
- Sales report by date and CSV export
- Persistent cloud database and realtime refresh for products and sales

## Important limitations

- This starter records cash sales from the one-tap button. The database supports mobile money, card and other as payment method, but you should add a payment-method selector before using those methods in production.
- This does not charge a customer's Mobile Money account or process card payments. Actual payment processing needs a separate payment provider and integration.
- All authenticated users have equal receptionist permissions in this starter. Anyone who can sign in can add/edit products and hide products. For manager-only permissions, add a staff-role system before production.
- Sales reports display the latest 500 sales fetched by the app. For a large operation, use a paginated report or database reporting view.
- The app uses local browser time to group dates in reports. Confirm that devices use Ghana time.
- Supabase Auth email confirmation may need to be configured. For a small internal team, a manager can create accounts in Supabase Dashboard > Authentication > Users, or allow sign-up and verify each user.

## 1. Create the cloud database

1. Visit https://supabase.com/ and create a project for Pilma Hotel.
2. Choose a strong database password and keep it private.
3. Open **SQL Editor** in the Supabase dashboard.
4. Open `supabase/schema.sql` from this project, copy all its contents, paste into SQL Editor and click **Run**.
5. Open **Project Settings → API** (or the project's Connect/API page). Copy the Project URL and the publishable key / anon key. The browser app uses the public anon/publishable key with Row Level Security. **Never put the service-role key in the website.**

## 2. Run the website on a computer

Install Node.js (the current LTS version) from https://nodejs.org/.

Extract the ZIP, open a terminal in the `pilma-hotel-pos` folder, and run:

```bash
npm install
```

Copy `.env.example` to a new file named `.env` in the project root. Fill it in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Do not include quotes unless needed, and do not share your `.env` file publicly. Then run:

```bash
npm run dev
```

Vite will show a local URL, usually `http://localhost:5173`. Open it in your browser.

## 3. Set up receptionist accounts

- Create the first user using the app's **Create account** link, or add users in Supabase Dashboard → Authentication → Users.
- If email confirmation is enabled, the user must confirm their email before signing in. Configure email confirmation in Supabase Auth settings if needed.
- Create a separate account for each receptionist. They will all see the same stock and sales because the data is in the shared Supabase project.
- Do not share one login among staff; individual accounts help identify who recorded a transaction in the database.

## 4. Start using the POS

1. Sign in.
2. Open **Products & Stock → Add product**.
3. Enter the item name, selling price in Ghana cedis, and low-stock alert threshold.
4. Save the product.
5. Press **Restock** and enter the quantity physically in stock.
6. Go to **Sales / Checkout** and tap **Sell 1** when a customer buys one item.
7. Check **Sales reports** for revenue and transactions, and export a date's report as CSV.
8. Check **Stock history** to audit sales deductions and restocks.

For multiple units of the same item, tap **Sell 1** once for each unit. The database locks the product row during a sale, so two receptionists selling the final unit at nearly the same time cannot both successfully sell it.

## 5. Publish it so phones and computers can use it

For the first test, use the local URL on your computer. To test on another device on the same Wi-Fi, Vite's network URL may work, but it is not a permanent public website.

To publish it:
1. Push this project to a private GitHub repository, or upload it to a trusted hosting provider.
2. Create a Vercel or Netlify project from the repository.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the hosting provider's environment variables.
5. Deploy, then open the published HTTPS link on each phone/computer.
6. In Supabase Auth URL configuration, set the site's production URL as the Site URL and add it to the allowed redirect URLs.
7. Test on two devices: sign in on both, sell one item on one device, and confirm stock changes on the other.
8. Back up your database and review staff access before using it for real business transactions.

A custom domain such as `pilmahotel.com` can be connected later through the hosting provider's domain settings, provided you own/register the domain.

## Security and operations checklist before live use

- Use HTTPS hosting.
- Keep the service-role key private.
- Create accounts only for trusted staff.
- Enable strong passwords and consider MFA.
- Test sales/restocks using sample products first.
- Check stock quantities against a physical count before launch.
- Set up regular database backups.
- Consider manager permissions and a refund/void workflow before relying on reports for accounting.

## Project structure

```text
pilma-hotel-pos/
├── index.html
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   └── styles.css
└── supabase/
    └── schema.sql
```
