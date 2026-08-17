#!/bin/bash
set -e

echo "=== SC Lab Portal - Docker Startup ==="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not found. Install Docker Desktop from https://docker.com"
    exit 1
fi

echo "Docker version: $(docker --version)"

# Check if docker compose v2 plugin is available
if docker compose version &> /dev/null; then
    COMPOSE="docker compose"
    echo "Using: docker compose (v2 plugin)"
elif command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
    echo "Using: docker-compose (standalone)"
else
    echo ""
    echo "Docker Compose is NOT installed."
    echo ""
    echo "Your options:"
    echo "  1. Install Docker Desktop (includes Compose): https://docker.com/products/docker-desktop"
    echo "  2. Install Compose plugin: brew install docker-compose"
    echo "  3. Run without Docker: ./start-local.sh"
    echo ""
    exit 1
fi

echo ""
echo "Building and starting services..."
echo ""

$COMPOSE up --build
