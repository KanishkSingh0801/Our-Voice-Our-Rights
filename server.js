const express = require('express');
const cors = require('cors');
const pgp = require('pg-promise')();
const path = require('path'); 

const DB_CONNECTION_STRING = "postgresql://postgres.fijozxcvujbzamrwyqkw:Kanishk%40123@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const PORT = 3001;

const app = express();
const db = pgp(DB_CONNECTION_STRING);
app.use(cors());
app.use(express.json());

app.get('/api/districts', async (req, res) => {
    try {
        const data = await db.any(
            "SELECT DISTINCT district_name FROM mgnrega_performance WHERE state_name = 'MADHYA PRADESH' ORDER BY district_name"
        );
        res.json(data);
    } catch (error) {
        console.error("Error fetching districts:", error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.get('/api/data/:districtName', async (req, res) => {
    const { districtName } = req.params;
    try {
        const data = await db.any(
            "SELECT * FROM mgnrega_performance WHERE district_name = $1 ORDER BY report_date",
            [districtName]
        );

        if (data.length > 0) {
            res.json(data);
        } else {
            res.status(404).json({ error: 'No data found for this district' });
        }
    } catch (error) {
        console.error("Error fetching district data:", error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.use(express.static(path.join(__dirname, 'client/build')));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Production server is running on http://localhost:${PORT}`);
});