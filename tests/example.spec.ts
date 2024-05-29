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
    await expect(page.getByLabel('Name')).toBeVisible({timeout:10000});
    await expect(page).toHaveScreenshot();


    await page.getByRole('tab', { name: 'Article List' }).click();
    await expect(page.getByText('Image')).toBeVisible({timeout:10000});
    await expect(page).toHaveScreenshot();


    await page.getByRole('tab', { name: 'Calculation' }).first().click();
    await expect(page.locator('div').filter({ hasText: /^Purchase$/ }).nth(1)).toBeVisible({timeout:10000});
    // await expect(page.getByText('Description').nth(1)).toBeVisible({timeout:10000});
    await expect(page).toHaveScreenshot();


    await page.getByRole('tab', { name: 'Report' }).click();
    await expect(page.getByText('Templates')).toBeVisible({timeout:10000});
    await expect(page).toHaveScreenshot();


    await page.getByRole('tab', { name: 'Order' }).click();
    await expect(page.getByText('Quote Data')).toBeVisible({timeout:10000});
    await expect(page).toHaveScreenshot();





// await page.getByRole('link', { name: 'Quote' }).click();
//     const nameValue = await page.getByLabel('Name').inputValue();
//     console.log("Name : ", nameValue)
    
//     if (nameValue === "club sofa") {
//   console.log('Name matches expected value');
// } else {
//   console.log('Name does not match expected value');
//     }
    //check value using builtin matcher/assertion
    // await expect(page.getByLabel('Name')).toHaveValue("club sofa");
    ///////////////////////////////////////////////////////
    /////////////screenshoot comparison code///////////////
    //https://medium.com/@jalpa.gandhi/how-to-perform-screenshot-comparison-in-playwright-145d542d9bbb
    // await expect(page).toHaveScreenshot("NamePageComparison.png");
    // await expect(page.locator("input[id=TextField172]")).toHaveScreenshot("NameFieldComparison.png");
    /* For the first time take baseline screeshot and then implement change in textfield/ pixels
    rerun the test and result will be in test-results directory */
    // page.locator("input[id=TextField172]").fill("club");
    // await expect(page.locator("input[id=TextField172]")).toHaveScreenshot("NameFieldComparison.png");
    
});