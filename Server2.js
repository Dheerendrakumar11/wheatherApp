const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 5000;

app.use(cors());

const apiKey = '0674910cdb994de9bc1a70594cab4a18';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/weatherDB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Weather Schema
const WeatherSchema = new mongoose.Schema({
  city: String,  
  date: String,
  temperature: {
    min: Number,
    max: Number
  },
  humidity: Number,
  description: String,
  windSpeed: Number
});

const Weather = mongoose.model('Weather', WeatherSchema);

// Fetch and store weather data for a specific city
const fetchAndStoreWeatherData = async (city) => {
  const url = `https://pro.openweathermap.org/data/2.5/forecast/hourly?q={city}&appid={apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    const weatherData = {
      city: city,
      date: new Date().toISOString().split('T')[0],  // current date in YYYY-MM-DD format
      temperature: {
        min: data.main.temp_min,
        max: data.main.temp_max
      },
      humidity: data.main.humidity,
      description: data.weather[0].description,
      windSpeed: data.wind.speed
    };
    
    // Store the weather data in MongoDB
    const newWeather = new Weather(weatherData);
    await newWeather.save();

    console.log('Weather data saved to MongoDB:', weatherData);
  } catch (error) {
    console.error('Error fetching or saving weather data:', error.message);
  }
};

// Endpoint to fetch weather data for a specific city
app.get('/api/weather'  , async (req, res) => {
  const { city } = req.query;    

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  try {
    const weatherData = await Weather.findOne({ city }).sort({ date: -1 }).limit(1);
    if (!weatherData) {
      // If no data found, fetch from API and store it
      await fetchAndStoreWeatherData(city);
      const newWeatherData = await Weather.findOne({ city }).sort({ date: -1 }).limit(1);
      return res.json(newWeatherData);
    }
    res.json(weatherData);
  } catch (err) {
    console.error('Error fetching weather data:', err.message);
    res.status(500).json({ error: 'Error fetching weather data' });
  }
});

// Endpoint to get weather data from MongoDB for the last 5 days and next 5 days
app.get('/api/weather/history', async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  const today = new Date();
  const startDate = new Date(today);
   startDate.setDate(today.getDate() - 5);

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 5);

  try {
    const weatherData = await Weather.find({
      city: city,
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0]
      }
    }).sort({ date: 1 });
    res.json(weatherData);
  } catch (err) {
    console.error('Error fetching weather data:', err.message);
    res.status(500).json({ error: 'Error fetching weather data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
