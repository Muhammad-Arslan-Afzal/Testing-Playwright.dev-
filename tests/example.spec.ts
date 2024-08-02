import { test, expect } from '@playwright/test';
import fs, { existsSync } from 'fs';
import fsPromises from 'fs/promises'; // Use fs/promises for promise-based file operations
import https from 'https';
import path from 'path';
import { execSync } from 'child_process'; // Used for executing shell commands
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { PDFDocument } from 'pdf-lib';

// Function to sanitize filenames
function sanitizeFilename(filename: string) {
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

// Function to resize an image to a target width and height, filling the extra space with a background color
function resizeImage(image, targetWidth, targetHeight, backgroundColor = { r: 255, g: 255, b: 255, a: 255 }) {
  const resizedImage = new PNG({ width: targetWidth, height: targetHeight });

  // Fill the resized image with the background color
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const idx = (targetWidth * y + x) << 2;
      resizedImage.data[idx] = backgroundColor.r;
      resizedImage.data[idx + 1] = backgroundColor.g;
      resizedImage.data[idx + 2] = backgroundColor.b;
      resizedImage.data[idx + 3] = backgroundColor.a;
    }
  }

  // Copy the original image data into the resized image
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const srcIdx = (image.width * y + x) << 2;
      const destIdx = (targetWidth * y + x) << 2;
      resizedImage.data[destIdx] = image.data[srcIdx];
      resizedImage.data[destIdx + 1] = image.data[srcIdx + 1];
      resizedImage.data[destIdx + 2] = image.data[srcIdx + 2];
      resizedImage.data[destIdx + 3] = image.data[srcIdx + 3];
    }
  }

  return resizedImage;
}

// Function to compare two images and generate a diff image
async function compareImages(expectedScreenshot, currentScreenshot, diffPath, threshold = 0.1) {
  // Read the images
  const img1 = PNG.sync.read(await fsPromises.readFile(expectedScreenshot));
  const img2 = PNG.sync.read(await fsPromises.readFile(currentScreenshot));

  // Get the dimensions of the larger image
  const targetWidth = Math.max(img1.width, img2.width);
  const targetHeight = Math.max(img1.height, img2.height);

  // Resize both images to the target dimensions
  const resizedImg1 = resizeImage(img1, targetWidth, targetHeight);
  const resizedImg2 = resizeImage(img2, targetWidth, targetHeight);

  // Compare the images
  const diff = new PNG({ width: targetWidth, height: targetHeight });
  const numDiffPixels = pixelmatch(
    resizedImg1.data,
    resizedImg2.data,
    diff.data,
    targetWidth,
    targetHeight,
    { threshold }
  );

  // If there are differences, write the diff image to disk
  if (numDiffPixels > 0) {
    await fsPromises.writeFile(diffPath, PNG.sync.write(diff));
  } else {
    // Delete the diff image if it exists and has no differences
    if (existsSync(diffPath)) {
      await fsPromises.unlink(diffPath);
    }
  }

  // Return the number of differing pixels
  return numDiffPixels;
}

