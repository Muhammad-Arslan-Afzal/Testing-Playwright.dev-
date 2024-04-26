import { test, expect } from '@playwright/test';

// test('has title', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);
// });

// test('get started link', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });
test('pCon-basket', async ({ page }) => {
  await page.goto('https://cd.easterngraphics.com/apps/pcon/pcon.basket-online/wbk/develop/');

  const documentCard = await page.locator('.ms-DocumentCard').first().click();
  
  await expect(page.getByText('Catalog')).toBeVisible(({ timeout: 10000 }));
  // await expect(page.getByText('Catalog').click());
// Click on the "Catalog" element
  await page.click('text=Catalog');
  await page.getByLabel("Catalog").isVisible();

  

  // console.log(await page.getByLabel("New Project").click());



   // Expect a title "to contain" a substring.
  // await expect(page).toHaveTitle(/pCon.login/);


  // await page.getByPlaceholder('User name or e-mail').fill('Example Name');
  // await page.getByPlaceholder('Password').fill('Example Password');
  // await page.getByRole('button', { name: 'Log in' }).click();


  // // Expects page to have a heading with the name of Installation.
  // await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
})
