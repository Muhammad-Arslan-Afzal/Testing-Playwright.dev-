import { test, expect } from '@playwright/test';
import fs from 'fs';
import https from 'https';
import pdf from 'pdf-parse';
import path from 'path';
import { diffLines } from 'diff';

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
    const desiredString = fileNameWithoutExtension.split('_')[0] + '_' + fileNameWithoutExtension.split('_')[1];
    return desiredString;
  }

  // Locate the <embed> element
  const embedElement = await page.locator('embed');

  // Get the URL of the embedded PDF
  const pdfUrl = await embedElement.getAttribute('src');
  const pdfName = extractStringFromUrl(pdfUrl);

  // Paths for PDF and text files
  const pdfFilePath = path.join('testPdf', `${pdfName}.pdf`);
  const expectedTxtPath = path.join('testPdf', `${pdfName}_expected.txt`);
  const actualTxtPath = path.join('testPdf', `${pdfName}_actual.txt`);

  // Function to extract content from the line that starts with "Quote" onwards
  function extractContentFromQuoteOnwards(content) {
    const lines = content.split('\n');
    const quoteIndex = lines.findIndex(line => line.startsWith('Quote'));
    if (quoteIndex !== -1) {
      return lines.slice(quoteIndex).join('\n');
    }
    return content; // Return the original content if "Quote" is not found
  }

  function fileMatcher() {
    // Read the expected and actual values from the saved files
    let expected_export_values = fs.readFileSync(expectedTxtPath, 'utf-8');
    let actual_export_values = fs.readFileSync(actualTxtPath, 'utf-8');
    // Extract the content from the line that starts with "Quote" onwards
    expected_export_values = extractContentFromQuoteOnwards(expected_export_values);
    actual_export_values = extractContentFromQuoteOnwards(actual_export_values);
    // Use the `expect` function from Playwright to assert that the values match
    try {
      expect(expected_export_values).toMatch(actual_export_values);
    } catch (error) {
      console.error('Files do not match! Showing differences:');
      console.log(`Green: for additions (in expected file) \n Red: for deletions (from expected file) \n Grey: Unchanged content (in expected file)`);
      showDifferences(expected_export_values, actual_export_values);
      throw error; // Re-throw the error to fail the test
    }
  }

  function showDifferences(expected, actual) {
    const diffOutput = diffLines(expected, actual);
    const greyColor = '\x1b[90m'; //ANSI escape sequence for light grey
    const greenColor = '\x1b[32m';
    const redColor = '\x1b[31m';

    diffOutput.forEach(part => {
      const color = part.added ? greenColor : part.removed ? redColor : greyColor;
      process.stderr.write(color + part.value + greyColor);
    });
  }

  // Check if the PDF file already exists
  if (!fs.existsSync(pdfFilePath)) {
    // Download the PDF if it does not exist
    const file = fs.createWriteStream(pdfFilePath);
    await new Promise((resolve, reject) => {
      https.get(pdfUrl!, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          file.close();
          console.log('Download Completed');
          resolve(true);
        });
        file.on('error', reject);
      }).on('error', reject);
    });
  } else {
    console.log('PDF file already exists.');
  }

  // Use the 'pdf-parse' module to extract the text from the PDF file
  const dataBuffer = fs.readFileSync(pdfFilePath);
  const pdfData = await pdf(dataBuffer);

  // Write the extracted text to 'expected.txt' if it does not exist, otherwise to 'actual.txt'
  if (!fs.existsSync(expectedTxtPath)) {
    fs.writeFileSync(expectedTxtPath, pdfData.text);
    console.log('Expected text file created.');
  } else if (!fs.existsSync(actualTxtPath)) {
    fs.writeFileSync(actualTxtPath, pdfData.text);
    console.log('Actual text file created.');
    fileMatcher();
  } else {
    console.log("expected and actual both files exist");
    fileMatcher();
  }
});
