#!/bin/bash
# Management Script - Run on EC2 instance
# This script helps manage the Docker containers and services

set -e

APP_DIR="/opt/workstream-ai"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running with sudo
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run with sudo"
   exit 1
fi

# Main menu
show_menu() {
    echo ""
    echo "Available Commands:"
    echo "  1. status       - Show container status"
    echo "  2. logs         - Show live logs from all containers"
    echo "  3. logs-service - Show logs for specific service"
    echo "  4. restart      - Restart all services"
    echo "  5. restart-svc  - Restart specific service"
    echo "  6. stop         - Stop all containers"
    echo "  7. start        - Start all containers"
    echo "  8. update       - Pull latest code and restart"
    echo "  9. stats        - Show container resource usage"
    echo "  10. db-backup   - Backup database"
    echo "  11. shell       - Open shell in container"
    echo "  12. health-check - Check application health"
    echo "  13. exit        - Exit this script"
    echo ""
}

# Status
cmd_status() {
    print_header "Container Status"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" ps
    print_success "Status retrieved"
}

# Logs
cmd_logs() {
    print_header "Live Logs"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f --tail=100
}

# Logs for specific service
cmd_logs_service() {
    echo ""
    echo "Available services:"
    echo "  1. frontend"
    echo "  2. meeting-workflow"
    echo "  3. video-onboarding"
    echo "  4. db"
    echo "  5. nginx"
    read -p "Select service (1-5): " SERVICE_NUM
    
    case $SERVICE_NUM in
        1) SERVICE="frontend" ;;
        2) SERVICE="meeting-workflow" ;;
        3) SERVICE="video-onboarding" ;;
        4) SERVICE="db" ;;
        5) SERVICE="nginx" ;;
        *) print_error "Invalid selection"; return ;;
    esac
    
    print_header "Logs for $SERVICE"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f --tail=100 "$SERVICE"
}

# Restart services
cmd_restart() {
    print_header "Restarting All Services"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" restart
    print_success "All services restarted"
    sleep 2
    cmd_status
}

# Restart specific service
cmd_restart_service() {
    echo ""
    echo "Available services:"
    echo "  1. frontend"
    echo "  2. meeting-workflow"
    echo "  3. video-onboarding"
    echo "  4. db"
    echo "  5. nginx"
    read -p "Select service (1-5): " SERVICE_NUM
    
    case $SERVICE_NUM in
        1) SERVICE="frontend" ;;
        2) SERVICE="meeting-workflow" ;;
        3) SERVICE="video-onboarding" ;;
        4) SERVICE="db" ;;
        5) SERVICE="nginx" ;;
        *) print_error "Invalid selection"; return ;;
    esac
    
    print_header "Restarting $SERVICE"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" restart "$SERVICE"
    print_success "$SERVICE restarted"
}

# Stop services
cmd_stop() {
    print_header "Stopping All Services"
    read -p "Are you sure? (yes/no): " CONFIRM
    if [[ "$CONFIRM" == "yes" ]]; then
        cd "$APP_DIR"
        docker-compose -f "$COMPOSE_FILE" stop
        print_success "All services stopped"
    else
        print_warning "Operation cancelled"
    fi
}

# Start services
cmd_start() {
    print_header "Starting All Services"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" up -d
    print_success "All services started"
    sleep 2
    cmd_status
}

# Update and restart
cmd_update() {
    print_header "Updating Application"
    cd "$APP_DIR"
    
    print_warning "Pulling latest code..."
    git pull origin main
    print_success "Code pulled"
    
    print_warning "Rebuilding containers..."
    docker-compose -f "$COMPOSE_FILE" up -d --build
    print_success "Containers rebuilt and restarted"
    
    sleep 3
    cmd_status
}

# Container stats
cmd_stats() {
    print_header "Container Resource Usage"
    docker stats --no-stream
}

# Database backup
cmd_db_backup() {
    print_header "Database Backup"
    BACKUP_FILE="/opt/workstream-ai/backups/workstream_backup_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p /opt/workstream-ai/backups
    
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump \
        -U workstream_user \
        workstream_db > "$BACKUP_FILE"
    
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "Database backed up to: $BACKUP_FILE ($SIZE)"
    
    # List recent backups
    echo ""
    echo "Recent backups:"
    ls -lh /opt/workstream-ai/backups/ | tail -5
}

# Shell access
cmd_shell() {
    echo ""
    echo "Available services:"
    echo "  1. frontend"
    echo "  2. meeting-workflow"
    echo "  3. video-onboarding"
    echo "  4. db"
    echo "  5. nginx"
    read -p "Select service (1-5): " SERVICE_NUM
    
    case $SERVICE_NUM in
        1) SERVICE="frontend" ;;
        2) SERVICE="meeting-workflow" ;;
        3) SERVICE="video-onboarding" ;;
        4) SERVICE="db" ;;
        5) SERVICE="nginx" ;;
        *) print_error "Invalid selection"; return ;;
    esac
    
    print_header "Shell - $SERVICE"
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" exec "$SERVICE" /bin/sh
}

# Health check
cmd_health_check() {
    print_header "Health Check"
    
    echo "Frontend: "
    curl -s http://localhost:3000 > /dev/null && print_success "Online" || print_error "Offline"
    
    echo "Meeting Workflow API: "
    curl -s http://localhost:8001/health > /dev/null && print_success "Online" || print_error "Offline"
    
    echo "Video Onboarding API: "
    curl -s http://localhost:8004/health > /dev/null && print_success "Online" || print_error "Offline"
    
    echo "Database: "
    cd "$APP_DIR"
    docker-compose -f "$COMPOSE_FILE" exec -T db pg_isready -U workstream_user > /dev/null && print_success "Online" || print_error "Offline"
    
    echo "Nginx: "
    curl -s http://localhost:80 > /dev/null && print_success "Online" || print_error "Offline"
}

# Main loop
print_header "Workstream AI Management"
print_success "Welcome to Workstream AI Management Tool"

while true; do
    show_menu
    read -p "Enter command (1-13): " CHOICE
    
    case $CHOICE in
        1) cmd_status ;;
        2) cmd_logs ;;
        3) cmd_logs_service ;;
        4) cmd_restart ;;
        5) cmd_restart_service ;;
        6) cmd_stop ;;
        7) cmd_start ;;
        8) cmd_update ;;
        9) cmd_stats ;;
        10) cmd_db_backup ;;
        11) cmd_shell ;;
        12) cmd_health_check ;;
        13) echo "Goodbye!"; exit 0 ;;
        *) print_error "Invalid command" ;;
    esac
done
