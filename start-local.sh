#!/bin/bash
set -e

echo "=== SC Lab Portal - Local Startup (No Docker) ==="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# --- Check prerequisites ---
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "Node: $(node --version)"

# --- Check/Install Postgres ---
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL not found. Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "ERROR: Neither PostgreSQL nor Homebrew found."
        echo "Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    brew install postgresql@16
    brew services start postgresql@16
    echo "Waiting for Postgres to start..."
    sleep 3
else
    echo "PostgreSQL: $(psql --version)"
fi

# Ensure Postgres is running
if ! pg_isready &> /dev/null; then
    echo "Starting PostgreSQL..."
    brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
    sleep 3
    if ! pg_isready &> /dev/null; then
        echo "ERROR: Could not start PostgreSQL. Start it manually."
        exit 1
    fi
fi
echo "PostgreSQL is running."

# --- Create database if not exists ---
DB_NAME="sclab"
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "Database '$DB_NAME' already exists."
else
    echo "Creating database '$DB_NAME'..."
    createdb "$DB_NAME"
    echo "Seeding schema..."
    psql "$DB_NAME" < server/schema.sql
    echo "Database seeded."
fi

# --- Install dependencies ---
echo ""
echo "Installing frontend dependencies..."
npm install --silent

echo "Installing server dependencies..."
cd server && npm install --silent && cd ..

# --- Create server .env if missing ---
CURRENT_USER=$(whoami)
if [ ! -f server/.env ]; then
    cat > server/.env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sclab
DB_USER=$CURRENT_USER
DB_PASSWORD=
JWT_SECRET=dev-secret-change-in-production
PORT=3001
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://localhost:5173
EOF
    echo "Created server/.env"
fi

# --- Create upload dirs ---
mkdir -p server/uploads/documents server/uploads/facility-images

# --- Start both servers ---
echo ""
echo "=== Starting SC Lab Portal ==="
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo "  Admin:    generated on first boot (see server console) or set SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD in server/.env"
echo ""

# Start backend in background
cd server
npx tsx watch src/index.ts &
SERVER_PID=$!
cd ..

# Start frontend
npm run dev &
FRONTEND_PID=$!

# Trap to clean up on exit
trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT

echo "Press Ctrl+C to stop both servers."
wait
