@echo off
setlocal EnableExtensions
title 单词学习应用 - 一键启动

cd /d "%~dp0"

echo ==========================================
echo    单词学习应用 一键启动
echo ==========================================
echo.

rem ---------- 环境检查 ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 18 或更高版本。
  echo        下载地址: https://nodejs.org/
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo [检查] Node.js %NODE_VER%

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 npm，请重新安装 Node.js。
  echo.
  pause
  exit /b 1
)

rem ---------- 依赖检查 ----------
if not exist "node_modules\" (
  echo [安装] 未找到 node_modules，开始安装依赖（首次可能较慢）...
  call npm install
  if errorlevel 1 (
    echo.
    echo [错误] 依赖安装失败，请检查网络后重试。
    echo.
    pause
    exit /b 1
  )
  echo [安装] 依赖安装完成
) else (
  echo [检查] 依赖已存在
)

rem ---------- 端口检查 ----------
set "PORT=8457"
set "URL=http://127.0.0.1:%PORT%/web_vocabulary/"
rem 只匹配本机监听行，避免误判 TIME_WAIT 残留连接
netstat -ano -p tcp | findstr "LISTENING" | findstr /c:":%PORT% " >nul 2>nul
if not errorlevel 1 (
  echo [提示] 端口 %PORT% 已在监听，判定开发服务器已在运行。
  echo        直接打开: %URL%
  start "" "%URL%"
  echo.
  pause
  exit /b 0
)

rem ---------- 启动开发服务器 ----------
echo.
echo [启动] 开发服务器即将启动，浏览器会自动打开，请稍候...
echo        访问地址: %URL%
echo        关闭本窗口即停止服务。
echo.
call npm run dev -- --port %PORT% --strictPort --host 127.0.0.1 --open

echo.
echo [结束] 开发服务器已退出。
pause
