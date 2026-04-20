#!/bin/bash
# =================================================================
# Sharp Lens AI 一键部署脚本 (Ubuntu 24)
# 用法: sudo ./deploy.sh
# =================================================================

set -e  # 遇错即停

APP_NAME="sharp-lens-ai"
APP_DIR="/var/www/${APP_NAME}"
NGINX_CONF_SOURCE="${APP_DIR}/deploy/nginx.conf"
NGINX_CONF_TARGET="/etc/nginx/sites-available/${APP_NAME}"
NGINX_CONF_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"

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

# 3. 配置 Nginx
configure_nginx() {
    log_info "配置 Nginx..."

    # 复制 Nginx 配置
    cp "${NGINX_CONF_SOURCE}" "${NGINX_CONF_TARGET}"

    # 检查配置语法
    nginx -t

    # 启用站点（创建软链接，移除旧的）
    ln -sf "${NGINX_CONF_TARGET}" "${NGINX_CONF_ENABLED}"

    # 移除默认站点（如果存在）
    rm -f /etc/nginx/sites-enabled/default

    # 重载 Nginx
    systemctl reload nginx

    log_info "Nginx 配置完成"
}

# 4. 防火墙设置
setup_firewall() {
    log_info "配置防火墙..."

    # 检查 ufw 是否可用
    if command -v ufw &> /dev/null; then
        ufw --force enable
        ufw allow 'Nginx Full'
        log_info "防火墙已配置 (UFW)"
    fi
}

# 主流程
main() {
    log_info "========================================="
    log_info "  ${APP_NAME} 一键部署开始"
    log_info "========================================="

    check_root
    check_nodejs
    build_project
    configure_nginx
    setup_firewall

    log_info "========================================="
    log_info "  部署完成！"
    log_info "  访问: http://$(hostname -I | awk '{print $1}')"
    log_info "========================================="
}

main "$@"