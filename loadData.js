const axios = require('axios'); // For downloading
const pgp = require('pg-promise')();

// --- 1. CONFIGURATION ---

// PASTE YOUR SUPABASE CONNECTION STRING HERE (with encoded password)
const DB_CONNECTION_STRING = "postgresql://postgres:Kanishk%40123@db.fijozxcvujbzamrwyqkw.supabase.co:5432/postgres";

// PASTE YOUR API KEY FROM data.gov.in HERE
const API_KEY = "579b464db66ec23bdd000001c86ebfa691574b6f72bc89a3bfda855d"; // Starts with 579b464...

// API Details
const API_RESOURCE_ID = "ee03643a-ee4c-48c2-ac30-9f2ff26ab722";
const API_BASE_URL = "https://api.data.gov.in/resource/";

// Connect to your Supabase DB
const db = pgp(DB_CONNECTION_STRING);

// --- 2. TRANSFORM FUNCTION ---
// This function cleans a single JSON 'record' from the API
function transformRow(record) {
  // The API uses the header names as keys, so this logic is the same
  const cleanNumber = (value) => {
    if (typeof value !== 'string') return value;
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? null : num;
  };

  const year = record.fin_year.split('-')[0];
  const date = new Date(`${record.month} 1, ${year}`);
  if (isNaN(date)) return null; // Skip invalid date

  return {
    report_date: date,
    state_name: record.state_name,
    district_name: record.district_name,
    total_individuals_worked: cleanNumber(record.Total_Individuals_Worked),
    hhs_completed_100_days: cleanNumber(record.Total_No_of_HHs_completed_100_Days_of_Wage_Employment),
    wages_paid_total: cleanNumber(record.Wages),
    payments_on_time_percent: cleanNumber(record.percentage_payments_gererated_within_15_days),
    women_persondays: cleanNumber(record.Women_Persondays)
  };
}

// --- 3. MAIN ETL PROCESS ---
async function processData() {
  console.log("Starting automated data pipeline...");

  let allRecords = [];
  let offset = 0;
  const limit = 100; // The API limit per request
  let totalRecords = 0;

  try {
    // --- 3a. EXTRACT & PAGINATE ---
    console.log("Fetching data from data.gov.in API...");
    do {
      // Build the API URL for this "page" of data
      const apiUrl = `${API_BASE_URL}${API_RESOURCE_ID}` +
                     `?api-key=${API_KEY}` +
                     `&format=json` +
                     `&offset=${offset}` +
                     `&limit=${limit}` +
                     `&filters[state_name]=MADHYA PRADESH`;

      const response = await axios.get(apiUrl);
      const data = response.data;

      if (data.records && data.records.length > 0) {
        allRecords = allRecords.concat(data.records);
        if (totalRecords === 0) {
          totalRecords = data.total; // Get total count on the first loop
        }
        console.log(`Fetched ${allRecords.length} / ${totalRecords} records...`);
      } else {
        // No more records, stop looping
        break;
      }

      offset += limit; // Go to the next page

    } while (allRecords.length < totalRecords);

    console.log(`Total records fetched: ${allRecords.length}`);

    // --- 3b. TRANSFORM ---
    console.log("Transforming data...");
    const transformedData = allRecords
      .map(transformRow)
      .filter(row => row !== null); // Remove any rows that failed validation

    console.log(`Successfully transformed ${transformedData.length} rows.`);

    if (transformedData.length === 0) {
      console.log("No data found for Madhya Pradesh. Stopping.");
      return;
    }

    // --- 3c. LOAD ---
    console.log("Connecting to the database and loading data...");
    const cs = new pgp.helpers.ColumnSet([
      'report_date', 'state_name', 'district_name',
      'total_individuals_worked', 'hhs_completed_100_days',
      'wages_paid_total', 'payments_on_time_percent', 'women_persondays'
    ], { table: 'mgnrega_performance' });

    // 'onConflict' is our key for automation. It updates existing records
    // or inserts new ones.
    const query = pgp.helpers.insert(transformedData, cs) +
                  " ON CONFLICT(district_name, report_date) DO NOTHING";

    await db.none(query);

    console.log("\n--- SUCCESS ---");
    console.log("Data was fetched from the live API and loaded into your Supabase database successfully.");

  } catch (e) {
    console.log("\n--- ERROR ---");
    console.error("Error during the ETL process:", e.message);
  } finally {
    pgp.end(); // Close the database connection pool
  }
}

// Run the main process
processData();