// Function to get the number of pages in a PDF
async function getPdfPageCount(pdfPath) {
  const pdfBytes = await fsPromises.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

async function processTemplate(page, template, views, diffExist) {
  for (let v = 0; v < views.length; v++) {
    await page.locator('#ComboBox178-input').click();
    await page.getByRole('option', { name: `${template}`, exact: true }).first().click(); // Only select the first matching option
    await page.getByRole('combobox', { name: 'View' }).click();
    await page.getByRole('option', { name: `${views[v]}`, exact: true }).click();
    await page.waitForTimeout(5000); 
    await handlePdfComparison(page, template, views[v], diffExist);
  }
}

async function handlePdfComparison(page, template, view, diffExist) {
  const embedElement = await page.locator('embed');
  const pdfUrl = await embedElement.getAttribute('src');
  const pdfName = extractStringFromUrl(pdfUrl);

  const sanitizedTemplate = sanitizeFilename(template);
  const sanitizedView = sanitizeFilename(view);
  const fileformat = `${sanitizedTemplate}_${sanitizedView}`;
  const fileDir = path.join('testPdf', `${fileformat}`);
  const pdfFilePath = path.join(fileDir, `${pdfName}.pdf`);
  const expectedDir = path.join(fileDir, `${pdfName}_expected`);
  const currentDir = path.join(fileDir, `${pdfName}_current`);
  const diffDir = path.join(fileDir, `${pdfName}_diff`);

  await fsPromises.mkdir(fileDir, { recursive: true });
  await fsPromises.mkdir(expectedDir, { recursive: true });
  await fsPromises.mkdir(currentDir, { recursive: true });
  await fsPromises.mkdir(diffDir, { recursive: true });

  if (!fs.existsSync(pdfFilePath)) {
    const file = fs.createWriteStream(pdfFilePath);
    await new Promise((resolve, reject) => {
      https.get(pdfUrl!, function (response) {
        response.pipe(file);
        file.on('finish', function () {
          file.close();
          // console.log(`${fileformat}\n PDF Download Completed`);
          resolve(true);
        });
        file.on('error', reject);
      }).on('error', reject);
    });
  } else {
    // console.log(`${fileformat}\nPDF file already exists.`);
  }

  const pdfPageCount = await getPdfPageCount(pdfFilePath);
  const expectedFiles = fs.readdirSync(expectedDir).filter(file => file.endsWith('.png'));
  const currentFiles = fs.readdirSync(currentDir).filter(file => file.endsWith('.png'));

  if (expectedFiles.length !== pdfPageCount || expectedFiles.length === 0) {
    // console.log(`Generating expected PNG files for ${pdfName}...`);
    convertPdfToPng(pdfFilePath, path.join(expectedDir, `${pdfName}_expected`));
  } else if (currentFiles.length !== pdfPageCount || currentFiles.length === 0) {
    // console.log(`Generating current PNG files for ${pdfName}...`);
    convertPdfToPng(pdfFilePath, path.join(currentDir, `${pdfName}_current`));
  } else if (expectedFiles.length !== currentFiles.length) {
    console.error(`For ${fileformat}\n Expected or current PNG files were not generated or expected and current have different number of pages`);
  }

  for (const expectedFile of expectedFiles) {
    const currentFile = expectedFile.replace('expected', 'current');
    const expectedScreenshotPath = path.join(expectedDir, expectedFile);
    const currentScreenshotPath = path.join(currentDir, currentFile);
    const diffScreenshotPath = path.join(diffDir, `diff_${expectedFile}`);

    try {
      const numDiffPixels = await compareImages(expectedScreenshotPath, currentScreenshotPath, diffScreenshotPath);
      if (numDiffPixels > 0) {
        diffExist.push(true);
        // console.log(`Comparing ${expectedFile} with ${currentFile}`);
        // console.log(`Number of differing pixels: ${numDiffPixels}`);
        console.log(`Diff file created for ${fileformat} Directory`)
        console.log(`Diff image created at: ${diffScreenshotPath}`);
      }
    } catch (error) {
      console.error(`Error comparing images: ${error.message}`);
    }
  }
}

function extractStringFromUrl(url) {
  const lastSegment = url.substring(url.lastIndexOf('/') + 1);
  const fileNameWithoutExtension = lastSegment.substring(0, lastSegment.lastIndexOf('.'));
  const desiredString = fileNameWithoutExtension.split('_')[0];
  return desiredString;
}

function convertPdfToPng(pdfPath, pngBasePath) {
  execSync(`pdftoppm -png "${pdfPath}" "${pngBasePath}"`);
}

test('pCon-basket', async ({ page }) => {
  test.setTimeout(9000000);
  await page.goto('https://cd.easterngraphics.com/apps/pcon/pcon.basket-online/wbk/master/');

  await page.getByText('Open Project').click();
  await page.getByText('Click to select').click();

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('div.dropzoneText-165').first().click()
  ]);
  await fileChooser.setFiles('club_sofa_100524-131811.obk');

  await page.getByRole('tab', { name: 'Report' }).click();
  await page.waitForTimeout(5000);
  const templates = ["pCon.ui Sitag"];
  // const templates = ["Quote", "Article Overview", "Product Comparison", "pCon.ui Sitag", "UI Product sheet FOP", 
  //   "Room-Planner: article list scholl", "pCon.facts ui Wini", "pCon.facts Product Sheet",
  //   "pCon.basket Standard Quote  (expires 10/2023)", "UI Product sheet WeibelWeibel FOP",
  //   "Facts: Product sheet FOP", "UI Product sheet Leuwico FOP", "pConUi", "Walter Knoll Quote",
  //   "Facts Product Comparison", "Sedus Quote", "UI Product sheet Hammerbacher FOP",
  //   "pCon.basket KN Overview", "Wilkhahn", "UI Product sheet Sitag FOP", "Walter Knoll Budget",
  //   "pCon.facts ui Hammerbacher", "pCon.basket Norengros Offer - FOP", "pCon.ui Profim",
  //   "pConUi Gärtner Möebel", "pCon.ui KN", "pCon.basket Sedus Standard Quote ", "pCon.basket KN TypeList",
  //   "pCon.facts Brochure", "Overview", "pCon.basket CE", "pCon.basket KN Standard Quote ", 
  //   "UI Product Sheet Bakker Elkhuizen FOP", "pCon.basket HW Standard  Quote", 
  //   "pCon.basket Norengros", "pConUi Filex - FOP", "pCon facts Product Comparer"
  //   , "pCon.facts Standard Quote", "UI Product sheet Profim FOP", "UI Product sheet Rockfon FOP",
  //   "pCon.basket KN Delivery", "UI Product sheet Wini FOP", "UI Product sheet Schonbuch FOP",
  //   "Facts: article list", "Walter K. Budget", "Walter K. Quote", "UI Product Sheet KN FOP",
  //   "pConUiLeuwico", "pCon.ui WeibelWeibel", "UI product Sheet Gartner Moebel FOP",
  //   "Facts: article list STDB2B_WBK", "pCon.basket HW Logistics", "pCon.ui Blanco",
  //   "pConUi Filex",  "Klöber Quote", "pCon.RoomPlanner Leidhäuser ArticleList FOP"
  // ];
  const views = ["Summarized", "Summarized-Compact"];
  // const views = ["Summarized", "Summarized-Compact", "Compact", "Detailed", "Flat list"];
  const diffExist: boolean[] = [];

  for (let t = 0; t < templates.length; t++) {
    if (templates[t] === "Product Comparison") {
      await page.locator('#ComboBox178-input').click();
      await page.getByRole('option', { name: `${templates[t]}`, exact: true }).first().click(); // Only select the first matching option
      await page.waitForTimeout(5000);
      await handlePdfComparison(page, templates[t], "", diffExist);
    } else {
      await processTemplate(page, templates[t], views, diffExist);
    }
  }
  expect(diffExist.includes(true)).toBe(false);
});


