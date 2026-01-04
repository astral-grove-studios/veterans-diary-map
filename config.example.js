// Google Calendar Configuration for VFVIC Veterans Diary
// Copy this file to config.js and fill in your actual values

const CALENDAR_CONFIG = {
    // Get this from Google Cloud Console after enabling Calendar API
    API_KEY: 'your-google-calendar-api-key-here',

    // Get this from your VFVIC Google Calendar settings
    CALENDAR_ID: 'your-calendar-id@group.calendar.google.com',

    // Mapbox API key for geocoding (https://mapbox.com)
    // Provides more accurate venue-based location matching
    MAPBOX_API_KEY: 'your-mapbox-api-key-here',

    // Default region for events (Northeast England)
    DEFAULT_REGION: {
        lat: 54.9783,
        lng: -1.6178,
        zoom: 8
    },

    // Maximum number of events to load
    MAX_EVENTS: 50,

    // Enable/disable geocoding (set to false to use predefined coordinates)
    ENABLE_GEOCODING: true
};

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CALENDAR_CONFIG;
} else {
    window.CALENDAR_CONFIG = CALENDAR_CONFIG;
}
