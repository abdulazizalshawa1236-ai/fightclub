#!/usr/bin/env bash
# Fight Club — one-command start (Mac / Linux)
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node.js غير مثبت: https://nodejs.org"; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 22 ] || { echo "هذا الموقع يحتاج Node.js 22 أو أحدث: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install --omit=dev || exit 1
if [ ! -f .env ]; then
  read -r -p "اسم مستخدم الأدمن [admin]: " U; U=${U:-admin}
  read -r -s -p "كلمة المرور (12 حرفاً+، اتركها فارغة لتوليد كلمة عشوائية): " P; echo
  printf "PORT=3000\nADMIN_USER=%s\nADMIN_PASS=%s\nTZ_NAME=Asia/Riyadh\n" "$U" "$P" > .env
fi
echo "الموقع: http://localhost:3000   |   لوحة التحكم: http://localhost:3000/admin"
exec node server.js
