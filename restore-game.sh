#!/bin/bash
if [ -f js/game.js.bak ]; then
  cp js/game.js.bak js/game.js
  echo "已恢复原始游戏文件"
else
  echo "未找到备份文件js/game.js.bak"
fi
