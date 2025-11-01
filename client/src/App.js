import React, { useState, useEffect } from 'react';
import './App.css';
import { FaUsers, FaHome, FaCheckCircle, FaExclamationCircle, FaMapMarkerAlt } from 'react-icons/fa'; 
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtData, setDistrictData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const [locationStatus, setLocationStatus] = useState('मेरी लोकेशन पता करें'); 

  useEffect(() => {
    fetch('/api/districts') // Changed for production
      .then(response => response.json())
      .then(data => {
        const districtNames = data.map(d => d.district_name.toUpperCase());
        setDistricts(districtNames);
      })
      .catch(error => console.error("Error fetching districts:", error));
  }, []); 

  useEffect(() => {
    if (districtData.length > 0) {
      const latest = districtData[districtData.length - 1];
      setLatestData(latest);

      const labels = districtData.map(row => 
        new Date(row.report_date).toLocaleDateString('hi-IN', { month: 'short', year: 'numeric' })
      );
      const data = districtData.map(row => row.total_individuals_worked);

      setChartData({
        labels: labels,
        datasets: [
          {
            label: 'काम पाने वाले लोग',
            data: data,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
          },
        ],
      });
    } else {
      setChartData(null);
      setLatestData(null);
    }
  }, [districtData]); 

  const fetchDistrictData = (districtName) => {
    if (districtName) {
      fetch(`/api/data/${districtName}`) // Changed for production
        .then(response => response.json())
        .then(data => setDistrictData(data))
        .catch(error => console.error("Error fetching district data:", error));
    } else {
      setDistrictData([]);
    }
  };

  const handleDistrictChange = (event) => {
    const newDistrict = event.target.value;
    setSelectedDistrict(newDistrict);
    fetchDistrictData(newDistrict);
  };

  const handleLocationClick = () => {
    if (!navigator.geolocation) {
      setLocationStatus("आपका ब्राउज़र लोकेशन सपोर्ट नहीं करता");
      return;
    }

    setLocationStatus("पता कर रहे हैं..."); 

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=en`
      );
      const data = await response.json();

      console.log("Full address from Nominatim (in English):", data.address);

      if (data && data.address) {
        let foundDistrict = data.address.state_district || data.address.county;

        if (foundDistrict) {
          foundDistrict = foundDistrict
            .replace(' District', '')
            .replace(' TAHSIL', '')
            .toUpperCase(); 

          console.log("Cleaned district name:", foundDistrict);

          if (districts.includes(foundDistrict)) {
            setLocationStatus(`आपका जिला: ${foundDistrict}`);
            setSelectedDistrict(foundDistrict);
            fetchDistrictData(foundDistrict); 
          } else {
            setLocationStatus("लोकेशन मिली, पर जिला मैच नहीं हुआ");
            console.error(`Mismatch: Nominatim returned '${foundDistrict}' which is not in our district list.`);
          }
        } else {
          setLocationStatus("जिला नहीं मिल पाया");
        }
      } else {
        setLocationStatus("लोकेशन को पते में नहीं बदल पाया");
      }
    }, () => {
      setLocationStatus("लोकेशन की अनुमति नहीं मिली"); 
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>मनरेगा परफॉरमेंस डैशबोर्ड</h1>
        <h2>(मध्य प्रदेश)</h2>

        <select value={selectedDistrict} onChange={handleDistrictChange}>
          <option value="">-- अपना जिला चुनें --</option>
          {districts.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button className="location-button" onClick={handleLocationClick}>
          <FaMapMarkerAlt style={{ marginRight: '8px' }} />
          {locationStatus}
        </button>

        {latestData && (
          <div className="info-card-container">
            <InfoCard
              icon={<FaUsers size={30} />}
              label="लोगों को काम मिला"
              value={latestData.total_individuals_worked.toLocaleString('en-IN')}
              date={new Date(latestData.report_date).toLocaleDateString('hi-IN', { month: 'long', year: 'numeric' })}
            />
            <InfoCard
              icon={<FaHome size={30} />}
              label="परिवारों ने 100 दिन पूरे किए"
              value={latestData.hhs_completed_100_days.toLocaleString('en-IN')}
              date={new Date(latestData.report_date).toLocaleDateString('hi-IN', { month: 'long', year: 'numeric' })}
            />
            <InfoCard
              icon={latestData.payments_on_time_percent > 95 ? <FaCheckCircle size={30} color="#4CAF50" /> : <FaExclamationCircle size={30} color="#FFC107" />}
              label="समय पर भुगतान"
              value={`${latestData.payments_on_time_percent}%`}
              date={new Date(latestData.report_date).toLocaleDateString('hi-IN', { month: 'long', year: 'numeric' })}
            />
          </div>
        )}

        {chartData && (
          <div className="chart-container">
            <h3>{selectedDistrict} में काम पाने वाले लोग</h3>
            <Bar 
              data={chartData} 
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: 'काम पाने वाले लोगों की मासिक संख्या', color: 'white' },
                },
                scales: {
                  y: { ticks: { color: 'white' }, grid: { color: '#555' } },
                  x: { ticks: { color: 'white' } }
                }
              }} 
            />
          </div>
        )}
      </header>
    </div>
  );
}

function InfoCard({ icon, label, value, date }) {
  return (
    <div className="info-card">
      <div className="info-card-icon">{icon}</div>
      <div className="info-card-content">
        <div className="info-card-value">{value}</div>
        <div className="info-card-label">{label}</div>
        <div className="info-card-date">({date})</div>
      </div>
    </div>
  );
}

export default App;