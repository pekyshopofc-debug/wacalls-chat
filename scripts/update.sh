#!/bin/bash
# =============================================================================
#  update.sh - Atualiza o WaCalls no servidor
#  Uso: bash scripts/update.sh
# =============================================================================
set -e

echo "🚀 Atualizando WaCalls..."
echo ""

# 1. Puxar as últimas alterações do Git
echo "📥 1. Git pull..."
git pull
echo ""

# 2. Parar containers e remover volumes (⚠️ reseta o banco!)
echo "🗑️  2. Removendo containers e volumes antigos..."
docker compose down -v
echo ""

# 3. Reconstruir a imagem DO ZERO (sem cache)
echo "🏗️  3. Reconstruindo imagem (sem cache)..."
docker compose build --no-cache
echo ""

# 4. Subir os containers
echo "⬆️  4. Subindo containers..."
docker compose up -d
echo ""

# 5. Aguardar healthcheck (até 30s)
echo "⏳ 5. Aguardando servidor ficar saudável..."
for i in $(seq 1 30); do
  if docker compose exec -T wacalls wget --spider -q http://localhost:8080/api/health 2>/dev/null; then
    echo "   ✅ Servidor pronto!"
    break
  fi
  sleep 1
done
echo ""
docker compose logs --tail=30

echo ""
echo "✅ Pronto! Acesse e faça login com:"
echo "   Email: superadmin@atozsolutions.xyz"
echo "   Senha: wacalls@admin"
