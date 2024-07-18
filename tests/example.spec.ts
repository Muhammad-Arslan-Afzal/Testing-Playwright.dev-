import { test, expect } from '@playwright/test';
import fs, { existsSync } from 'fs';
import fsPromises from 'fs/promises'; // Use fs/promises for promise-based file operations
import https from 'https';
import path from 'path';
import { execSync } from 'child_process'; // Used for executing shell commands
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// Function to compare two images and generate a diff image
async function compareImages(expectedScreenshot: string, currentScreenshot: string, diffPath: string, threshold: number = 0.1) {
  // Read the images
  const img1 = PNG.sync.read(await fsPromises.readFile(expectedScreenshot));
  const img2 = PNG.sync.read(await fsPromises.readFile(currentScreenshot));
  const { width, height } = img1;

  // Ensure the images are of the same dimensions
  if (width !== img2.width || height !== img2.height) {
    throw new Error('Images must have the same dimensions');
  }

  // Compare the images
  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
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

  // Wait for the PDF to be generated and appear in the <embed> element
  await page.waitForTimeout(5000); // Adjust this timeout as needed based on the PDF generation time

  // Extract a string from the URL to name the PDF file
  function extractStringFromUrl(url) {
    const lastSegment = url.substring(url.lastIndexOf('/') + 1);
    const fileNameWithoutExtension = lastSegment.substring(0, lastSegment.lastIndexOf('.'));
    // const desiredString = fileNameWithoutExtension.split('_')[0] + '_' + fileNameWithoutExtension.split('_')[1];
     const desiredString = fileNameWithoutExtension.split('_')[0];
    return desiredString;
  }

  // Locate the <embed> element
  const embedElement = await page.locator('embed');

  // Get the URL of the embedded PDF
  const pdfUrl = await embedElement.getAttribute('src');
  const pdfName = extractStringFromUrl(pdfUrl);
  // Paths for PDF and screenshot files
  const pdfFilePath = path.join('testPdf', `${pdfName}.pdf`);
  const expectedDir = path.join('testPdf',`${pdfName}_expected`);
  const currentDir = path.join('testPdf', `${pdfName}_current`);
  const diffDir = path.join('testPdf',`${pdfName}_diff`);

  // Ensure directories exist
  await fsPromises.mkdir(expectedDir, { recursive: true });
  await fsPromises.mkdir(currentDir, { recursive: true });
  await fsPromises.mkdir(diffDir, { recursive: true });

  // Check if the PDF file already exists, if not, download it
  if (!fs.existsSync(pdfFilePath)) {
    const file = fs.createWriteStream(pdfFilePath);
    await new Promise((resolve, reject) => {
      https.get(pdfUrl!, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          file.close();
          console.log('PDF Download Completed');
          resolve(true);
        });
        file.on('error', reject);
      }).on('error', reject);
    });
  } else {
    console.log('PDF file already exists.');
  }

  // Function to convert PDF pages to PNG screenshots using pdftoppm
  function convertPdfToPng(pdfPath: string, pngBasePath: string) {
    execSync(`pdftoppm -png ${pdfPath} ${pngBasePath}`);
  }

  // Ensure expected and current PNG files exist
  const expectedFiles = fs.readdirSync(expectedDir).filter(file => file.endsWith('.png'));
  const currentFiles = fs.readdirSync(currentDir).filter(file => file.endsWith('.png'));
  
  // Convert PDFs to PNG screenshots
  if (expectedFiles.length === 0) {
    console.log(`Generating expected PNG files for ${pdfName}...`);
    convertPdfToPng(pdfFilePath, path.join(expectedDir, `${pdfName}_expected`));
  } else {
    console.log(`Generating current PNG files for ${pdfName}...`);
    convertPdfToPng(pdfFilePath, path.join(currentDir, `${pdfName}_current`));
  }

  if (expectedFiles.length === 0 || currentFiles.length === 0 || expectedFiles.length != currentFiles.length) {
    console.error('Expected or current PNG files were not generated or both files have different number of pages');
    process.exit(1);
  }
let numDiffPixels; 
  for (const expectedFile of expectedFiles) {
    const currentFile = expectedFile.replace('expected', 'current');
    const expectedScreenshotPath = path.join(expectedDir, expectedFile);
    const currentScreenshotPath = path.join(currentDir, currentFile);
    const diffScreenshotPath = path.join(diffDir, `diff_${expectedFile}`);

    
    try {
     numDiffPixels = await compareImages(expectedScreenshotPath, currentScreenshotPath, diffScreenshotPath);
      if (numDiffPixels > 0) {
        console.log(`Comparing ${expectedFile} with ${currentFile}`);
        console.log(`Number of differing pixels: ${numDiffPixels}`);
        console.log(`Diff image created at: ${diffScreenshotPath}`);
      }
    } catch (error) {
      console.error(`Error comparing images: ${error.message}`);
    }
  }
  expect(numDiffPixels).toBe(0);
});



