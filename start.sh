#!/bin/bash

# InfoTest Platform - Quick Start Script
# This script initializes and starts the InfoTest platform

echo "🚀 InfoTest Platform - Ishga Tushirish"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js topilmadi! Iltimos Node.js o'rnating.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js versiyasi: $(node --version)"
echo -e "${GREEN}✓${NC} npm versiyasi: $(npm --version)"
echo ""

# Backend setup
echo -e "${BLUE}📦 Backend o'rnatilmoqda...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    echo "npm paketlari yuklanmoqda..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ npm install xatosi!${NC}"
        exit 1
    fi
fi

# Initialize database if not exists
if [ ! -f "infotest.db" ]; then
    echo -e "${BLUE}🗄️  Ma'lumotlar bazasi yaratilmoqda...${NC}"
    npm run init-db
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Ma'lumotlar bazasi yaratildi"
        
        echo -e "${BLUE}🌱 Demo ma'lumotlar yuklanmoqda...${NC}"
        npm run seed
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Demo ma'lumotlar yuklandi"
        fi
    fi
fi

# Start backend
echo ""
echo -e "${BLUE}🚀 Backend server ishga tushirilmoqda...${NC}"
echo -e "${GREEN}   http://localhost:5000${NC}"
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Frontend setup
cd ../frontend
echo ""
echo -e "${BLUE}📦 Frontend o'rnatilmoqda...${NC}"

if [ ! -d "node_modules" ]; then
    echo "npm paketlari yuklanmoqda..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ npm install xatosi!${NC}"
        kill $BACKEND_PID
        exit 1
    fi
fi

# Start frontend
echo ""
echo -e "${BLUE}🚀 Frontend ishga tushirilmoqda...${NC}"
echo -e "${GREEN}   http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}======================================"
echo -e "✅ InfoTest Platform ishga tushdi!"
echo -e "======================================"
echo ""
echo "Demo hisoblar:"
echo "  Admin:     admin / admin123"
echo "  O'qituvchi: o_qituvchi / teacher123"
echo "  Talaba:    akmal_yusupov / student123"
echo ""
echo "To'xtatish uchun: Ctrl+C"
echo -e "${NC}"

npm start

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
