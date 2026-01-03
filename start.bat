@echo off
REM ===========================================
REM Authentication System - Development Start Script (Windows)
REM ===========================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo [INFO] Starting Authentication System...

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18 or higher.
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_VER=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VER:~1%") do set NODE_MAJOR=%%i
if %NODE_MAJOR% LSS 18 (
    echo [ERROR] Node.js version 18 or higher is required.
    exit /b 1
)

REM Check for .env file
if not exist .env (
    echo [WARN] .env file not found.
    if exist .env.example (
        echo [INFO] Copying .env.example to .env...
        copy .env.example .env >nul
        echo [WARN] Please edit .env with your configuration before running again.
        exit /b 1
    ) else (
        echo [ERROR] .env.example not found. Cannot create configuration.
        exit /b 1
    )
)

REM Check for node_modules
if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies.
        exit /b 1
    )
)

REM Load and validate .env
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    if not "!line:~0,1!"=="#" (
        if not "%%b"=="" (
            set "%%a=%%b"
        )
    )
)

REM Check required variables
set MISSING_VARS=
if "%DATABASE_URL%"=="" set MISSING_VARS=!MISSING_VARS! DATABASE_URL
if "%SESSION_SECRET%"=="" set MISSING_VARS=!MISSING_VARS! SESSION_SECRET

if not "%MISSING_VARS%"=="" (
    echo [ERROR] Missing required environment variables:%MISSING_VARS%
    echo [INFO] Please configure these in your .env file.
    exit /b 1
)

echo [INFO] Starting authentication system in development mode...
if "%APP_URL%"=="" (
    echo [INFO] Server will be available at: http://localhost:3000
) else (
    echo [INFO] Server will be available at: %APP_URL%
)
echo.

REM Start the application
if exist node_modules\nodemon (
    call npm run dev
) else (
    call npm start
)

endlocal
