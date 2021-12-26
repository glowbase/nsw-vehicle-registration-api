const puppeteer = require('puppeteer');
const express = require('express');
const { parse } = require('node-html-parser');

const app = express();

const rego_check_url = 'https://my.service.nsw.gov.au/MyServiceNSW/index#/rms/freeRegoCheck/details';
const invalid_rego = 'The details you entered do not match our records. Please check and try again. Need help? Call us on 13 77 88.';

app.get('/', async (req, res) => {
    const { rego } = req.query;

    if (rego.length > 6) {
        res.status(403).send('Registration must include a maximum of 6 characters.');
    }

    // Create brower page for puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Execute steps to get rego info
    await page.goto(rego_check_url);
    await page.type('input[name=formly_2_input_plateNumber_0]', rego);
    await page.click('input[name=formly_2_checkbox-label-with-action_termsAndConditions_1]');
    await page.keyboard.press('Enter');
    await page.waitForNetworkIdle();
    await page.screenshot({ path: 'example.png' });

    // Extract HTML from page
    const data = await page.evaluate(() => 
        document.querySelector('*').outerHTML
    );

    // Parse HTML
    const root = parse(data);
    
    // Test if the rego is valid
    if (data.includes(invalid_rego)) {
        return res.status(403).send('Invalid registration.');
    }

    // Extract main data points from page
    const plate_details = root.querySelector('.plate-detail').innerHTML;
    const data_points = root.querySelectorAll('.snswLabelValue');

    // Extract specific vehicle and insurance info
    const model = parse(plate_details).querySelectorAll('small')[1].innerText;
    const vin = parse(plate_details).querySelectorAll('small')[2].innerText.replace('VIN/chassis: ', '');
    const tare_weight = data_points[0].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 0;
    const gross_weight = data_points[1].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 0;
    const rego_expire = data_points[2].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 'N/A';
    const rego_conditions = data_points[3].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 'N/A';
    const insurance_period = data_points[4].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 'N/A';
    const insurance_name = data_points[5].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 'N/A';
    const insurance_code = data_points[6].querySelectorAll('.col-xs-6')[2].querySelector('strong').innerText || 'N/A';

    // Format extracted data
    const extracted_data = {
        vehicle: {
            model: model,
            identification_number: vin,
            weight: {
                tare: tare_weight,
                gross: gross_weight
            },
            registration: {
                expiration: rego_expire,
                conditions: rego_conditions
            },
        },
        insurance: {
            ctp_period: insurance_period,
            insurers_name: insurance_name,
            insurers_code: insurance_code
        }
    };

    // Close puppeteer browser session
    await browser.close();

    res.status(200).json(extracted_data);
});

app.listen(8000, () => {
    console.clear();
    console.log('Listening on port 8000.');
});