#!/bin/bash

# 用法: ./scripts/run-nx-affected.sh 'pnpm nx affected -t madge'
# 脚本会自动计算改动的文件，并用 --files 参数传给 nx affected

set -e

COMMAND="$@"

if [ -z "$COMMAND" ]; then
  echo "Error: No command provided" >&2
  echo "Usage: $0 'pnpm nx affected -t <target>'" >&2
  exit 1
fi

# 获取当前分支名称
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MAIN_BRANCH=${NX_MAIN_BRANCH:-main}

echo "Current branch: $CURRENT_BRANCH" >&2

# 检查远端是否存在对应分支
if git ls-remote --exit-code --heads origin "$CURRENT_BRANCH" > /dev/null 2>&1; then
  echo "Remote branch found: origin/$CURRENT_BRANCH" >&2
  # 远端分支存在，对比远端 vs 本地
  BASE=$(git rev-parse origin/$CURRENT_BRANCH)
  HEAD_REF=$(git rev-parse HEAD)
  echo "Mode: comparing local changes against remote branch" >&2
else
  echo "Remote branch not found, using merge-base with $MAIN_BRANCH" >&2
  # 远端分支不存在，对比分叉点 vs 本地
  if git show-ref --verify --quiet refs/remotes/origin/$MAIN_BRANCH; then
    BASE=$(git merge-base origin/$MAIN_BRANCH HEAD)
  else
    BASE=$(git merge-base $MAIN_BRANCH HEAD 2>/dev/null || git rev-parse HEAD~1)
  fi
  HEAD_REF=$(git rev-parse HEAD)
  echo "Mode: comparing new branch changes" >&2
fi

echo "BASE=$BASE" >&2
echo "HEAD=$HEAD_REF" >&2

# 获取改动的文件列表
# 包括已提交的改动、未暂存的改动、未跟踪的文件
CHANGED_FILES=$(git diff --name-only $BASE $HEAD_REF; git diff --name-only; git ls-files --others --exclude-standard)

# 去重并用逗号分隔
FILES_LIST=$(echo "$CHANGED_FILES" | sort -u | tr '\n' ',' | sed 's/,$//')

echo "Changed files: $FILES_LIST" >&2
echo "" >&2

# 执行命令并附加 --files 参数
if [ -z "$FILES_LIST" ]; then
  echo "No files changed" >&2
  exit 0
fi

eval "$COMMAND --files $FILES_LIST"
