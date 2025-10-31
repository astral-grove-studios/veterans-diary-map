# Event Map Integration Project Instructions

This project implements an interactive event mapping system that allows users to view, search, and interact with events on a map interface.

## Project Overview
- **Type**: Web Application
- **Primary Language**: JavaScript/TypeScript
- **Framework**: React with mapping library integration
- **Features**: Interactive maps, event management, location-based search, event filtering

## Development Guidelines

### Code Style
- Use modern ES6+ JavaScript/TypeScript syntax
- Follow React best practices and hooks patterns
- Implement responsive design for mobile and desktop
- Use modular component architecture

### Map Integration
- Integrate with mapping services (Google Maps, Mapbox, or OpenStreetMap)
- Implement clustering for multiple events in close proximity
- Add custom markers and popups for event information
- Support geolocation and location-based filtering

### Event Management
- Create event data models with location coordinates
- Implement CRUD operations for events
- Support event categories and filtering
- Add search functionality by location, date, and keywords

### Performance Considerations
- Optimize map rendering for large datasets
- Implement lazy loading for event data
- Use efficient state management
- Minimize API calls with caching strategies

## Architecture Notes
- Separate concerns between map logic and business logic
- Use React Context or state management library for global state
- Implement error boundaries for map component failures
- Follow accessibility guidelines for interactive elements
