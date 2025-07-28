# Ethereum Wallet Sweeper Application

## Overview

This is a full-stack TypeScript application that provides automated Ethereum token sweeping capabilities with a focus on specific token monitoring. The system is designed to monitor particular Ethereum-based tokens that currently have trading disabled, and automatically transfers ALL tokens to a designated safe wallet immediately when trading becomes enabled. It features a React-based dashboard for configuration and monitoring, real-time WebSocket updates, comprehensive gas optimization strategies, and enhanced trading detection mechanisms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Architecture
The application follows a monorepo structure with clear separation between client, server, and shared components:

- **Frontend**: React SPA with TypeScript, using Vite for bundling
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Real-time Communication**: WebSocket connections for live updates
- **Blockchain Integration**: Web3.js for Ethereum network interaction

### Directory Structure
```
├── client/          # React frontend application
├── server/          # Express.js backend server
├── shared/          # Shared TypeScript types and schemas
├── migrations/      # Database migration files
└── dist/           # Built application files
```

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with HMR support in development
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom crypto-themed color scheme
- **State Management**: TanStack Query for server state and caching
- **Routing**: Wouter for client-side routing
- **Real-time Updates**: Custom WebSocket hook for live data

### Backend Architecture
- **Server Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time Communication**: WebSocket server for broadcasting updates
- **Blockchain Services**: Modular service architecture for Web3 operations
- **Storage Layer**: Abstracted storage interface with in-memory fallback

### Database Schema
The application uses a comprehensive database schema with the following main entities:

1. **wallet_configs**: Stores wallet configuration including private keys, safe wallet addresses, and automation settings
2. **transactions**: Tracks all token transfer transactions with status and gas information
3. **token_detections**: Records detected tokens in monitored wallets
4. **activities**: Logs all system activities for audit trails
5. **network_status**: Maintains current Ethereum network status and gas prices

### Service Layer
- **Web3Service**: Enhanced blockchain interactions with comprehensive trading detection across multiple DEX platforms (Uniswap V2/V3), contract trading flags, and recent transaction analysis
- **TokenDetector**: Advanced token monitoring with specific token targeting, 15-second scan intervals, and immediate sweep triggering upon trading enablement
- **TokenSweeper**: Dedicated service for executing token transfers with real-time status updates, gas optimization, and transaction monitoring
- **GasOptimizer**: Implements multiple gas strategies (slow, standard, fast) with dynamic pricing and urgency-based selection
- **Storage**: Abstracted data persistence layer supporting both database and in-memory storage

## Data Flow

### Wallet Monitoring Flow
1. User configures wallet through dashboard
2. TokenDetector service monitors wallet for new tokens
3. When tokens are detected, system evaluates transfer conditions
4. If conditions are met, transaction is initiated with optimized gas settings
5. Real-time updates are broadcast to connected clients via WebSocket

### Real-time Update Flow
1. WebSocket clients subscribe to wallet-specific updates
2. Server-side services broadcast events (token detected, trading enabled, transaction status changes, sweep initiated/completed, etc.)
3. Frontend receives updates and updates UI state without page refresh
4. Activity feed, transaction history, and specific token monitor update automatically
5. Immediate notifications when trading becomes enabled for monitored tokens

### Configuration Management
1. Wallet configurations stored securely with encrypted private keys
2. Gas strategy settings allow users to choose between speed and cost
3. Auto-sweep settings can be enabled/disabled per wallet
4. Minimum transfer amounts prevent dust transactions

## External Dependencies

### Blockchain Integration
- **Web3.js**: Primary library for Ethereum blockchain interaction
- **Neon Database Serverless**: PostgreSQL database hosting
- **Infura/Alchemy**: Ethereum RPC endpoints (configurable via environment variables)

### UI and Styling
- **Radix UI**: Comprehensive component library for accessible UI elements
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **shadcn/ui**: Pre-built component collection built on Radix UI

### Development Tools
- **Drizzle ORM**: Type-safe database operations with schema validation
- **Zod**: Runtime type validation for API requests
- **TanStack Query**: Server state management and caching
- **ESBuild**: Fast bundling for production builds

## Deployment Strategy

### Development Environment
- Vite development server with HMR for frontend
- tsx for running TypeScript server with hot reload
- Environment variables for blockchain RPC endpoints and database configuration

### Production Build
- Frontend built with Vite and served as static files
- Backend compiled with ESBuild for optimized Node.js bundle
- Database migrations managed through Drizzle Kit
- WebSocket server runs alongside Express server on single port

### Environment Configuration
Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `ETHEREUM_RPC_URL` or `INFURA_URL` or `ALCHEMY_URL`: Blockchain RPC endpoint
- `CHAIN_ID`: Ethereum network ID (defaults to mainnet)

### Security Considerations
- Private keys stored encrypted in database
- CORS and security headers configured for production
- WebSocket connections validated and rate-limited
- Environment variables used for sensitive configuration

## Recent Changes (January 28, 2025)

### Enhanced Specific Token Monitoring System
- **New SpecificTokenMonitor Component**: Added dedicated UI component for managing specific token monitoring with real-time status updates
- **Enhanced Trading Detection**: Implemented comprehensive trading detection across Uniswap V2/V3, contract flags, and recent transaction analysis
- **TokenSweeper Service**: Created dedicated token sweeping service with real-time updates, gas optimization, and transaction monitoring
- **Advanced API Endpoints**: Added endpoints for adding/removing specific tokens from monitoring and enhanced manual sweep capabilities
- **Improved WebSocket Integration**: Enhanced real-time communication for immediate trading enablement notifications

### Key Features Added
1. **Specific Token Targeting**: Users can add specific token contract addresses for focused monitoring
2. **Trading Status Detection**: Multi-layered approach to detect when trading becomes enabled for disabled tokens
3. **Immediate Auto-Sweep**: Automatic transfer of ALL tokens within seconds of trading enablement
4. **Real-time Dashboard**: Live updates showing active sweeps, pending transactions, and monitored tokens
5. **Emergency Controls**: Enhanced emergency stop functionality for all active sweeps and monitoring

The application is designed to be deployed as a single service with both HTTP and WebSocket endpoints, making it suitable for containerized deployment or traditional server hosting.