import { test, expect } from '@playwright/test';
import fs, { existsSync } from 'fs';
import fsPromises from 'fs/promises';
import https from 'https';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { PDFDocument } from 'pdf-lib';
import { pdfToPng } from "pdf-to-png-converter";

// Function to sanitize filenames
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

// Function to compare two images and generate a diff image
async function compareImages(expectedScreenshot, currentScreenshot, diffPath, threshold = 0.1) {
  // Read the images
  const img1 = PNG.sync.read(await fsPromises.readFile(expectedScreenshot));
  const img2 = PNG.sync.read(await fsPromises.readFile(currentScreenshot));

  // Check if the image dimensions are equal
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(`Image size mismatch: ${expectedScreenshot} (${img1.width}x${img1.height}) vs ${currentScreenshot} (${img2.width}x${img2.height})`);
  }

  // Compare the images
  const diff = new PNG({ width: img1.width, height: img1.height });
  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    img1.width,
    img1.height,
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
      https.get(pdfUrl, function (response) {
        response.pipe(file);
        file.on('finish', function () {
          file.close();
          resolve(true);
        });
        file.on('error', reject);
      }).on('error', reject);
    });
  }

  const pdfPageCount = await getPdfPageCount(pdfFilePath);
  const expectedFiles = fs.readdirSync(expectedDir).filter(file => file.endsWith('.png'));
  const currentFiles = fs.readdirSync(currentDir).filter(file => file.endsWith('.png'));

  if (expectedFiles.length !== pdfPageCount || expectedFiles.length === 0) {
    await convertPdfToPng(pdfFilePath, expectedDir, `${pdfName}_expected`);
  } else if (currentFiles.length !== pdfPageCount || currentFiles.length === 0) {
    await convertPdfToPng(pdfFilePath, currentDir, `${pdfName}_current`);
  } else if (expectedFiles.length !== currentFiles.length) {
    throw new Error(`Mismatch in number of pages for ${fileformat}. Expected: ${expectedFiles.length}, Current: ${currentFiles.length}`);
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
        console.log(`Diff image created at: ${diffScreenshotPath}`);
      }
    } catch (error) {
      console.error(`Error comparing images: ${error.message}`);
      throw error; // Immediately fail the test if there's an error during comparison
    }
  }
}

function extractStringFromUrl(url) {
  const lastSegment = url.substring(url.lastIndexOf('/') + 1);
  const fileNameWithoutExtension = lastSegment.substring(0, lastSegment.lastIndexOf('.'));
  const desiredString = fileNameWithoutExtension.split('_')[0];
  return desiredString;
}

async function convertPdfToPng(pdfPath, outputDir, baseName) {
  const opts = {
    disableFontFace: true,
    useSystemFonts: false,
    viewportScale: 2.0,
    outputFolder: outputDir,
    outputFileMask: baseName,
    verbosityLevel: 0
  };

  await pdfToPng(pdfPath, opts);
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
  const views = ["Summarized", "Summarized-Compact"];
  const diffExist: boolean[] = [];

  for (let t = 0; t < templates.length; t++) {
    if (templates[t] === "Product Comparison") {
      await page.locator('#ComboBox178-input').click();
      await page.getByRole('option', { name: `${templates[t]}`, exact: true }).first().click();
      await page.waitForTimeout(5000);
      await handlePdfComparison(page, templates[t], "", diffExist);
    } else {
      await processTemplate(page, templates[t], views, diffExist);
    }
  }

  // Immediately fail the test if any differences were found
  expect(diffExist.includes(true)).toBe(false);
});
