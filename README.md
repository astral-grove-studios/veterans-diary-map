# VFVIC Veterans Diary - Event Map

A simple, vanilla JavaScript event mapping system designed to display veteran events from Google Calendar on an interactive map. Built for Veterans for Veterans in Care (VFVIC) to show events across the Northeast of England.

## Features

- **Google Calendar Integration**: Connects to VFVIC Google Calendar for live event data
- **Interactive Map**: Uses OpenStreetMap via Leaflet.js (no API keys required)
- **Veteran Event Categories**: Breakfast clubs, drop-in centres, meetings, workshops, social events, support groups
- **Search & Filter**: Search by text and filter by category/date
- **Northeast England Focus**: Predefined coordinates for common locations
- **Responsive Design**: Works on desktop and mobile devices
- **WordPress Ready**: Designed for easy WordPress integration
- **No Framework Dependencies**: Pure HTML, CSS, and JavaScript

## Features

- **Interactive Map**: Uses OpenStreetMap via Leaflet.js (no API keys required)
- **Event Management**: Display events with location, date, category, and details
- **Search & Filter**: Search by text and filter by category/date
- **Responsive Design**: Works on desktop and mobile devices
- **WordPress Ready**: Designed for easy WordPress integration
- **No Framework Dependencies**: Pure HTML, CSS, and JavaScript

## Quick Start

1. **Local Development**:
   ```bash
   # Start local server
   python -m http.server 8080

   # Open in browser
   http://localhost:8080
   ```

2. **View the Prototype**:
   - Open `index.html` in any modern browser
   - Or use the VS Code Live Server extension

## File Structure

```
VFVIC/
├── index.html              # Main HTML file
├── styles.css              # CSS styles
├── script.js               # JavaScript functionality
├── WORDPRESS_INTEGRATION.md # WordPress integration guide
└── README.md               # This file
```

## Sample Event Data

The prototype includes 5 sample events across Australian cities:
- Tech Conference 2025 (Melbourne)
- JavaScript Workshop (Sydney)
- Community Meetup (Brisbane)
- Design Thinking Workshop (Perth)
- Social Mixer (Adelaide)

## Key Components

### EventMap Class
- **Main Controller**: Manages map, events, and interactions
- **Event Loading**: Loads and displays event data
- **Filtering**: Handles search and category filtering
- **Map Integration**: Manages Leaflet map and markers

### WordPress Integration API
- **EventMapAPI.addEvent()**: Add new events programmatically
- **EventMapAPI.getEvents()**: Retrieve all events
- **EventMapAPI.filterByCategory()**: Filter by category
- **EventMapAPI.searchEvents()**: Search events

## WordPress Integration

### Quick Integration Options

1. **Simple Embed** (Recommended):
   ```html
   <iframe src="/path-to-event-map/index.html" width="100%" height="800px"></iframe>
   ```

2. **Direct Theme Integration**:
   - Copy CSS to theme stylesheet
   - Add HTML structure to page template
   - Enqueue JavaScript file

3. **Plugin Integration**:
   - Create custom plugin
   - Modify existing event plugins

### Required Event Meta Fields

For WordPress integration, events need these custom fields:
- `event_latitude` (decimal)
- `event_longitude` (decimal)
- `event_date` (YYYY-MM-DD)
- `event_location` (text)
- `event_category` (text)
- `event_organizer` (text)

### Popular Plugin Compatibility

- **The Events Calendar**: Ready-to-use integration code provided
- **Event Organiser**: Compatible with field mapping
- **Custom Event Types**: Easy to adapt

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- **Leaflet.js**: Open-source mapping library (loaded from CDN)
- **OpenStreetMap**: Free map tiles (no API key required)

## Customization

### Styling
- Modify `styles.css` for visual customization
- CSS variables available for easy theme matching
- Responsive breakpoints included

### Functionality
- Add new event categories in the dropdown
- Customize search behavior
- Modify map default settings

### Event Data
- Replace sample data with WordPress integration
- Add custom event fields as needed
- Implement custom validation

## Performance Considerations

- **Lazy Loading**: Map loads only when container is visible
- **Efficient Rendering**: Markers update only when needed
- **Responsive Images**: Optimized for mobile devices
- **Minimal Dependencies**: Lightweight implementation

## Development Guidelines

1. **Code Style**: ES6+ JavaScript, semantic HTML, modern CSS
2. **Accessibility**: ARIA labels, keyboard navigation support
3. **Mobile First**: Responsive design principles
4. **SEO Friendly**: Semantic markup for search engines

## Testing Checklist

- [ ] Map displays correctly
- [ ] Events show on map and in list
- [ ] Search functionality works
- [ ] Category filter works
- [ ] Date filter works
- [ ] Mobile responsive
- [ ] Cross-browser compatibility

## Future Enhancements

- **Geolocation**: User location detection
- **Event Details**: Popup modals with full event info
- **Social Sharing**: Share individual events
- **Export**: Calendar export functionality
- **Admin Panel**: Event management interface

## Support

For issues or questions:
1. Check browser console for errors
2. Verify event data format
3. Ensure latitude/longitude are valid
4. Test with sample data first

## License

MIT License - Free for commercial and personal use.

## Contributing

This is a prototype designed for easy customization. Feel free to:
- Add new features
- Improve styling
- Enhance WordPress integration
- Submit improvements

---

**Note**: This prototype is designed to be simple and maintainable for volunteers without extensive JavaScript experience. The code is well-commented and follows standard practices for easy modification.
