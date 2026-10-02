# PDF Combiner

Combine any number of PDFs into one file, right on your computer. Your files never leave your machine.

**Use it online:** https://oddessentials.github.io/pdf-combiner/ (nothing is uploaded; combining happens in your browser).

**Find it useful?** Please consider supporting our work: https://oddessentials.ai/donate/

Prefer to run it yourself? Follow the steps below.

## Setup (one time)

1. Install [Node.js](https://nodejs.org) (version 18 or newer).
2. Open a terminal in this folder and run:

   ```
   npm install
   ```

## Use it

1. Start the app:

   ```
   npm start
   ```

   Your browser opens automatically. If it doesn't, open the address shown in the terminal (usually http://localhost:3000).
2. Drag your PDFs onto the page, or click **Choose PDFs**.
3. Put them in order with the **↑** and **↓** buttons. Remove any with **✕**.
4. Optionally change the name under **Save as**.
5. Click **Combine PDFs**. The combined file is saved to your Downloads folder.

To stop the app, press `Ctrl+C` in the terminal.

## Troubleshooting

- **"pdf-lib is missing"**: run `npm install`, then `npm start` again.
- **Port already in use**: the app tries the next port by itself and shows the address it is using. To choose one, run `PORT=4000 npm start` (PowerShell: `$env:PORT=4000; npm start`).
- **Don't want the browser to open automatically**: run with `NO_OPEN=1`.
- **"This PDF is password-protected"**: open it in your PDF viewer, save a copy without the password, and add that copy.
- **"This file looks damaged"**: re-download or re-save the file and try again.

## Good to know

- Bookmarks, internal links, and fillable form fields may not carry over into the combined file. Page content always does.
- Very large jobs (hundreds of MB) are limited by your browser's memory and may be slow.
