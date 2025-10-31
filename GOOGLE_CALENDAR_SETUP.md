# VFVIC Google Calendar Setup Instructions

Follow these steps to connect your Veterans Diary event map to the Google Calendar at https://vfvic.co.uk/events/

## 🚀 Quick Setup

### Step 1: Get Google Calendar API Key

1. **Visit Google Cloud Console**: Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. **Create/Select Project**: Create a new project or select an existing one
3. **Enable Calendar API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"
4. **Create API Key**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the generated API key

### Step 2: Get Your Calendar ID

1. **Open Google Calendar**: Go to [calendar.google.com](https://calendar.google.com/)
2. **Find Your VFVIC Calendar**: In the left sidebar
3. **Calendar Settings**:
   - Click the three dots next to your calendar
   - Select "Settings and sharing"
4. **Copy Calendar ID**:
   - Scroll down to "Integrate calendar"
   - Copy the "Calendar ID" (looks like: `abc123@group.calendar.google.com`)

### Step 3: Configure the Event Map

1. **Copy Configuration File**:
   ```bash
   cp config.example.js config.js
   ```

2. **Edit config.js**:
   ```javascript
   const CALENDAR_CONFIG = {
       API_KEY: 'paste-your-api-key-here',
       CALENDAR_ID: 'paste-your-calendar-id-here',
       // ... other settings
   };
   ```

3. **Save and Test**: Refresh your browser to load live events!

## 🔧 Advanced Configuration

### Optional: Enable Geocoding

For automatic location coordinate detection:

1. **Enable Geocoding API** in Google Cloud Console
2. **Add Geocoding API Key** to config.js:
   ```javascript
   GEOCODING_API_KEY: 'your-geocoding-api-key',
   ENABLE_GEOCODING: true
   ```

### Predefined Locations

The system includes coordinates for common Northeast England locations:
- Newcastle upon Tyne
- Sunderland
- Middlesbrough
- Durham
- Gateshead
- Hartlepool
- And many more...

Events in these locations will automatically appear on the map without geocoding.

## 📋 Event Categories

The system automatically categorizes events based on title keywords:

| Category | Keywords |
|----------|----------|
| **Breakfast Club** | breakfast, coffee |
| **Drop-In** | drop, drop-in |
| **Meeting** | meeting, association |
| **Workshop** | workshop, training |
| **Social** | social, mixer |
| **Support** | support, counselling |

## 🎨 Customization

### Change Map Center
```javascript
DEFAULT_REGION: {
    lat: 54.9783,  // Newcastle coordinates
    lng: -1.6178,
    zoom: 8
}
```

### Add More Locations
Edit the `getKnownLocationCoordinates()` method in script.js to add more predefined locations.

## 🚨 Troubleshooting

### "Using sample data" message
- Check that config.js exists and is properly formatted
- Verify your API key is correct
- Ensure Calendar API is enabled in Google Cloud Console

### No events showing
- Check that your calendar is public or properly shared
- Verify the Calendar ID is correct
- Look in browser console for error messages

### Events show but no map markers
- Check that events have location information
- Verify coordinates are being generated
- Look for geocoding errors in console

## 🔒 Security Notes

1. **API Key Restrictions**: In Google Cloud Console, restrict your API key to:
   - Calendar API only
   - Your website domain only

2. **Calendar Privacy**: Ensure your calendar sharing settings are appropriate for public display

3. **Rate Limits**: Google Calendar API has usage limits - monitor your usage in Google Cloud Console

## 📞 Support

If you need help:
1. Check browser console for error messages
2. Verify all configuration steps are completed
3. Test with sample data first (rename config.js to config.js.bak)
4. Contact your web developer with any error messages

## 🎯 WordPress Integration

Once the basic setup works, see `WORDPRESS_INTEGRATION.md` for instructions on embedding this into your WordPress site at vfvic.co.uk.
