#!/bin/bash
# =================================================================
# Sharp Lens AI 构建脚本 (Ubuntu 24)
# 用法: sudo ./deploy.sh
# =================================================================

set -e  # 遇错即停

APP_NAME="sharp-lens-ai"
APP_DIR="/var/www/${APP_NAME}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否为 root 用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "请使用 sudo 运行此脚本"
        exit 1
    fi
}

# 1. 检查并安装 Node.js
check_nodejs() {
    log_info "检查 Node.js..."

    if ! command -v node &> /dev/null; then
        log_info "安装 Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        log_info "Node.js 已安装: $(node -v)"
    fi
}

# 2. 安装依赖 & 构建
build_project() {
    log_info "安装依赖并构建..."
    cd "${APP_DIR}"

    # 清除旧依赖避免版本冲突
    rm -rf node_modules package-lock.json

    # 安装依赖
    npm install

    # 构建
    log_info "开始构建..."
    npm run build

    log_info "构建完成，产物位于 dist/ 目录"
}

# 主流程
main() {
    log_info "========================================="
    log_info "  ${APP_NAME} 构建开始"
    log_info "========================================="

    check_root
    check_nodejs
    build_project

    log_info "========================================="
    log_info "  构建完成！"
    log_info "========================================="
}

main "$@"