const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173/ADW_App/';

const menuItems = [
  { name: '01-prehled', label: 'Přehled' },
  { name: '02-ke-schvaleni', label: 'Ke schválení' },
  { name: '03-schvalene', label: 'Schválené' },
  { name: '04-prehled-reditelstvi', label: 'Přehled ředitelství' },
  { name: '05-organizace', label: 'Organizace' },
  { name: '06-ciselniky', label: 'Číselníky' },
  { name: '07-exporty', label: 'Exporty' },
  { name: '08-sluzby', label: 'Služby' },
  { name: '09-kontakty', label: 'Kontakty' },
];

async function clickMenu(page, label) {
  console.log(`Klikám na: ${label}`);

  const asideItem = page.locator('aside').getByText(label, { exact: true }).first();

  if (await asideItem.count()) {
    await asideItem.click();
    return;
  }

  const textItem = page.getByText(label, { exact: true }).first();
  await textItem.click();
}

(async () => {
  const outputDir = path.join(__dirname, '..', 'screenshots');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1000,
    },
  });

  await page.goto(BASE_URL, {
    waitUntil: 'networkidle',
  });

  for (const item of menuItems) {
    await clickMenu(page, item.label);

    await page.waitForTimeout(700);

    await page.screenshot({
      path: path.join(outputDir, `${item.name}.png`),
      fullPage: true,
    });

    console.log(`Uloženo: ${item.name}.png`);
  }

  await browser.close();

  console.log('Hotovo. Screenshoty jsou ve složce screenshots.');
})();
