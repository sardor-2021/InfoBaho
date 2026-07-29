# InfoTest Backend

InfoTest - Informatika darslarida axborot texnologiyalari asosida o'quvchilar bilimini baholash platformasi (Backend qismi)

## 📋 Talablar

- Node.js >= 14.x
- npm >= 6.x
- SQLite3

## 🚀 O'rnatish

1. Paketlarni o'rnatish:
```bash
npm install
```

2. Environment o'zgaruvchilarini sozlash:
```bash
cp .env.example .env
# .env faylini o'zgartirib, o'z ma'lumotlaringizni kiriting
```

3. Ma'lumotlar bazasini yaratish:
```bash
npm run init-db
```

4. Demo ma'lumotlarni yuklash:
```bash
npm run seed
```

## 📦 Ishga tushirish

Development rejimida:
```bash
npm run dev
```

Production rejimida:
```bash
npm start
```

Server http://localhost:5000 da ishga tushadi.

## 🔑 Demo accounts

- **Admin**: `admin` / `admin123`
- **O'qituvchi**: `o_qituvchi` / `teacher123`
- **O'quvchi**: `akmal_yusupov` / `student123`

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Ro'yxatdan o'tish
- `POST /api/auth/login` - Tizimga kirish

### Users
- `GET /api/users/me` - Joriy foydalanuvchi ma'lumotlari
- `GET /api/users/leaderboard` - Liderlar jadvali
- `GET /api/users` - Barcha foydalanuvchilar (Admin)

### Tests
- `GET /api/tests` - Barcha testlar
- `GET /api/tests/:id` - Bitta test
- `POST /api/tests` - Test yaratish (O'qituvchi)
- `PUT /api/tests/:id` - Testni yangilash (O'qituvchi)
- `DELETE /api/tests/:id` - Testni o'chirish (O'qituvchi)
- `GET /api/tests/:id/statistics` - Test statistikasi (O'qituvchi)

### Questions
- `GET /api/questions` - Savollar
- `POST /api/questions` - Savol yaratish (O'qituvchi)

### Results
- `GET /api/results` - Natijalar

### Portfolio
- `GET /api/portfolio` - Portfolio

### Statistics
- `GET /api/statistics` - Statistika

## 📁 Struktura

```
backend/
├── config/          # Konfiguratsiya fayllari
├── database/        # SQLite ma'lumotlar bazasi
├── middleware/      # Express middleware
├── models/          # Ma'lumotlar modellari
├── routes/          # API routes
├── scripts/         # Utility skriptlar
├── uploads/         # Yuklangan fayllar
├── .env.example     # Environment o'zgaruvchilari namunasi
├── .gitignore       # Git ignore fayli
├── package.json     # NPM paket fayli
├── README.md        # Hujjatlar
└── server.js        # Asosiy server fayli
```

## 🛠️ Texnologiyalar

- **Express.js** - Backend framework
- **SQLite3** - Ma'lumotlar bazasi
- **JWT** - Autentifikatsiya
- **bcryptjs** - Parol shifrlash
- **express-validator** - Ma'lumotlarni tekshirish

## 📝 Litsenziya

MIT
