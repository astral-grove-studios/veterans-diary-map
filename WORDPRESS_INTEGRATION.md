# VFVIC Google Calendar Integration Guide

This document explains how to integrate Google Calendar events from https://vfvic.co.uk/events/ into the Veterans Diary event map.

## Google Calendar Integration

### Step 1: Get Google Calendar API Access

1. **Google Cloud Console Setup**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing project
   - Enable the Google Calendar API
   - Create credentials (API Key)

2. **Get Calendar ID**:
   - Open your VFVIC Google Calendar
   - Go to Calendar Settings → Integrate Calendar
   - Copy the Calendar ID (usually looks like: `abc123@group.calendar.google.com`)

### Step 2: Configure the Event Map

Update `script.js` with your credentials:

```javascript
async loadGoogleCalendarEvents() {
    const CALENDAR_ID = 'your-vfvic-calendar-id@group.calendar.google.com';
    const API_KEY = 'your-google-api-key';

    try {
        const timeMin = new Date().toISOString();
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${API_KEY}&timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=50`
        );

        if (!response.ok) {
            throw new Error(`Calendar API error: ${response.status}`);
        }

        const data = await response.json();
        this.events = data.items.map((item, index) => this.transformGoogleCalendarEvent(item, index));
        console.log(`Loaded ${this.events.length} events from Google Calendar`);

    } catch (error) {
        console.error('Failed to load Google Calendar events:', error);
        throw error;
    }
}
```

### Step 3: Location Geocoding

Since Google Calendar events may not have coordinates, you'll need geocoding:

```javascript
async geocodeLocation(address) {
    // Option 1: Use Google Geocoding API (requires additional API key)
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`
        );
        const data = await response.json();
        if (data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        }
    } catch (error) {
        console.error('Geocoding failed:', error);
    }

    // Option 2: Fallback to preset Northeast England coordinates
    return this.getDefaultCoordinatesForLocation(address);
}

getDefaultCoordinatesForLocation(location) {
    const locationMap = {
        'newcastle': { lat: 54.9783, lng: -1.6178 },
        'sunderland': { lat: 54.9069, lng: -1.3838 },
        'middlesbrough': { lat: 54.5742, lng: -1.2349 },
        'durham': { lat: 54.7753, lng: -1.5849 },
        'gateshead': { lat: 54.9537, lng: -1.6103 },
        'hartlepool': { lat: 54.6896, lng: -1.2115 }
    };

    const locationLower = location.toLowerCase();
    for (const [city, coords] of Object.entries(locationMap)) {
        if (locationLower.includes(city)) {
            return coords;
        }
    }

    // Default to Newcastle if no match
    return { lat: 54.9783, lng: -1.6178 };
}
```

## Quick Integration Options

### Option 1: Simple Embed (Recommended for Quick Setup)
Upload the files to your WordPress media library or a subdirectory and embed using an iframe:

```html
<iframe src="/path-to-event-map/index.html" width="100%" height="800px" frameborder="0"></iframe>
```

### Option 2: Direct Integration into Theme
1. Copy the CSS from `styles.css` into your theme's style.css
2. Copy the HTML structure from `index.html` into your page template
3. Enqueue the JavaScript file in your theme's functions.php

### Option 3: WordPress Plugin Integration
Create a custom plugin or modify existing event plugins to use this map interface.

## Data Integration

### Sample WordPress Functions
Add these to your theme's functions.php to connect WordPress events:

```php
// Function to get events as JSON for the map
function get_events_json() {
    $events = get_posts(array(
        'post_type' => 'event', // Adjust based on your event post type
        'numberposts' => -1,
        'meta_query' => array(
            array(
                'key' => 'event_latitude',
                'compare' => 'EXISTS'
            ),
            array(
                'key' => 'event_longitude',
                'compare' => 'EXISTS'
            )
        )
    ));

    $event_data = array();
    foreach($events as $event) {
        $event_data[] = array(
            'id' => $event->ID,
            'title' => $event->post_title,
            'description' => wp_trim_words($event->post_content, 20),
            'category' => get_post_meta($event->ID, 'event_category', true),
            'date' => get_post_meta($event->ID, 'event_date', true),
            'location' => get_post_meta($event->ID, 'event_location', true),
            'lat' => floatval(get_post_meta($event->ID, 'event_latitude', true)),
            'lng' => floatval(get_post_meta($event->ID, 'event_longitude', true)),
            'organizer' => get_post_meta($event->ID, 'event_organizer', true)
        );
    }

    wp_send_json($event_data);
}
add_action('wp_ajax_get_events_json', 'get_events_json');
add_action('wp_ajax_nopriv_get_events_json', 'get_events_json');
```

### JavaScript Modification for WordPress
Replace the sample data in `script.js` with an AJAX call:

```javascript
async loadEventsFromWordPress() {
    try {
        const response = await fetch('/wp-admin/admin-ajax.php?action=get_events_json');
        this.events = await response.json();
        this.filteredEvents = [...this.events];
    } catch (error) {
        console.error('Error loading events:', error);
        // Fallback to sample data
    }
}
```

## Required WordPress Meta Fields

For each event post, you'll need these custom fields:
- `event_latitude` (decimal)
- `event_longitude` (decimal)
- `event_date` (YYYY-MM-DD format)
- `event_location` (text)
- `event_category` (text)
- `event_organizer` (text)

## Popular Event Plugin Compatibility

### The Events Calendar
```php
// Get events from The Events Calendar plugin
function get_events_calendar_json() {
    $events = tribe_get_events(array(
        'posts_per_page' => -1,
        'meta_query' => array(
            array(
                'key' => '_VenueLatitude',
                'compare' => 'EXISTS'
            )
        )
    ));

    $event_data = array();
    foreach($events as $event) {
        $venue_id = tribe_get_venue_id($event->ID);
        $event_data[] = array(
            'id' => $event->ID,
            'title' => $event->post_title,
            'description' => wp_trim_words($event->post_content, 20),
            'category' => implode(', ', wp_get_post_terms($event->ID, 'tribe_events_cat', array('fields' => 'names'))),
            'date' => tribe_get_start_date($event->ID, false, 'Y-m-d'),
            'location' => tribe_get_venue($event->ID),
            'lat' => floatval(tribe_get_coordinates($venue_id)['lat']),
            'lng' => floatval(tribe_get_coordinates($venue_id)['lng']),
            'organizer' => tribe_get_organizer($event->ID)
        );
    }

    wp_send_json($event_data);
}
```

### Event Organiser Plugin
```php
// Get events from Event Organiser plugin
function get_event_organiser_json() {
    $events = eo_get_events(array(
        'numberposts' => -1,
        'meta_query' => array(
            array(
                'key' => '_eo_venue_lat',
                'compare' => 'EXISTS'
            )
        )
    ));

    // Similar structure as above, adjust field names accordingly
}
```

## Styling Integration

### Match WordPress Theme
Add these CSS variables to match your theme:

```css
:root {
    --primary-color: #your-theme-primary;
    --secondary-color: #your-theme-secondary;
    --text-color: #your-theme-text;
    --background-color: #your-theme-background;
}
```

### Responsive Considerations
The map is already responsive, but you may need to adjust breakpoints to match your theme:

```css
@media (max-width: 768px) {
    .map-container {
        grid-template-columns: 1fr;
        height: auto;
    }
}
```

## Security Considerations

1. **Sanitize Data**: Always sanitize data when integrating with WordPress
2. **Nonce Fields**: Use WordPress nonces for AJAX requests
3. **Capability Checks**: Verify user permissions for admin functions

## Performance Optimization

1. **Caching**: Use WordPress transients to cache event data
2. **Lazy Loading**: Load map only when needed
3. **CDN**: Use CDN for Leaflet.js library
4. **Minification**: Minify CSS and JS files for production

## Testing Checklist

- [ ] Events display correctly on map
- [ ] Search functionality works
- [ ] Filters work properly
- [ ] Mobile responsive design
- [ ] Cross-browser compatibility
- [ ] WordPress theme integration
- [ ] Event data updates automatically

## Support

For issues with this integration, check:
1. Browser console for JavaScript errors
2. WordPress debug log for PHP errors
3. Ensure all required meta fields are populated
4. Verify latitude/longitude coordinates are valid
