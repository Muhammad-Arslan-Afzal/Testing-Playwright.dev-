import { test, expect } from '@playwright/test';

  test('pCon-basket', async ({ page }) => {
  await page.goto('https://cd.easterngraphics.com/apps/pcon/pcon.basket-online/wbk/develop/');
  await page.getByText('Open Project').click();
    await page.getByText('Click to select').click();
    const path = require('path');

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      await page.locator("div.dropzoneText-165").first().click()  
    ])
    await fileChooser.setFiles("club_sofa_100524-131811.obk");
    
await page.getByRole('tab', { name: 'Header Data' }).click();
await page.getByRole('link', { name: 'Quote' }).click();
    const nameValue = await page.getByLabel('Name').inputValue();
    console.log("Name : ", nameValue)
    
    if (nameValue === "club sofa") {
  console.log('Name matches expected value');
} else {
  console.log('Name does not match expected value');
    }
    //check value using builtin matcher/assertion
    await expect(page.getByLabel('Name')).toHaveValue("club sofa");
    ///////////////////////////////////////////////////////
    /////////////screenshoot comparison code///////////////
    // await expect(page).toHaveScreenshot("NamePageComparison.png");
    // await expect(page.locator("input[id=TextField172]")).toHaveScreenshot("NameFieldComparison.png");

});