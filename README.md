# SnapDrop Angular Application

A modern Angular application with animated login interface and mock REST API authentication.

## Features

- 🔐 **Authentication**: Mock login system with JWT token simulation
- 🎨 **Modern UI**: Sleek login interface matching the SnapDrop design
- ✨ **Animated Background**: Canvas-based particle animation system
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🔄 **Real-time Validation**: Form validation with error messaging
- 🌊 **Smooth Animations**: CSS transitions and loading states

## Demo Credentials

You can test the application with these demo accounts:

### Admin User
- **Email**: `admin@snapdrop.com`
- **Password**: `admin123`

### Regular User
- **Email**: `user@snapdrop.com`  
- **Password**: `user123`

### Demo User
- **Email**: `demo@snapdrop.com`
- **Password**: `demo123`

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:4200`

## Project Structure

```
src/
├── app/
│   ├── login/
│   │   ├── login.component.ts          # Main login component
│   │   ├── login.component.html        # Login form template
│   │   ├── login.component.css         # Login styling
│   │   └── animated-background.component.ts  # Canvas animation
│   ├── services/
│   │   └── auth.service.ts             # Mock authentication service
│   ├── app.module.ts                   # Main app module
│   └── app-routing.module.ts           # App routing configuration
├── styles.css                          # Global styles
└── index.html                          # Main HTML file
```

## Features Overview

### Authentication Service
- Mock user database with sample accounts
- JWT token simulation
- Password reset functionality
- Session persistence with localStorage
- Login/logout state management

### Login Component
- Reactive forms with validation
- Real-time error messaging
- Loading states during authentication
- Responsive design for all screen sizes

### Animated Background
- Canvas-based particle system
- Dynamic connections between particles
- Smooth animation with requestAnimationFrame
- Responsive to screen size changes

## API Endpoints (Mock)

The application simulates REST API calls with the following endpoints:

- `POST /api/login` - User authentication
- `POST /api/forgot-password` - Password reset request
- `GET /api/profile` - Get user profile
- `POST /api/logout` - User logout

## Technologies Used

- **Angular 17** - Frontend framework
- **TypeScript** - Programming language
- **RxJS** - Reactive programming
- **CSS3** - Styling and animations
- **Canvas API** - Background animations
- **Local Storage** - Session persistence

## Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run watch` - Build in watch mode
- `npm test` - Run unit tests

### Key Components

1. **AuthService**: Handles all authentication logic with mock API simulation
2. **LoginComponent**: Main login interface with form validation
3. **AnimatedBackgroundComponent**: Canvas-based particle animation system

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is for demonstration purposes.
