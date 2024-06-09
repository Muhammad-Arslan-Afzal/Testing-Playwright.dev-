import { test, expect } from '@playwright/test';

test('pCon-basket', async ({ page }) => {
  // Go to the page
  await page.goto('https://cd.easterngraphics.com/apps/pcon/pcon.basket-online/wbk/master/');

  // Open the project
  await page.getByText('Open Project').click();
  await page.getByText('Click to select').click();

  // Handle file chooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('div.dropzoneText-165').first().click()
  ]);
  await fileChooser.setFiles('club_sofa_100524-131811.obk');

  // Navigate to the 'Report' tab
  await page.getByRole('tab', { name: 'Report' }).click();

  // Intercept network requests and capture the PDF response
  // let pdfBuffer: Buffer | null = null;
  // page.on('response', async (response) => {
  //   // console.log("response body",response.body())
  //   const url = response.url();
  //   if (response.request().resourceType() === 'document' && url.endsWith('.pdf')) {
  //     pdfBuffer = await response.body();
  //     console.log(`PDF downloaded from ${url}`);
  //   }
  // });

  // Perform actions that trigger the PDF download
  // (this might need adjustment based on the actual behavior of the site)
  await page.waitForTimeout(5000); // wait for the PDF to be generated and downloaded

  // Save the PDF buffer or use it as needed
  // if (pdfBuffer) {
  //   console.log('PDF content captured.');
  //   // Example: save the PDF buffer to a file
  //   const fs = require('fs');
  //   fs.writeFileSync('downloaded_report.pdf', pdfBuffer);
  // } else {
  //   console.log('No PDF was captured.');
  // }
});
