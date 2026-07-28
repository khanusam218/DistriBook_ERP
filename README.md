# DistriBook ERP

A comprehensive offline web-based ERP system for wholesale business management running on localhost.

## Features

- **Stock Management** - Track products with company, pricing, and packing info
- **Customer Management** - Manage retail and wholesaler customers with conditional ledger creation
- **Vendor Management** - Manage suppliers and opening balances
- **Purchase Module** - Create purchase orders with automatic stock updates
- **Purchase Returns** - Handle vendor returns with stock reversal
- **Sale Module** - Create sales/gate passes with bill summary
- **Sale Returns** - Manage customer returns
- **Vendor Ledger** - Track vendor account balances
- **Customer Ledger** - Ledger for wholesaler customers only
- **Trial Balance** - Generate accounting reports
- **User Authentication** - JWT-based login system

## Tech Stack

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL
- **Authentication**: JWT

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation & Setup

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb thok_software

# Run migrations
cd backend
node src/db/migrate.js

# Add demo user (optional)
psql thok_software
INSERT INTO users (username, email, password, full_name, is_active) 
VALUES ('admin', 'admin@thok.com', '$2a$10$...', 'Admin User', true);
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file (already exists with defaults)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_NAME=thok_software
# PORT=5000
# JWT_SECRET=your-secret-key-change-in-production

# Start development server
npm run dev

# API will be available at http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# App will be available at http://localhost:3000
```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- GET `/api/auth/verify` - Verify token

### Stock Management
- GET `/api/stocks` - Get all stocks
- POST `/api/stocks` - Create stock
- PUT `/api/stocks/:id` - Update stock
- DELETE `/api/stocks/:id` - Delete stock
- GET `/api/stocks/search/:term` - Search stocks
- GET `/api/stocks/company/:companyName` - Get stocks by company

### Customers
- GET `/api/customers` - Get all customers
- POST `/api/customers` - Create customer
- PUT `/api/customers/:id` - Update customer
- DELETE `/api/customers/:id` - Delete customer
- GET `/api/customers/type/:type` - Get customers by type

### Vendors
- GET `/api/vendors` - Get all vendors
- POST `/api/vendors` - Create vendor
- PUT `/api/vendors/:id` - Update vendor
- DELETE `/api/vendors/:id` - Delete vendor

### Purchases
- GET `/api/purchases` - Get all purchases
- POST `/api/purchases` - Create purchase order
- GET `/api/purchases/:id` - Get purchase details
- PUT `/api/purchases/:id` - Update purchase
- DELETE `/api/purchases/:id` - Delete purchase

### Sales
- GET `/api/sales` - Get all sales
- POST `/api/sales` - Create sale/gate pass
- GET `/api/sales/:id` - Get sale details
- DELETE `/api/sales/:id` - Delete sale

### Ledgers
- GET `/api/vendor-ledger` - Get vendor ledger
- GET `/api/vendor-ledger/vendor/:vendorId` - Get vendor balance
- GET `/api/customer-ledger` - Get customer ledger (wholesalers only)
- GET `/api/customer-ledger/:customerId` - Get customer balance

### Reports
- GET `/api/trial-balance` - Get trial balance
- GET `/api/trial-balance/inventory` - Get inventory report
- GET `/api/trial-balance/purchases?startDate=&endDate=` - Get purchase report
- GET `/api/trial-balance/sales?startDate=&endDate=` - Get sales report

### Dashboard
- GET `/api/dashboard/overview` - Get dashboard statistics

## Demo Credentials

When you start the system for the first time, use these demo credentials to log in:

- **Username**: admin
- **Password**: admin123

(You'll need to add this user to the database after running migrations)

## Business Logic Rules

### Stock Management
- Stock quantity increases on purchase
- Stock quantity decreases on sale
- Stock quantity reversed on purchase/sale returns

### Customer Type Logic
- **Wholesaler** → Customer ledger is created automatically
- **Retailer** → No customer ledger created

### Ledger Entries
- Double-entry bookkeeping for all transactions
- Automatic ledger entry creation on vendor/customer transactions
- Opening balances recorded as initial ledger entries

### Trial Balance
- Sums all debits and credits per account
- Verifies accounting equation (debits = credits)
- Includes vendors, wholesaler customers, and company accounts

## Database Schema

Key tables:
- `stocks` - Product inventory
- `customers` - Customer information (with customer_type and opening_balance)
- `vendors` - Vendor information (with opening_balance)
- `purchases` - Purchase orders
- `purchase_items` - Line items for purchases
- `sales` - Sales/gate passes
- `sale_items` - Line items for sales
- `vendor_ledger` - Vendor account transactions
- `customer_ledger` - Customer account transactions (wholesalers only)
- `company_ledger` - Company account transactions
- `users` - User authentication

## Project Structure

```
DistriBook ERP/
├── backend/
│   ├── src/
│   │   ├── controllers/        # API controllers
│   │   ├── services/           # Business logic
│   │   ├── routes/             # API routes
│   │   ├── middleware/         # Express middleware
│   │   ├── db/                 # Database config and migrations
│   │   └── server.js           # Express app entry point
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/              # React pages
│   │   ├── components/         # React components
│   │   ├── api.js              # Axios client
│   │   ├── App.jsx             # Main app component
│   │   └── main.jsx            # React entry point
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
```

## Development Notes

- All CRUD operations are transaction-safe using PostgreSQL transactions
- Stock updates happen automatically on purchase/sale operations
- Ledger entries are auto-created with proper double-entry bookkeeping
- Customer type determines whether a ledger is created
- JWT tokens are valid for 7 days
- All timestamps are in UTC

## Next Steps

1. Implement detailed UI for each module (currently showing placeholders)
2. Add form validation and error handling
3. Implement pagination and filtering
4. Add file export functionality (PDF, Excel)
5. Add more advanced reporting features
6. Implement multi-user role-based access control
7. Add audit logging

## Support

For issues or questions, please check the API documentation or review the controller files for implementation details.
